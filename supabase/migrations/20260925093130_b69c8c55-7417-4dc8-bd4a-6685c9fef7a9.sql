CREATE OR REPLACE FUNCTION public.notify_whatsapp_inbound()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $f$
DECLARE
  v_assigned uuid; v_name text; v_body text; v_recipient uuid; v_link text;
BEGIN
  IF NEW.direction <> 'inbound' THEN RETURN NEW; END IF;
  SELECT c.assigned_to,
         COALESCE(NULLIF(l.student_name, ''), l.whatsapp_number),
         left(COALESCE(NULLIF(NEW.body, ''), 'رسالة جديدة'), 160)
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
      COALESCE(v_name, 'WhatsApp contact'), COALESCE(v_name, 'جهة اتصال واتساب'),
      v_body, v_body, NULL, v_link,
      'whatsapp_inbound:' || NEW.id::text || ':' || v_assigned::text);
  ELSE
    FOR v_recipient IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'::app_role LOOP
      PERFORM public.emit_notification(
        v_recipient, NULL, 'whatsapp_inbound',
        COALESCE(v_name, 'WhatsApp contact'), COALESCE(v_name, 'جهة اتصال واتساب'),
        v_body, v_body, NULL,
        '/admin/messages?tab=whatsapp&conversation=' || NEW.conversation_id::text,
        'whatsapp_inbound:' || NEW.id::text || ':' || v_recipient::text);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$f$;
REVOKE ALL ON FUNCTION public.notify_whatsapp_inbound() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_whatsapp_inbound() TO service_role;