-- 1. Quarantine table for events that fail processing (WA-002, WA-011)
CREATE TABLE IF NOT EXISTS public.whatsapp_ingest_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id text NOT NULL,
  event_type text,
  payload jsonb NOT NULL,
  error_code text,
  error_message text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.whatsapp_ingest_failures TO authenticated;
GRANT ALL ON public.whatsapp_ingest_failures TO service_role;

ALTER TABLE public.whatsapp_ingest_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read whatsapp ingest failures" ON public.whatsapp_ingest_failures;
CREATE POLICY "Admins read whatsapp ingest failures"
  ON public.whatsapp_ingest_failures FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins resolve whatsapp ingest failures" ON public.whatsapp_ingest_failures;
CREATE POLICY "Admins resolve whatsapp ingest failures"
  ON public.whatsapp_ingest_failures FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_whatsapp_ingest_failures_open
  ON public.whatsapp_ingest_failures (created_at DESC) WHERE resolved_at IS NULL;

-- 2. Drain parked delivery receipts for EVERY message insert path (WA-001).
--    The connector writes app-sent messages outside whatsapp_ingest_event, so
--    an inline drain there can never reach them. A trigger can.
CREATE OR REPLACE FUNCTION public.whatsapp_drain_pending_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pending record;
BEGIN
  IF NEW.provider_message_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_pending
  FROM public.whatsapp_pending_statuses
  WHERE provider_message_id = NEW.provider_message_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.whatsapp_messages
  SET delivery_status = v_pending.delivery_status,
      status_updated_at = coalesce(v_pending.status_updated_at, status_updated_at),
      error_status = coalesce(v_pending.error_status, error_status),
      error_message = coalesce(v_pending.error_message, error_message)
  WHERE id = NEW.id
    AND public.whatsapp_status_rank(v_pending.delivery_status)
        > public.whatsapp_status_rank(delivery_status);

  DELETE FROM public.whatsapp_pending_statuses
  WHERE provider_message_id = NEW.provider_message_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_whatsapp_drain_pending_status ON public.whatsapp_messages;
CREATE TRIGGER trg_whatsapp_drain_pending_status
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_drain_pending_status();

-- 3. Fix the malformed CASE expression that would abort the first appointment
--    booking once it executed (WA-004). Only line `v_origin := CASE ... END;`
--    changed; the rest is the live body verbatim.
CREATE OR REPLACE FUNCTION public.queue_whatsapp_case_event_automation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_purpose text;
  v_confirmation_template_id uuid;
  v_reminder_template_id uuid;
  v_conversation_id uuid;
  v_lead_id uuid;
  v_scheduled_at timestamptz;
  v_dedupe text;
  v_origin text;
  v_phone text;
  v_case_name text;
  v_case_assigned_to uuid;
