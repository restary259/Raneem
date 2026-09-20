CREATE OR REPLACE FUNCTION public.whatsapp_normalize_msisdn(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v text := regexp_replace(coalesce(p_value, ''), '\D', '', 'g');
BEGIN
  IF v = '' THEN RETURN ''; END IF;
  IF v ~ '^00972\d{9}$' THEN RETURN substring(v from 3); END IF;
  IF v ~ '^05\d{8}$' THEN RETURN '972' || substring(v from 2); END IF;
  RETURN v;
END;
$function$;

REVOKE ALL ON FUNCTION public.whatsapp_normalize_msisdn(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_normalize_msisdn(text) TO service_role;

CREATE OR REPLACE FUNCTION public.whatsapp_ingest_event(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_delivery_id text := nullif(p_payload->>'delivery_id', '');
  v_events jsonb := coalesce(p_payload->'events', '[]'::jsonb);
  v_event jsonb;
  v_type text;
  v_inserted boolean := false;
  v_results jsonb := '[]'::jsonb;

  v_phone text;
  v_lead_id uuid;
  v_conversation_id uuid;
  v_provider_id text;
  v_body text;
  v_occurred timestamptz;
  v_status text;
  v_existing_rank integer;
  v_existing_at timestamptz;
  v_message_id uuid;
  v_pending record;
BEGIN
  IF v_delivery_id IS NULL THEN
    RAISE EXCEPTION 'delivery_id is required';
  END IF;

  -- Retry short-circuit: a delivery is applied exactly once.
  INSERT INTO public.whatsapp_deliveries (delivery_id, event_header, event_count)
  VALUES (v_delivery_id, nullif(p_payload->>'event', ''), jsonb_array_length(v_events))
  ON CONFLICT (delivery_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF NOT v_inserted THEN
    RETURN jsonb_build_object('status', 'duplicate', 'delivery_id', v_delivery_id);
  END IF;

  FOR v_event IN SELECT * FROM jsonb_array_elements(v_events)
  LOOP
    v_type := lower(coalesce(v_event->>'event_type', 'unhandled'));
    v_provider_id := nullif(v_event->>'provider_message_id', '');
    v_occurred := nullif(v_event->>'occurred_at', '')::timestamptz;

    ------------------------------------------------------------------
    IF v_type IN ('whatsapp.message', 'whatsapp.message_echo') THEN
      v_phone := public.whatsapp_normalize_msisdn(v_event->>'from');

      IF v_phone = '' OR v_provider_id IS NULL THEN
        INSERT INTO public.whatsapp_ingest_log (delivery_id, event_type, payload)
        VALUES (v_delivery_id, 'message.incomplete', v_event);
        v_results := v_results || jsonb_build_object('event_type', v_type, 'result', 'skipped');
        CONTINUE;
      END IF;

      -- Identity is resolved by phone number only. Never touches leads/cases.
      INSERT INTO public.whatsapp_leads (whatsapp_number, student_name, source, consent_status, lead_stage)
      VALUES (v_phone, '', 'whatsapp', 'unknown', 'new')
      ON CONFLICT (whatsapp_number) DO NOTHING;

      SELECT id INTO v_lead_id FROM public.whatsapp_leads WHERE whatsapp_number = v_phone;

      INSERT INTO public.whatsapp_conversations (lead_id, state)
      VALUES (v_lead_id, 'new')
      ON CONFLICT (lead_id) DO NOTHING;

      SELECT id INTO v_conversation_id FROM public.whatsapp_conversations WHERE lead_id = v_lead_id;

      v_body := coalesce(v_event->>'text', '');

      INSERT INTO public.whatsapp_messages (
        conversation_id, provider_message_id, delivery_id, direction, message_type,
        body, media_provider_id, reply_to_provider_id, delivery_status,
        sent_at, status_updated_at, raw_payload
      )
      VALUES (
        v_conversation_id, v_provider_id, v_delivery_id,
        CASE WHEN v_type = 'whatsapp.message_echo' THEN 'outbound' ELSE 'inbound' END,
        coalesce(nullif(v_event->>'message_type', ''), 'text'),
        v_body,
        nullif(v_event->>'media_provider_id', ''),
        nullif(v_event->>'reply_to_provider_id', ''),
        CASE WHEN v_type = 'whatsapp.message_echo' THEN 'sent' ELSE 'delivered' END,
        coalesce(v_occurred, now()),
        coalesce(v_occurred, now()),
        coalesce(v_event->'raw', v_event)
      )
      ON CONFLICT (provider_message_id) DO NOTHING
      RETURNING id INTO v_message_id;

      IF v_message_id IS NOT NULL AND v_type = 'whatsapp.message_echo' THEN
        -- A message the business sent from the WhatsApp Business phone app.
        -- It is never unread and never reopens a resolved conversation.
        UPDATE public.whatsapp_conversations
        SET last_outbound_at = coalesce(v_occurred, now()),
            last_team_response_at = coalesce(v_occurred, now()),
            first_response_at = coalesce(first_response_at, coalesce(v_occurred, now())),
            last_message_preview = left(nullif(v_body, ''), 240),
            updated_at = now()
        WHERE id = v_conversation_id;
      ELSIF v_message_id IS NOT NULL THEN
        UPDATE public.whatsapp_conversations
        SET last_inbound_at = coalesce(v_occurred, now()),
            unread_count = unread_count + 1,
            last_message_preview = left(nullif(v_body, ''), 240),
            state = CASE WHEN state = 'resolved' THEN 'open' ELSE state END,
            updated_at = now()
        WHERE id = v_conversation_id;
      END IF;

      -- Drain any status that arrived before this message.
      SELECT * INTO v_pending FROM public.whatsapp_pending_statuses WHERE provider_message_id = v_provider_id;
      IF FOUND THEN
        UPDATE public.whatsapp_messages
        SET delivery_status = v_pending.delivery_status,
            status_updated_at = v_pending.status_updated_at,
            error_status = coalesce(v_pending.error_status, error_status),
            error_message = coalesce(v_pending.error_message, error_message)
        WHERE provider_message_id = v_provider_id
          AND public.whatsapp_status_rank(v_pending.delivery_status) > public.whatsapp_status_rank(delivery_status);
        DELETE FROM public.whatsapp_pending_statuses WHERE provider_message_id = v_provider_id;
      END IF;

      v_results := v_results || jsonb_build_object('event_type', v_type, 'result',
        CASE WHEN v_message_id IS NULL THEN 'duplicate' ELSE 'stored' END);

    ------------------------------------------------------------------
    ELSIF v_type IN ('whatsapp.status', 'whatsapp.message_error') THEN
      v_status := lower(coalesce(nullif(v_event->>'status', ''),
                                 CASE WHEN v_type = 'whatsapp.message_error' THEN 'failed' ELSE '' END));

      IF v_provider_id IS NULL OR v_status = '' THEN
        INSERT INTO public.whatsapp_ingest_log (delivery_id, event_type, payload)
        VALUES (v_delivery_id, 'status.incomplete', v_event);
        v_results := v_results || jsonb_build_object('event_type', v_type, 'result', 'skipped');
        CONTINUE;
      END IF;

      SELECT public.whatsapp_status_rank(delivery_status), status_updated_at
        INTO v_existing_rank, v_existing_at
        FROM public.whatsapp_messages
       WHERE provider_message_id = v_provider_id;

      IF NOT FOUND THEN
        -- Park it; never create a message from a status.
        INSERT INTO public.whatsapp_pending_statuses (
          provider_message_id, delivery_status, status_updated_at, error_status, error_message, raw_payload
        )
        VALUES (
          v_provider_id, v_status, v_occurred,
          nullif(v_event->>'error_code', '')::integer,
          nullif(v_event->>'error_message', ''),
          coalesce(v_event->'raw', v_event)
        )
        ON CONFLICT (provider_message_id) DO UPDATE
          SET delivery_status = EXCLUDED.delivery_status,
              status_updated_at = EXCLUDED.status_updated_at,
              error_status = coalesce(EXCLUDED.error_status, public.whatsapp_pending_statuses.error_status),
              error_message = coalesce(EXCLUDED.error_message, public.whatsapp_pending_statuses.error_message),
              raw_payload = EXCLUDED.raw_payload,
              updated_at = now()
          WHERE public.whatsapp_status_rank(EXCLUDED.delivery_status)
              > public.whatsapp_status_rank(public.whatsapp_pending_statuses.delivery_status);

        v_results := v_results || jsonb_build_object('event_type', v_type, 'result', 'pending');
        CONTINUE;
      END IF;

      IF public.whatsapp_status_rank(v_status) > v_existing_rank
         AND (v_occurred IS NULL OR v_existing_at IS NULL OR v_occurred >= v_existing_at) THEN
        UPDATE public.whatsapp_messages
        SET delivery_status = v_status,
            status_updated_at = coalesce(v_occurred, now()),
            error_status = coalesce(nullif(v_event->>'error_code', '')::integer, error_status),
            error_message = coalesce(nullif(v_event->>'error_message', ''), error_message)
        WHERE provider_message_id = v_provider_id;
        v_results := v_results || jsonb_build_object('event_type', v_type, 'result', 'applied');
      ELSE
        v_results := v_results || jsonb_build_object('event_type', v_type, 'result', 'ignored_out_of_order');
      END IF;

    ------------------------------------------------------------------
    ELSIF v_type = 'whatsapp.template_status' THEN
      UPDATE public.whatsapp_templates
      SET approval_status = upper(coalesce(nullif(v_event->>'template_status', ''), approval_status)),
          last_synced_at = now()
      WHERE provider_name = nullif(v_event->>'template_name', '')
        AND (nullif(v_event->>'template_language', '') IS NULL
             OR language_code = v_event->>'template_language');

      INSERT INTO public.whatsapp_ingest_log (delivery_id, event_type, payload)
      VALUES (v_delivery_id, v_type, v_event);

      v_results := v_results || jsonb_build_object('event_type', v_type, 'result', 'applied');

    ------------------------------------------------------------------
    ELSE
      INSERT INTO public.whatsapp_ingest_log (delivery_id, event_type, payload)
      VALUES (v_delivery_id, v_type, v_event);
      v_results := v_results || jsonb_build_object('event_type', v_type, 'result', 'logged');
    END IF;
  END LOOP;

  RETURN jsonb_build_object('status', 'ok', 'delivery_id', v_delivery_id, 'events', v_results);
END;
$function$;