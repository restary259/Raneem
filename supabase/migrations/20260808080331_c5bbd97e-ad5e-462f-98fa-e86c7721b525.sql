-- 1. Message columns -------------------------------------------------------
ALTER TABLE public.case_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS request_status text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS request_status text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. Mutes ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_thread_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  thread_type text NOT NULL CHECK (thread_type IN ('case','direct')),
  thread_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, thread_type, thread_id)
);
GRANT SELECT, INSERT, DELETE ON public.message_thread_mutes TO authenticated;
GRANT ALL ON public.message_thread_mutes TO service_role;
ALTER TABLE public.message_thread_mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own mutes" ON public.message_thread_mutes
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. Helpers ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_case_thread(_case_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR EXISTS (SELECT 1 FROM public.cases c
                 WHERE c.id = _case_id
                   AND (c.assigned_to = _user_id OR c.student_user_id = _user_id));
$$;
REVOKE EXECUTE ON FUNCTION public.can_access_case_thread(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_case_thread(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_chat_attachments(_att jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v jsonb := COALESCE(_att, '[]'::jsonb);
  item jsonb;
BEGIN
  IF jsonb_typeof(v) <> 'array' THEN RAISE EXCEPTION 'Attachments must be a list'; END IF;
  IF jsonb_array_length(v) > 5 THEN RAISE EXCEPTION 'Too many attachments'; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(v) LOOP
    IF COALESCE(item->>'path','') = '' OR COALESCE(item->>'name','') = '' THEN
      RAISE EXCEPTION 'Attachment is missing a file';
    END IF;
    IF COALESCE((item->>'size')::bigint, 0) > 15728640 THEN
      RAISE EXCEPTION 'File is larger than 15MB';
    END IF;
    IF COALESCE(item->>'mime','') NOT IN (
      'image/png','image/jpeg','image/webp','image/gif','application/pdf',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ) THEN
      RAISE EXCEPTION 'File type not allowed';
    END IF;
  END LOOP;
  RETURN v;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_chat_attachments(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_chat_attachments(jsonb) TO authenticated, service_role;

-- 4. send_case_message with attachments + requests --------------------------
CREATE OR REPLACE FUNCTION public.send_case_message(
  p_case_id uuid, p_body text, p_visibility text DEFAULT 'shared',
  p_attachments jsonb DEFAULT '[]'::jsonb, p_kind text DEFAULT 'text')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_name text;
  v_case record;
  v_visibility text;
  v_kind text := CASE WHEN p_kind = 'request' THEN 'request' ELSE 'text' END;
  v_att jsonb := public.validate_chat_attachments(p_attachments);
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF (p_body IS NULL OR btrim(p_body) = '') AND jsonb_array_length(v_att) = 0 THEN
    RAISE EXCEPTION 'Message body required';
  END IF;
  IF length(COALESCE(p_body,'')) > 5000 THEN RAISE EXCEPTION 'Message too long'; END IF;

  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  IF v_case IS NULL THEN RAISE EXCEPTION 'Case not found'; END IF;

  SELECT role::text INTO v_role FROM public.user_roles WHERE user_id = v_uid
  ORDER BY CASE role::text WHEN 'admin' THEN 1 WHEN 'team_member' THEN 2 WHEN 'student' THEN 3 ELSE 4 END
  LIMIT 1;

  IF v_role = 'admin' THEN
    v_visibility := COALESCE(p_visibility, 'shared');
  ELSIF v_role = 'team_member' AND v_case.assigned_to = v_uid THEN
    v_visibility := COALESCE(p_visibility, 'shared');
  ELSIF v_case.student_user_id = v_uid THEN
    v_visibility := 'shared';
    v_role := 'student';
    v_kind := 'text';
  ELSE
    RAISE EXCEPTION 'Not allowed to message this case';
  END IF;

  IF v_visibility NOT IN ('internal','shared') THEN v_visibility := 'shared'; END IF;
  IF v_kind = 'request' THEN v_visibility := 'shared'; END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.case_messages (case_id, author_id, author_role, author_name, body, visibility, attachments, kind, request_status)
  VALUES (p_case_id, v_uid, v_role, v_name, btrim(COALESCE(p_body,'')), v_visibility, v_att, v_kind,
          CASE WHEN v_kind = 'request' THEN 'pending' ELSE NULL END)
  RETURNING id INTO v_id;

  INSERT INTO public.case_message_reads (case_id, user_id, last_read_at)
  VALUES (p_case_id, v_uid, now())
  ON CONFLICT (case_id, user_id) DO UPDATE SET last_read_at = now();

  IF v_role = 'student' THEN
    IF v_case.assigned_to IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.message_thread_mutes m
      WHERE m.user_id = v_case.assigned_to AND m.thread_type = 'case' AND m.thread_id = p_case_id) THEN
      INSERT INTO public.notifications (user_id, title, body, source, case_id, title_ar, title_en, body_ar, body_en, link)
      VALUES (v_case.assigned_to, 'New case message', left(btrim(COALESCE(p_body,'')), 140), 'case_message', p_case_id,
              'رسالة جديدة في الملف', 'New case message', left(btrim(COALESCE(p_body,'')), 140), left(btrim(COALESCE(p_body,'')), 140),
              '/team/cases/' || p_case_id::text);
    END IF;
  ELSIF v_visibility = 'shared' AND v_case.student_user_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.message_thread_mutes m
      WHERE m.user_id = v_case.student_user_id AND m.thread_type = 'case' AND m.thread_id = p_case_id) THEN
    INSERT INTO public.notifications (user_id, title, body, source, case_id, title_ar, title_en, body_ar, body_en, link)
    VALUES (v_case.student_user_id,
            CASE WHEN v_kind = 'request' THEN 'Document requested' ELSE 'New message from your advisor' END,
            left(btrim(COALESCE(p_body,'')), 140), 'case_message', p_case_id,
            CASE WHEN v_kind = 'request' THEN 'مطلوب مستند' ELSE 'رسالة جديدة من فريق درب' END,
            CASE WHEN v_kind = 'request' THEN 'Document requested' ELSE 'New message from your advisor' END,
            left(btrim(COALESCE(p_body,'')), 140), left(btrim(COALESCE(p_body,'')), 140),
            '/student-dashboard');
  END IF;

  PERFORM public.log_case_event(p_case_id,
    CASE WHEN v_kind = 'request' THEN 'document_requested' ELSE 'message_sent' END,
    jsonb_build_object('visibility', v_visibility, 'author_role', v_role,
                       'attachments', jsonb_array_length(v_att)),
    v_visibility = 'internal');

  RETURN v_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.send_case_message(uuid, text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_case_message(uuid, text, text, jsonb, text) TO authenticated;

-- 5. send_direct_message with attachments -----------------------------------
CREATE OR REPLACE FUNCTION public.send_direct_message(
  p_thread_id uuid, p_body text, p_attachments jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_id uuid;
  v_name text;
  v_role text;
  v_body text := btrim(COALESCE(p_body, ''));
  v_att jsonb := public.validate_chat_attachments(p_attachments);
  v_other record;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_body = '' AND jsonb_array_length(v_att) = 0 THEN RAISE EXCEPTION 'Message body required'; END IF;
  IF length(v_body) > 5000 THEN RAISE EXCEPTION 'Message is too long'; END IF;
  IF NOT public.is_direct_thread_member(p_thread_id, v_me) THEN
    RAISE EXCEPTION 'You are not a participant in this conversation';
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_me;
  SELECT role::text INTO v_role FROM public.user_roles WHERE user_id = v_me LIMIT 1;

  INSERT INTO public.direct_messages (thread_id, author_id, author_name, author_role, body, attachments)
  VALUES (p_thread_id, v_me, COALESCE(v_name, 'Unknown'), COALESCE(v_role, 'staff'), v_body, v_att)
  RETURNING id INTO v_id;

  UPDATE public.direct_threads SET last_message_at = now(), updated_at = now() WHERE id = p_thread_id;
  UPDATE public.direct_thread_participants SET last_read_at = now()
  WHERE thread_id = p_thread_id AND user_id = v_me;

  FOR v_other IN
    SELECT p.user_id FROM public.direct_thread_participants p
    WHERE p.thread_id = p_thread_id AND p.user_id <> v_me
      AND NOT EXISTS (SELECT 1 FROM public.message_thread_mutes m
                      WHERE m.user_id = p.user_id AND m.thread_type = 'direct' AND m.thread_id = p_thread_id)
  LOOP
    INSERT INTO public.notifications (user_id, title, body, source, title_ar, title_en, body_ar, body_en, link)
    VALUES (v_other.user_id, 'New message', left(v_body, 140), 'direct_message',
            'رسالة جديدة', 'New message', left(v_body, 140), left(v_body, 140),
            CASE WHEN public.has_role(v_other.user_id, 'admin') THEN '/admin/messages' ELSE '/team/messages' END);
  END LOOP;

  RETURN v_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.send_direct_message(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid, text, jsonb) TO authenticated;

-- 6. Fulfil a document request ----------------------------------------------
CREATE OR REPLACE FUNCTION public.fulfil_document_request(p_message_id uuid, p_attachment jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_msg record;
  v_att jsonb := public.validate_chat_attachments(jsonb_build_array(p_attachment));
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_msg FROM public.case_messages WHERE id = p_message_id;
  IF v_msg IS NULL OR v_msg.kind <> 'request' THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT public.can_access_case_thread(v_msg.case_id, v_me) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  PERFORM public.send_case_message(v_msg.case_id,
    COALESCE(v_msg.body, ''), 'shared', v_att, 'text');

  UPDATE public.case_messages SET request_status = 'fulfilled' WHERE id = p_message_id;

  PERFORM public.log_case_event(v_msg.case_id, 'document_request_fulfilled',
    jsonb_build_object('request_id', p_message_id), false);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.fulfil_document_request(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fulfil_document_request(uuid, jsonb) TO authenticated;

-- 7. Storage policies for chat-attachments ----------------------------------
-- path layout: {case|direct}/{thread_id}/{uuid}-{filename}
CREATE POLICY "Chat members read attachments" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'chat-attachments'
  AND (
    ((storage.foldername(name))[1] = 'case'
      AND public.can_access_case_thread(((storage.foldername(name))[2])::uuid, auth.uid()))
    OR ((storage.foldername(name))[1] = 'direct'
      AND public.is_direct_thread_member(((storage.foldername(name))[2])::uuid, auth.uid()))
  )
);

CREATE POLICY "Chat members upload attachments" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (
    ((storage.foldername(name))[1] = 'case'
      AND public.can_access_case_thread(((storage.foldername(name))[2])::uuid, auth.uid()))
    OR ((storage.foldername(name))[1] = 'direct'
      AND public.is_direct_thread_member(((storage.foldername(name))[2])::uuid, auth.uid()))
  )
);

CREATE POLICY "Admins delete chat attachments" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'chat-attachments' AND public.has_role(auth.uid(), 'admin')
);