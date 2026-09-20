-- WhatsApp notification targeting + after-hours acknowledgement.
-- STAGED ONLY. Apply with the final Supabase migration pass.
-- Uses the existing emit_notification() writer; never inserts notifications directly.

CREATE OR REPLACE FUNCTION public.notification_category_for_source(_source text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _source IN ('direct_message', 'case_message', 'chat', 'whatsapp_inbound') THEN 'messages'
    WHEN _source IN ('appointment', 'appointment_reminder') THEN 'appointments'
    WHEN _source IN ('case', 'case_status', 'case_event', 'student_profile_updated',
                     'case_created', 'case_assigned', 'case_submitted') THEN 'cases'
    WHEN _source IN ('payout', 'payment', 'commission', 'enrollment') THEN 'payments'
    WHEN _source IN ('document', 'document_request', 'document_uploaded') THEN 'documents'
    WHEN _source IN ('profile', 'profile_incomplete') THEN 'profile'
    WHEN _source IN ('recruit', 'recruitment', 'partner_recruit', 'recruit_application') THEN 'recruitment'
    ELSE 'system'
  END
$function$;

CREATE OR REPLACE FUNCTION public.notify_whatsapp_inbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_notify$
DECLARE
  v_assigned uuid;
  v_name text;
  v_body text;
  v_recipient uuid;
  v_link text;
BEGIN
  IF NEW.direction <> 'inbound' THEN
    RETURN NEW;
  END IF;

  SELECT c.assigned_to,
         COALESCE(NULLIF(l.student_name, ''), l.whatsapp_number),
         left(COALESCE(NULLIF(NEW.body, ''), 'New WhatsApp message'), 160)
    INTO v_assigned, v_name, v_body
  FROM public.whatsapp_conversations c
  JOIN public.whatsapp_leads l ON l.id = c.lead_id
  WHERE c.id = NEW.conversation_id;

  IF v_assigned IS NOT NULL THEN
    IF public.has_role(v_assigned, 'admin'::app_role) THEN
      v_link := '/admin/messages?tab=whatsapp&conversation=' || NEW.conversation_id::text;
    ELSE
      v_link := '/team/messages?tab=whatsapp&conversation=' || NEW.conversation_id::text;
    END IF;

    PERFORM public.emit_notification(
      v_assigned, NULL, 'whatsapp_inbound',
      'New WhatsApp message', 'رسالة واتساب جديدة',
      COALESCE(v_name, 'WhatsApp contact') || ': ' || v_body,
      COALESCE(v_name, 'جهة اتصال واتساب') || ': ' || v_body,
      NULL, v_link,
      'whatsapp_inbound:' || NEW.id::text || ':' || v_assigned::text
    );
  ELSE
    FOR v_recipient IN
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role = 'admin'::app_role
    LOOP
      PERFORM public.emit_notification(
        v_recipient, NULL, 'whatsapp_inbound',
        'New WhatsApp message', 'رسالة واتساب جديدة',
        COALESCE(v_name, 'WhatsApp contact') || ': ' || v_body,
        COALESCE(v_name, 'جهة اتصال واتساب') || ': ' || v_body,
        NULL,
        '/admin/messages?tab=whatsapp&conversation=' || NEW.conversation_id::text,
        'whatsapp_inbound:' || NEW.id::text || ':' || v_recipient::text
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$whatsapp_notify$;

REVOKE ALL ON FUNCTION public.notify_whatsapp_inbound() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_whatsapp_inbound() TO service_role;

-- During DARB office hours (Sunday–Thursday, 10:00–19:00 Jerusalem time)
-- staff should respond normally. Outside hours, queue a single service
-- acknowledgement only when an approved utility template exists.
CREATE OR REPLACE FUNCTION public.queue_whatsapp_after_hours_ack()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_after_hours$
DECLARE
  v_template_id uuid;
  v_is_open boolean;
  v_local_time time;
  v_dow integer;
BEGIN
  IF NEW.direction <> 'inbound' THEN
    RETURN NEW;
  END IF;

  SELECT EXTRACT(DOW FROM (NEW.created_at AT TIME ZONE 'Asia/Jerusalem'))::integer,
         (NEW.created_at AT TIME ZONE 'Asia/Jerusalem')::time
    INTO v_dow, v_local_time;

  v_is_open := v_dow BETWEEN 0 AND 4
    AND v_local_time >= time '10:00'
    AND v_local_time < time '19:00';

  IF v_is_open THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_template_id
  FROM public.whatsapp_templates
  WHERE purpose = 'lead_received'
    AND approval_status = 'APPROVED'
    AND is_active = true
    AND category = 'UTILITY'
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_template_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.whatsapp_follow_up_tasks (
    conversation_id,
    kind,
    due_at,
    template_id,
    template_parameters,
    max_attempts
  )
  SELECT
    NEW.conversation_id,
    'template',
    now(),
    v_template_id,
    '[]'::jsonb,
    3
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.whatsapp_follow_up_tasks t
    WHERE t.conversation_id = NEW.conversation_id
      AND t.kind = 'template'
      AND t.template_id = v_template_id
      AND t.status IN ('pending','processing')
  );

  RETURN NEW;
END;
$whatsapp_after_hours$;

REVOKE ALL ON FUNCTION public.queue_whatsapp_after_hours_ack() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_whatsapp_after_hours_ack() TO service_role;

DROP TRIGGER IF EXISTS queue_whatsapp_after_hours_ack ON public.whatsapp_messages;
CREATE TRIGGER queue_whatsapp_after_hours_ack
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION public.queue_whatsapp_after_hours_ack();