BEGIN
  v_purpose := CASE NEW.event_type
    WHEN 'payment_received' THEN 'payment_confirmed'
    WHEN 'case_submitted' THEN 'application_submitted'
    WHEN 'enrollment_paid' THEN 'enrollment_confirmation'
    WHEN 'document_requested' THEN 'documents_missing'
    WHEN 'student_account_created' THEN 'student_welcome'
    WHEN 'appointment_scheduled' THEN 'appointment_confirmation'
    WHEN 'appointment_rescheduled' THEN 'appointment_confirmation'
    ELSE NULL
  END;

  IF v_purpose IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id
    INTO v_confirmation_template_id
  FROM public.whatsapp_templates
  WHERE purpose = v_purpose
    AND approval_status = 'APPROVED'
    AND is_active = true
    AND category = 'UTILITY'
    AND lower(language_code) LIKE 'ar%'
    AND components::text NOT LIKE '%{{%'
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_confirmation_template_id IS NULL
     AND NEW.event_type NOT IN ('appointment_scheduled','appointment_rescheduled') THEN
    RETURN NEW;
  END IF;

  v_origin := CASE
    WHEN NEW.event_type IN ('appointment_scheduled','appointment_rescheduled') THEN 'appointment'
    ELSE 'case_event'
  END;

  IF NEW.event_type IN ('appointment_scheduled','appointment_rescheduled') THEN
    BEGIN
      v_scheduled_at := NULLIF(
        CASE
          WHEN NEW.event_type = 'appointment_rescheduled' THEN NEW.payload->>'to'
          ELSE NEW.payload->>'scheduled_at'
        END,
        ''
      )::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      v_scheduled_at := NULL;
    END;

    SELECT c.phone_number, c.full_name, c.assigned_to
      INTO v_phone, v_case_name, v_case_assigned_to
    FROM public.cases c
    WHERE c.id = NEW.case_id;

    v_phone := public.whatsapp_normalize_msisdn(v_phone);

    IF v_phone = '' OR length(v_phone) < 8 OR length(v_phone) > 15 THEN
      RETURN NEW;
    END IF;

    IF NEW.event_type = 'appointment_rescheduled' THEN
      UPDATE public.whatsapp_follow_up_tasks
      SET status = 'cancelled', updated_at = now()
      WHERE origin = 'appointment'
        AND status IN ('pending','processing')
        AND conversation_id IN (
          SELECT wc.id FROM public.whatsapp_conversations wc
          JOIN public.whatsapp_leads wl ON wl.id = wc.lead_id
          WHERE public.whatsapp_normalize_msisdn(wl.whatsapp_number) = v_phone
        );
    END IF;

    SELECT wl.id INTO v_lead_id
    FROM public.whatsapp_leads wl
    WHERE wl.whatsapp_number = v_phone
       OR public.whatsapp_normalize_msisdn(wl.whatsapp_number) = v_phone
    ORDER BY CASE WHEN wl.whatsapp_number = v_phone THEN 0 ELSE 1 END, wl.created_at
    LIMIT 1
    FOR UPDATE;

    IF v_lead_id IS NULL THEN
      INSERT INTO public.whatsapp_leads (
        whatsapp_number, student_name, source, consent_status, lead_stage,
        linked_case_id, identity_confirmed_at
      )
      VALUES (v_phone, COALESCE(v_case_name, ''), 'whatsapp', 'unknown',
              'consultation_booked', NEW.case_id, now())
      RETURNING id INTO v_lead_id;
    ELSE
      UPDATE public.whatsapp_leads
      SET student_name = CASE
            WHEN COALESCE(student_name, '') = '' THEN COALESCE(v_case_name, '')
            ELSE student_name END,
          linked_case_id = CASE
            WHEN linked_case_id IS NULL THEN NEW.case_id ELSE linked_case_id END,
          identity_confirmed_at = CASE
            WHEN linked_case_id IS NULL THEN now() ELSE identity_confirmed_at END,
          updated_at = now()
      WHERE id = v_lead_id;
    END IF;

    SELECT id INTO v_conversation_id
    FROM public.whatsapp_conversations
    WHERE lead_id = v_lead_id
    LIMIT 1
    FOR UPDATE;

    IF v_conversation_id IS NULL THEN
      INSERT INTO public.whatsapp_conversations (lead_id, state, human_takeover, assigned_to, takeover_at)
      VALUES (v_lead_id, 'new', true, v_case_assigned_to, now())
      RETURNING id INTO v_conversation_id;
    ELSE
      IF v_case_assigned_to IS NOT NULL THEN
        UPDATE public.whatsapp_conversations
        SET assigned_to = COALESCE(assigned_to, v_case_assigned_to), updated_at = now()
        WHERE id = v_conversation_id;
      END IF;
    END IF;
  END IF;

  IF v_conversation_id IS NULL THEN
    FOR v_conversation_id IN
      SELECT c.id
      FROM public.whatsapp_conversations c
      JOIN public.whatsapp_leads wl ON wl.id = c.lead_id
      LEFT JOIN public.profiles p ON p.id = wl.linked_profile_id AND p.deleted_at IS NULL
      WHERE wl.linked_case_id = NEW.case_id
         OR p.case_id = NEW.case_id
         OR p.linked_case_id = NEW.case_id
    LOOP
      v_dedupe := 'case_event:' || NEW.id::text || ':' || NEW.event_type || ':' || v_conversation_id::text;

      IF v_confirmation_template_id IS NOT NULL THEN
        INSERT INTO public.whatsapp_follow_up_tasks (
          conversation_id, kind, due_at, template_id, template_parameters,
          origin, dedupe_key, max_attempts
        )
        VALUES (v_conversation_id, 'template', now(), v_confirmation_template_id,
                '[]'::jsonb, v_origin, v_dedupe || ':confirmation', 3)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;

    RETURN NEW;
  END IF;

  v_dedupe := 'case_event:' || NEW.id::text || ':' || NEW.event_type || ':' || v_conversation_id::text;

  IF v_confirmation_template_id IS NOT NULL THEN
    INSERT INTO public.whatsapp_follow_up_tasks (
      conversation_id, kind, due_at, template_id, template_parameters,
      origin, dedupe_key, max_attempts
    )
    VALUES (v_conversation_id, 'template', now(), v_confirmation_template_id,
            '[]'::jsonb, 'appointment', v_dedupe || ':confirmation', 3)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_scheduled_at IS NOT NULL THEN
    SELECT id INTO v_reminder_template_id
    FROM public.whatsapp_templates
    WHERE purpose = 'appointment_reminder'
      AND approval_status = 'APPROVED'
      AND is_active = true
      AND category = 'UTILITY'
      AND lower(language_code) LIKE 'ar%'
      AND components::text NOT LIKE '%{{%'
    ORDER BY updated_at DESC
    LIMIT 1;

    IF v_reminder_template_id IS NOT NULL
       AND v_scheduled_at - interval '24 hours' > now() THEN
      INSERT INTO public.whatsapp_follow_up_tasks (
        conversation_id, kind, due_at, template_id, template_parameters,
        origin, dedupe_key, max_attempts
      )
      VALUES (v_conversation_id, 'template', v_scheduled_at - interval '24 hours',
              v_reminder_template_id, '[]'::jsonb, 'appointment',
              v_dedupe || ':reminder24', 3)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Ingest: isolate each event so one bad event cannot block the inbox
