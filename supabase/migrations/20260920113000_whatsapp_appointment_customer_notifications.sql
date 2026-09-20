-- Customer-facing WhatsApp appointment automation.

-- Seed the Arabic appointment template definitions as PENDING drafts.
-- They become sendable only after the matching Meta templates are approved.
INSERT INTO public.whatsapp_templates (
  purpose, provider_name, language_code, category, approval_status,
  components, is_active, available_to_team
) VALUES
(
  'appointment_confirmation',
  'darb_appointment_confirmation_ar',
  'ar',
  'UTILITY',
  'PENDING',
  '[{"type":"BODY","text":"أهلاً وسهلاً! تم تأكيد موعدك مع فريق درب بخصوص الدراسة بألمانيا. الموعد مثبت عنا، وإذا احتجت أي تعديل، ابعتلنا."}]'::jsonb,
  true,
  false
),
(
  'appointment_reminder',
  'darb_appointment_reminder_ar',
  'ar',
  'UTILITY',
  'PENDING',
  '[{"type":"BODY","text":"أهلاً! تذكير من درب: عندك موعد معنا بكرا بخصوص الدراسة بألمانيا. إذا احتجت تغيّر الموعد، ابعتلنا."}]'::jsonb,
  true,
  false
)
ON CONFLICT DO NOTHING;


