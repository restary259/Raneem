-- Application-received WhatsApp automation fixes (2026-09-26)
-- 1) Resolve the 4 variables of the approved application_submitted template.
-- 2) Fire on a new 'application_received' case event (logged by create-case-from-apply).
-- 3) Resolve the WhatsApp lead/conversation from the case phone for EVERY mapped
--    event, not only appointments, so first-time applicants are reachable.

CREATE OR REPLACE FUNCTION public.whatsapp_resolve_template_params(
  p_template_id uuid, p_case_id uuid, p_scheduled_at timestamptz, p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_purpose text; v_components text; v_count int; v_name text;
  v_values text[]; v_detail text; i int;
  v_ref text; v_major text;
BEGIN
  SELECT purpose, components::text INTO v_purpose, v_components
  FROM whatsapp_templates WHERE id = p_template_id;
  IF v_purpose IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(max((m[1])::int), 0) INTO v_count
  FROM regexp_matches(coalesce(v_components,''), '\{\{\s*(\d+)\s*\}\}', 'g') AS m;
  IF v_count = 0 THEN RETURN '[]'::jsonb; END IF;

  SELECT nullif(split_part(trim(coalesce(full_name,'')), ' ', 1), '') INTO v_name
  FROM cases WHERE id = p_case_id;

  IF v_purpose IN ('appointment_confirmation','appointment_reminder','appointment_rescheduled','consultation_confirmation') THEN
    v_values := ARRAY[
      v_name,
      CASE WHEN p_scheduled_at IS NULL THEN NULL ELSE to_char(p_scheduled_at AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') END,
      CASE WHEN p_scheduled_at IS NULL THEN NULL ELSE to_char(p_scheduled_at AT TIME ZONE 'Europe/Berlin', 'HH24:MI') END
    ];
  ELSIF v_purpose = 'application_submitted' THEN
    -- Template blanks: {{1}} name, {{2}} application number, {{3}} major, {{4}} institution.
    -- Major/institution are not collected at apply time; use honest fallbacks.
    SELECT nullif(coalesce(c.case_reference,''), ''),
           nullif(coalesce(c.degree_interest,''), '')
    INTO v_ref, v_major
    FROM cases c WHERE c.id = p_case_id;
    v_values := ARRAY[
      v_name,
      coalesce(v_ref, ''),
      coalesce(v_major, 'لم يُحدد بعد'),
      'لم تُحدد بعد'
    ];
  ELSE
    v_detail := nullif(coalesce(p_payload->>'document_name', p_payload->>'title', p_payload->>'amount', p_payload->>'school_name'), '');
    v_values := ARRAY[v_name, v_detail];
  END IF;

  IF v_count > coalesce(array_length(v_values,1),0) THEN RETURN NULL; END IF;
  FOR i IN 1..v_count LOOP
    IF v_values[i] IS NULL THEN RETURN NULL; END IF;
  END LOOP;
  RETURN to_jsonb(v_values[1:v_count]);
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_resolve_template_params(uuid,uuid,timestamptz,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_resolve_template_params(uuid,uuid,timestamptz,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.queue_whatsapp_case_event_automation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_purpose text; v_confirmation_template_id uuid; v_reminder_template_id uuid;
  v_conversation_id uuid; v_lead_id uuid; v_scheduled_at timestamptz; v_dedupe text;
  v_origin text; v_phone text; v_case_name text; v_case_assigned_to uuid;
BEGIN
  v_purpose := CASE NEW.event_type
    WHEN 'application_received' THEN 'application_submitted'
    WHEN 'payment_received' THEN 'payment_confirmed'
    WHEN 'case_submitted' THEN 'application_submitted'
    WHEN 'enrollment_paid' THEN 'enrollment_confirmation'
    WHEN 'document_requested' THEN 'documents_missing'
    WHEN 'document_uploaded' THEN 'document_received'
    WHEN 'changes_requested' THEN 'application_update'
    WHEN 'student_account_created' THEN 'student_welcome'
    WHEN 'appointment_scheduled' THEN 'appointment_confirmation'
    WHEN 'appointment_rescheduled' THEN 'appointment_rescheduled'
    WHEN 'stage_advanced' THEN CASE WHEN NEW.payload->>'to' = 'profile_completion' THEN 'payment_instruction' END
    ELSE NULL
  END;
  IF v_purpose IS NULL THEN RETURN NEW; END IF;

  v_confirmation_template_id := whatsapp_pick_template(v_purpose);
  IF v_confirmation_template_id IS NULL AND v_purpose = 'appointment_rescheduled' THEN
    v_confirmation_template_id := whatsapp_pick_template('appointment_confirmation');
  END IF;
  IF v_confirmation_template_id IS NULL THEN RETURN NEW; END IF;

  v_origin := CASE WHEN NEW.event_type IN ('appointment_scheduled','appointment_rescheduled') THEN 'appointment' ELSE 'case_event' END;

  -- Resolve the customer's WhatsApp lead/conversation from the case phone for
  -- every automated event, so first-time applicants are reachable too.
  IF NEW.event_type IN ('appointment_scheduled','appointment_rescheduled') THEN
    BEGIN
      v_scheduled_at := NULLIF(CASE WHEN NEW.event_type = 'appointment_rescheduled' THEN NEW.payload->>'to'
                                    ELSE NEW.payload->>'scheduled_at' END, '')::timestamptz;
    EXCEPTION WHEN OTHERS THEN v_scheduled_at := NULL; END;
  END IF;

  SELECT c.phone_number, c.full_name, c.assigned_to INTO v_phone, v_case_name, v_case_assigned_to
  FROM public.cases c WHERE c.id = NEW.case_id;
  v_phone := public.whatsapp_normalize_msisdn(v_phone);
  IF v_phone = '' OR length(v_phone) < 8 OR length(v_phone) > 15 THEN RETURN NEW; END IF;

  IF NEW.event_type = 'appointment_rescheduled' THEN
    UPDATE public.whatsapp_follow_up_tasks SET status = 'cancelled', updated_at = now()
    WHERE origin = 'appointment' AND status IN ('pending','processing')
      AND conversation_id IN (SELECT wc.id FROM public.whatsapp_conversations wc
        JOIN public.whatsapp_leads wl ON wl.id = wc.lead_id
        WHERE public.whatsapp_normalize_msisdn(wl.whatsapp_number) = v_phone);
  END IF;

  SELECT wl.id INTO v_lead_id FROM public.whatsapp_leads wl
  WHERE wl.whatsapp_number = v_phone OR public.whatsapp_normalize_msisdn(wl.whatsapp_number) = v_phone
  ORDER BY CASE WHEN wl.whatsapp_number = v_phone THEN 0 ELSE 1 END, wl.created_at
  LIMIT 1 FOR UPDATE;

  IF v_lead_id IS NULL THEN
    INSERT INTO public.whatsapp_leads (whatsapp_number, student_name, source, consent_status, lead_stage, linked_case_id, identity_confirmed_at)
    VALUES (v_phone, COALESCE(v_case_name, ''), 'whatsapp', 'unknown', 'new', NEW.case_id, now())
    RETURNING id INTO v_lead_id;
  ELSE
    UPDATE public.whatsapp_leads
    SET student_name = CASE WHEN COALESCE(student_name, '') = '' THEN COALESCE(v_case_name, '') ELSE student_name END,
        linked_case_id = CASE WHEN linked_case_id IS NULL THEN NEW.case_id ELSE linked_case_id END,
        identity_confirmed_at = CASE WHEN linked_case_id IS NULL THEN now() ELSE identity_confirmed_at END,
        updated_at = now()
    WHERE id = v_lead_id;
  END IF;

  SELECT id INTO v_conversation_id FROM public.whatsapp_conversations WHERE lead_id = v_lead_id LIMIT 1 FOR UPDATE;
  IF v_conversation_id IS NULL THEN
    INSERT INTO public.whatsapp_conversations (lead_id, state, human_takeover, assigned_to, takeover_at)
    VALUES (v_lead_id, 'new', true, v_case_assigned_to, now()) RETURNING id INTO v_conversation_id;
  ELSIF v_case_assigned_to IS NOT NULL THEN
    UPDATE public.whatsapp_conversations SET assigned_to = COALESCE(assigned_to, v_case_assigned_to), updated_at = now()
    WHERE id = v_conversation_id;
  END IF;

  -- Queue the confirmation/immediate template to the phone-resolved conversation
  -- plus any other conversations already linked to this case (dedupe keys differ
  -- per conversation, and each conversation belongs to a distinct lead/phone).
  FOR v_conversation_id IN
    SELECT DISTINCT cid FROM (
      SELECT v_conversation_id AS cid
      UNION
      SELECT c.id FROM public.whatsapp_conversations c
      JOIN public.whatsapp_leads wl ON wl.id = c.lead_id
      LEFT JOIN public.profiles p ON p.id = wl.linked_profile_id AND p.deleted_at IS NULL
      WHERE wl.linked_case_id = NEW.case_id OR p.case_id = NEW.case_id OR p.linked_case_id = NEW.case_id
    ) s WHERE cid IS NOT NULL
  LOOP
    v_dedupe := 'case_event:' || NEW.id::text || ':' || NEW.event_type || ':' || v_conversation_id::text;
    PERFORM whatsapp_queue_template_task(v_conversation_id, v_confirmation_template_id, now(), v_origin,
      v_dedupe || ':confirmation', NEW.case_id, v_scheduled_at, NEW.payload);

    IF v_scheduled_at IS NOT NULL THEN
      v_reminder_template_id := whatsapp_pick_template('appointment_reminder');
      IF v_reminder_template_id IS NOT NULL AND v_scheduled_at - interval '24 hours' > now() THEN
        PERFORM whatsapp_queue_template_task(v_conversation_id, v_reminder_template_id,
          v_scheduled_at - interval '24 hours', 'appointment', v_dedupe || ':reminder24',
          NEW.case_id, v_scheduled_at, NEW.payload);
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.queue_whatsapp_case_event_automation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_whatsapp_case_event_automation() TO service_role;

DROP TRIGGER IF EXISTS queue_whatsapp_case_event_automation ON public.case_events;
CREATE TRIGGER queue_whatsapp_case_event_automation
AFTER INSERT ON public.case_events
FOR EACH ROW
EXECUTE FUNCTION public.queue_whatsapp_case_event_automation();