--    (WA-002) and keep the sender's name (WA-006).
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
  v_contact_name text;
  v_lead_id uuid;
  v_conversation_id uuid;
  v_provider_id text;
  v_body text;
  v_occurred timestamptz;
  v_status text;
  v_message_type text;
  v_existing_rank integer;
  v_existing_at timestamptz;
  v_message_id uuid;
BEGIN
  IF v_delivery_id IS NULL THEN
    RAISE EXCEPTION 'delivery_id is required';
  END IF;

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

    -- Each event runs in its own subtransaction. A failing event is
    -- quarantined instead of rolling back the whole delivery, which would
    -- also roll back the dedup ledger row and cause an endless retry.
    BEGIN
      v_provider_id := nullif(v_event->>'provider_message_id', '');
      v_occurred := nullif(v_event->>'occurred_at', '')::timestamptz;
      v_message_id := NULL;

      IF v_type IN ('whatsapp.message', 'whatsapp.message_echo') THEN
        v_phone := public.whatsapp_normalize_msisdn(v_event->>'from');
        v_contact_name := left(coalesce(nullif(trim(v_event->>'contact_name'), ''), ''), 160);

        IF v_phone = '' OR v_provider_id IS NULL THEN
          INSERT INTO public.whatsapp_ingest_log (delivery_id, event_type, payload)
          VALUES (v_delivery_id, 'message.incomplete', v_event);
          v_results := v_results || jsonb_build_object('event_type', v_type, 'result', 'skipped');
          CONTINUE;
        END IF;

        INSERT INTO public.whatsapp_leads (whatsapp_number, student_name, source, consent_status, lead_stage)
        VALUES (v_phone, v_contact_name, 'whatsapp', 'unknown', 'new')
        ON CONFLICT (whatsapp_number) DO NOTHING;

        SELECT id INTO v_lead_id FROM public.whatsapp_leads WHERE whatsapp_number = v_phone;

        -- Fill a blank name once the customer's profile name arrives.
        -- Never overwrite a name staff already corrected.
        IF v_contact_name <> '' AND v_type = 'whatsapp.message' THEN
          UPDATE public.whatsapp_leads
          SET student_name = v_contact_name, updated_at = now()
          WHERE id = v_lead_id AND coalesce(student_name, '') = '';
        END IF;

        INSERT INTO public.whatsapp_conversations (lead_id, state)
        VALUES (v_lead_id, 'new')
        ON CONFLICT (lead_id) DO NOTHING;

        SELECT id INTO v_conversation_id FROM public.whatsapp_conversations WHERE lead_id = v_lead_id;

        v_body := coalesce(v_event->>'text', '');

        -- An unrecognised message kind is stored as 'system' rather than
        -- violating the allowlist and poisoning the delivery.
        v_message_type := lower(coalesce(nullif(v_event->>'message_type', ''), 'text'));
        IF v_message_type NOT IN ('text','template','system','image','video','audio','document',
                                  'sticker','location','contacts','reaction','interactive','button','list') THEN
          v_message_type := 'system';
        END IF;

        INSERT INTO public.whatsapp_messages (
          conversation_id, provider_message_id, delivery_id, direction, message_type,
          body, media_provider_id, reply_to_provider_id, delivery_status,
          sent_at, status_updated_at, raw_payload
        )
        VALUES (
          v_conversation_id, v_provider_id, v_delivery_id,
          CASE WHEN v_type = 'whatsapp.message_echo' THEN 'outbound' ELSE 'inbound' END,
          v_message_type,
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

        -- Parked receipts are drained by trg_whatsapp_drain_pending_status,
        -- which covers app-sent messages too.

        v_results := v_results || jsonb_build_object('event_type', v_type, 'result',
          CASE WHEN v_message_id IS NULL THEN 'duplicate' ELSE 'stored' END);

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

      ELSE
        INSERT INTO public.whatsapp_ingest_log (delivery_id, event_type, payload)
        VALUES (v_delivery_id, v_type, v_event);
        v_results := v_results || jsonb_build_object('event_type', v_type, 'result', 'logged');
      END IF;

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.whatsapp_ingest_failures (
        delivery_id, event_type, payload, error_code, error_message
      )
      VALUES (v_delivery_id, v_type, v_event, SQLSTATE, SQLERRM);

      v_results := v_results || jsonb_build_object('event_type', v_type, 'result', 'quarantined');
    END;
  END LOOP;

  RETURN jsonb_build_object('status', 'ok', 'delivery_id', v_delivery_id, 'events', v_results);
END;
$function$;

-- 5. Backfill: apply receipts that were parked for messages that already exist.
UPDATE public.whatsapp_messages m
SET delivery_status = p.delivery_status,
    status_updated_at = coalesce(p.status_updated_at, m.status_updated_at),
    error_status = coalesce(p.error_status, m.error_status),
    error_message = coalesce(p.error_message, m.error_message)
FROM public.whatsapp_pending_statuses p
WHERE p.provider_message_id = m.provider_message_id
  AND public.whatsapp_status_rank(p.delivery_status) > public.whatsapp_status_rank(m.delivery_status);

DELETE FROM public.whatsapp_pending_statuses p
USING public.whatsapp_messages m
WHERE m.provider_message_id = p.provider_message_id;