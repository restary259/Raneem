ALTER TABLE public.case_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_body text,
  ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_body text,
  ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.edit_case_message(p_message_id uuid, p_body text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF coalesce(v_msg.kind, 'message') <> 'message' THEN RAISE EXCEPTION 'Only plain messages can be edited'; END IF;
  IF jsonb_array_length(coalesce(v_msg.attachments, '[]'::jsonb)) > 0 THEN RAISE EXCEPTION 'Messages with attachments cannot be edited'; END IF;
  IF v_msg.created_at < now() - interval '15 minutes' THEN RAISE EXCEPTION 'Edit window has expired'; END IF;

  UPDATE public.case_messages
     SET body = v_body,
         original_body = coalesce(original_body, v_msg.body),
         edited_at = now()
   WHERE id = p_message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.edit_direct_message(p_message_id uuid, p_body text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg public.direct_messages%ROWTYPE;
  v_body text := btrim(coalesce(p_body, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_body = '' THEN RAISE EXCEPTION 'Message body cannot be empty'; END IF;
  IF length(v_body) > 5000 THEN RAISE EXCEPTION 'Message too long'; END IF;

  SELECT * INTO v_msg FROM public.direct_messages WHERE id = p_message_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Message not found'; END IF;
  IF v_msg.author_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'You can only edit your own messages'; END IF;
  IF v_msg.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Message was deleted'; END IF;
  IF coalesce(v_msg.kind, 'message') <> 'message' THEN RAISE EXCEPTION 'Only plain messages can be edited'; END IF;
  IF jsonb_array_length(coalesce(v_msg.attachments, '[]'::jsonb)) > 0 THEN RAISE EXCEPTION 'Messages with attachments cannot be edited'; END IF;
  IF v_msg.created_at < now() - interval '15 minutes' THEN RAISE EXCEPTION 'Edit window has expired'; END IF;

  UPDATE public.direct_messages
     SET body = v_body,
         original_body = coalesce(original_body, v_msg.body),
         edited_at = now()
   WHERE id = p_message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_thread_read_state(p_kind text, p_id uuid)
RETURNS TABLE(user_id uuid, full_name text, last_read_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_kind = 'case' THEN
    IF NOT public.can_access_case_thread(p_id, auth.uid()) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    RETURN QUERY
      SELECT r.user_id, p.full_name, r.last_read_at
        FROM public.case_message_reads r
        LEFT JOIN public.profiles p ON p.id = r.user_id
       WHERE r.case_id = p_id;
  ELSIF p_kind = 'direct' THEN
    IF NOT public.is_direct_thread_member(p_id, auth.uid()) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    RETURN QUERY
      SELECT tp.user_id, p.full_name, tp.last_read_at
        FROM public.direct_thread_participants tp
        LEFT JOIN public.profiles p ON p.id = tp.user_id
       WHERE tp.thread_id = p_id;
  ELSE
    RAISE EXCEPTION 'Invalid thread kind';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.edit_case_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.edit_direct_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_thread_read_state(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_case_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edit_direct_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_thread_read_state(text, uuid) TO authenticated;