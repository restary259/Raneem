-- Transactional WhatsApp automation from existing DARB case events.
-- STAGED ONLY. Apply during the final Supabase migration pass.
-- Sends only approved UTILITY templates; no case status is changed here.

CREATE OR REPLACE FUNCTION public.queue_whatsapp_case_event_automation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_case_automation$
DECLARE
  v_purpose text;
  v_confirmation_template_id uuid;
  v_reminder_template_id uuid;
  v_conversation_id uuid;
  v_scheduled_at timestamptz;
  v_dedupe text;
  v_origin text;
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
    AND components::text NOT LIKE '%{{%'
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_confirmation_template_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_origin := CASE
    WHEN NEW.event_type IN ('appointment_scheduled','appointment_rescheduled') THEN 'appointment'
    ELSE 'case_event'
  END IF;

  IF NEW.event_type IN ('appointment_scheduled','appointment_rescheduled') THEN
    BEGIN
      v_scheduled_at := NULLIF(NEW.payload->>'scheduled_at', '')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      v_scheduled_at := NULL;
    END;

    -- Rescheduling must cancel only appointment-generated tasks; staff-created
    -- follow-ups stay untouched.
    IF NEW.event_type = 'appointment_rescheduled' THEN
      UPDATE public.whatsapp_follow_up_tasks
      SET status = 'cancelled', updated_at = now()
      WHERE conversation_id IN (
        SELECT c.id
        FROM public.whatsapp_conversations c
        JOIN public.whatsapp_leads wl ON wl.id = c.lead_id
        LEFT JOIN public.profiles p ON p.id = wl.linked_profile_id AND p.deleted_at IS NULL
        WHERE wl.linked_case_id = NEW.case_id
           OR p.case_id = NEW.case_id
           OR p.linked_case_id = NEW.case_id
      )
        AND origin = 'appointment'
        AND status IN ('pending','processing');
    END IF;
  END IF;

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

    INSERT INTO public.whatsapp_follow_up_tasks (
      conversation_id,
      kind,
      due_at,
      template_id,
      template_parameters,
      origin,
      dedupe_key,
      max_attempts
    )
    VALUES (
      v_conversation_id,
      'template',
      now(),
      v_confirmation_template_id,
      '[]'::jsonb,
      v_origin,
      v_dedupe || ':confirmation',
      3
    )
    ON CONFLICT (dedupe_key) DO NOTHING;

    IF v_scheduled_at IS NOT NULL THEN
      -- Keep reminder templates deliberately variable-free until DARB adds
      -- a centrally governed parameter mapping for approved Meta templates.
      SELECT id
      INTO v_reminder_template_id
      FROM public.whatsapp_templates
      WHERE purpose = 'appointment_reminder'
        AND approval_status = 'APPROVED'
        AND is_active = true
        AND category = 'UTILITY'
        AND components::text NOT LIKE '%{{%'
      ORDER BY updated_at DESC
      LIMIT 1;

      IF v_reminder_template_id IS NOT NULL AND v_scheduled_at - interval '24 hours' > now() THEN
        INSERT INTO public.whatsapp_follow_up_tasks (
          conversation_id, kind, due_at, template_id, template_parameters,
          origin, dedupe_key, max_attempts
        )
        VALUES (
          v_conversation_id, 'template', v_scheduled_at - interval '24 hours',
          v_reminder_template_id, '[]'::jsonb, 'appointment',
          v_dedupe || ':reminder24', 3
        )
        ON CONFLICT (dedupe_key) DO NOTHING;
      END IF;

      IF v_reminder_template_id IS NOT NULL AND v_scheduled_at - interval '2 hours' > now() THEN
        INSERT INTO public.whatsapp_follow_up_tasks (
          conversation_id, kind, due_at, template_id, template_parameters,
          origin, dedupe_key, max_attempts
        )
        VALUES (
          v_conversation_id, 'template', v_scheduled_at - interval '2 hours',
          v_reminder_template_id, '[]'::jsonb, 'appointment',
          v_dedupe || ':reminder2', 3
        )
        ON CONFLICT (dedupe_key) DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$whatsapp_case_automation$;

REVOKE ALL ON FUNCTION public.queue_whatsapp_case_event_automation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_whatsapp_case_event_automation() TO service_role;

DROP TRIGGER IF EXISTS queue_whatsapp_case_event_automation ON public.case_events;
CREATE TRIGGER queue_whatsapp_case_event_automation
AFTER INSERT ON public.case_events
FOR EACH ROW
EXECUTE FUNCTION public.queue_whatsapp_case_event_automation();
