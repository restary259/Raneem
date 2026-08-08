CREATE OR REPLACE FUNCTION public.edit_case_message(p_message_id uuid, p_body text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_msg public.case_messages%ROWTYPE;
  v_body text := btrim(coalesce(p_body, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_body = '' THEN RAISE EXCEPTION 'Message body cannot be empty'; END IF;
  IF length(v_body) > 5000 THEN RAISE EXCEPTION 'Message too long'; END IF;

  SELECT * INTO v_msg FROM public.case_messages WHERE id = p_message_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Message not found'; END IF;
  IF v_msg.author_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'You can only edit your own messages'; END IF;
  IF v_msg.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Message was deleted'; END IF;
  IF coalesce(v_msg.kind, 'text') NOT IN ('text', 'message') THEN RAISE EXCEPTION 'Only plain messages can be edited'; END IF;
  IF jsonb_array_length(coalesce(v_msg.attachments, '[]'::jsonb)) > 0 THEN RAISE EXCEPTION 'Messages with attachments cannot be edited'; END IF;
  IF v_msg.created_at < now() - interval '15 minutes' THEN RAISE EXCEPTION 'Edit window has expired'; END IF;

  UPDATE public.case_messages
     SET body = v_body,
         original_body = coalesce(original_body, v_msg.body),
         edited_at = now()
   WHERE id = p_message_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.edit_case_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.edit_direct_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_thread_read_state(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_case_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edit_direct_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_thread_read_state(text, uuid) TO authenticated;