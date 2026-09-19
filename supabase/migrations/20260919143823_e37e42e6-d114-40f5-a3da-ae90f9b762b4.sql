-- 1. Message columns needed for durable, ordered ingest
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS delivery_id text,
  ADD COLUMN IF NOT EXISTS media_provider_id text,
  ADD COLUMN IF NOT EXISTS reply_to_provider_id text,
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb;

ALTER TABLE public.whatsapp_messages ALTER COLUMN body SET DEFAULT '';

CREATE INDEX IF NOT EXISTS whatsapp_messages_delivery_idx
  ON public.whatsapp_messages (delivery_id);

-- 2. Delivery ledger (gateway retry short-circuit)
CREATE TABLE IF NOT EXISTS public.whatsapp_deliveries (
  delivery_id text PRIMARY KEY,
  event_header text,
  event_count integer NOT NULL DEFAULT 0,
  processed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_deliveries TO service_role;
ALTER TABLE public.whatsapp_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read whatsapp deliveries"
  ON public.whatsapp_deliveries FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Statuses that arrive before their outbound message row
CREATE TABLE IF NOT EXISTS public.whatsapp_pending_statuses (
  provider_message_id text PRIMARY KEY,
  delivery_status text NOT NULL,
  status_updated_at timestamptz,
  error_status integer,
  error_message text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_pending_statuses TO service_role;
ALTER TABLE public.whatsapp_pending_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read whatsapp pending statuses"
  ON public.whatsapp_pending_statuses FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Anything unrecognised or not tied to a conversation
CREATE TABLE IF NOT EXISTS public.whatsapp_ingest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_ingest_log TO service_role;
ALTER TABLE public.whatsapp_ingest_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read whatsapp ingest log"
  ON public.whatsapp_ingest_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS whatsapp_ingest_log_created_idx
  ON public.whatsapp_ingest_log (created_at DESC);

-- 5. Status ranking (higher wins; failed always wins)
CREATE OR REPLACE FUNCTION public.whatsapp_status_rank(p_status text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(p_status, ''))
    WHEN 'pending'   THEN 1
    WHEN 'accepted'  THEN 2
    WHEN 'sent'      THEN 3
    WHEN 'delivered' THEN 4
    WHEN 'read'      THEN 5
    WHEN 'failed'    THEN 99
    ELSE 0
  END
$$;

-- 6. The ingest entry point
CREATE OR REPLACE FUNCTION public.whatsapp_ingest_event(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    IF v_type = 'whatsapp.message' THEN
      v_phone := regexp_replace(coalesce(v_event->>'from', ''), '\D', '', 'g');

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
        v_conversation_id, v_provider_id, v_delivery_id, 'inbound',
        coalesce(nullif(v_event->>'message_type', ''), 'text'),
        v_body,
        nullif(v_event->>'media_provider_id', ''),
        nullif(v_event->>'reply_to_provider_id', ''),
        'delivered',
        coalesce(v_occurred, now()),
        coalesce(v_occurred, now()),
        coalesce(v_event->'raw', v_event)
      )
      ON CONFLICT (provider_message_id) DO NOTHING
      RETURNING id INTO v_message_id;

      IF v_message_id IS NOT NULL THEN
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
$$;

REVOKE ALL ON FUNCTION public.whatsapp_ingest_event(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_ingest_event(jsonb) TO service_role;