-- Repair the idempotency guard used by the live follow-up worker. Some earlier
-- deployments created the table but not this partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_follow_up_tasks_dedupe_idx
  ON public.whatsapp_follow_up_tasks (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

--
-- When a team member creates/reschedules an appointment:
--   1) resolve the case phone into the canonical WhatsApp lead/conversation,
--   2) queue an immediate Arabic UTILITY confirmation,
--   3) queue one Arabic UTILITY reminder exactly 24h before the appointment.
--
-- The existing WhatsApp follow-up worker/pg_cron dispatcher sends these tasks
-- through the connected DARB WhatsApp Business number. This migration does not
-- expose provider credentials to the browser and does not replace the existing
-- in-app/email appointment reminders for staff.
--
-- Only Arabic templates are eligible for this customer automation because the
-- current DARB WhatsApp audience for this workflow is Arab 48 students.

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

  -- Customer-facing appointment messages must use approved Arabic utility
  -- templates only. This intentionally ignores English/Hebrew templates.
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
  END IF;

  -- Appointment automation needs a customer conversation even when the person
  -- has never messaged the connected DARB WhatsApp number before.
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

    SELECT
      c.phone_number,
      c.full_name,
      c.assigned_to
    INTO
      v_phone,
      v_case_name,
      v_case_assigned_to
    FROM public.cases c
    WHERE c.id = NEW.case_id;

    v_phone := public.whatsapp_normalize_msisdn(v_phone);

    IF v_phone = '' OR length(v_phone) < 8 OR length(v_phone) > 15 THEN
      RETURN NEW;
    END IF;

    -- Rescheduling cancels only appointment-origin tasks; staff follow-ups
    -- remain untouched.
    IF NEW.event_type = 'appointment_rescheduled' THEN
      UPDATE public.whatsapp_follow_up_tasks
      SET status = 'cancelled',
          updated_at = now()
      WHERE origin = 'appointment'
        AND status IN ('pending','processing')
        AND conversation_id IN (
          SELECT wc.id
          FROM public.whatsapp_conversations wc
          JOIN public.whatsapp_leads wl ON wl.id = wc.lead_id
          WHERE public.whatsapp_normalize_msisdn(wl.whatsapp_number) = v_phone
        );
    END IF;

    -- Find the canonical WhatsApp lead for this phone. Existing local-format
    -- numbers (05...) are matched against their normalized MSISDN as well.
    SELECT wl.id
      INTO v_lead_id
    FROM public.whatsapp_leads wl
    WHERE wl.whatsapp_number = v_phone
       OR public.whatsapp_normalize_msisdn(wl.whatsapp_number) = v_phone
    ORDER BY CASE WHEN wl.whatsapp_number = v_phone THEN 0 ELSE 1 END,
             wl.created_at
    LIMIT 1
    FOR UPDATE;

    IF v_lead_id IS NULL THEN
      INSERT INTO public.whatsapp_leads (
        whatsapp_number,
        student_name,
        source,
        consent_status,
        lead_stage,
        linked_case_id,
        identity_confirmed_at
      )
      VALUES (
        v_phone,
        COALESCE(v_case_name, ''),
        'whatsapp',
        'unknown',
        'consultation_booked',
        NEW.case_id,
        now()
      )
      RETURNING id INTO v_lead_id;
    ELSE
      -- Link only when the lead is unlinked. Never overwrite a different
      -- confirmed case relationship just because the phone number matches.
      UPDATE public.whatsapp_leads
      SET
        student_name = CASE
          WHEN COALESCE(student_name, '') = '' THEN COALESCE(v_case_name, '')
          ELSE student_name
        END,
        linked_case_id = CASE
          WHEN linked_case_id IS NULL THEN NEW.case_id
          ELSE linked_case_id
        END,
        identity_confirmed_at = CASE
          WHEN linked_case_id IS NULL THEN now()
          ELSE identity_confirmed_at
        END,
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;

    SELECT id
      INTO v_conversation_id
    FROM public.whatsapp_conversations
    WHERE lead_id = v_lead_id
    LIMIT 1
    FOR UPDATE;

    IF v_conversation_id IS NULL THEN
      INSERT INTO public.whatsapp_conversations (
        lead_id,
        state,
        human_takeover,
        assigned_to,
        takeover_at
      )
      VALUES (
        v_lead_id,
        'new',
        true,
        v_case_assigned_to,
        now()
      )
      RETURNING id INTO v_conversation_id;
    ELSE
      -- Keep an existing assignment. Only fill the owner when the conversation
      -- is currently unassigned and the case already has an owner.
      IF v_case_assigned_to IS NOT NULL THEN
        UPDATE public.whatsapp_conversations
        SET assigned_to = COALESCE(assigned_to, v_case_assigned_to),
            updated_at = now()
        WHERE id = v_conversation_id;
      END IF;
    END IF;
  END IF;

  -- For non-appointment case events, preserve the existing conversation lookup.
  IF v_conversation_id IS NULL THEN
    FOR v_conversation_id IN
      SELECT c.id
      FROM public.whatsapp_conversations c
      JOIN public.whatsapp_leads wl ON wl.id = c.lead_id
      LEFT JOIN public.profiles p
        ON p.id = wl.linked_profile_id
       AND p.deleted_at IS NULL
      WHERE wl.linked_case_id = NEW.case_id
         OR p.case_id = NEW.case_id
         OR p.linked_case_id = NEW.case_id
    LOOP
      v_dedupe := 'case_event:' || NEW.id::text || ':' || NEW.event_type || ':' || v_conversation_id::text;

      IF v_confirmation_template_id IS NOT NULL THEN
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
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;

    RETURN NEW;
  END IF;

  -- Appointment confirmation: queued for the follow-up dispatcher to send
  -- through the connected DARB WhatsApp Business number.
  v_dedupe := 'case_event:' || NEW.id::text || ':' || NEW.event_type || ':' || v_conversation_id::text;

  IF v_confirmation_template_id IS NOT NULL THEN
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
      'appointment',
      v_dedupe || ':confirmation',
      3
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Exactly one customer-facing reminder: 24h before the appointment.
  -- Appointments created less than 24h ahead intentionally do not get a
  -- retroactive reminder.
  IF v_scheduled_at IS NOT NULL THEN
    SELECT id
      INTO v_reminder_template_id
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
        v_scheduled_at - interval '24 hours',
        v_reminder_template_id,
        '[]'::jsonb,
        'appointment',
        v_dedupe || ':reminder24',
        3
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

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
