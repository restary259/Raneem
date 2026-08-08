CREATE OR REPLACE FUNCTION public.send_case_message(p_case_id uuid, p_body text, p_visibility text DEFAULT 'shared'::text, p_attachments jsonb DEFAULT '[]'::jsonb, p_kind text DEFAULT 'text'::text, p_mentions uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_name text;
  v_case record;
  v_visibility text;
  v_kind text := CASE WHEN p_kind = 'request' THEN 'request' ELSE 'text' END;
  v_att jsonb := public.validate_chat_attachments(p_attachments);
  v_id uuid;
  v_mentions uuid[];
  v_mentioned uuid;
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

  -- Only people who can actually see this message may be mentioned.
  SELECT COALESCE(array_agg(DISTINCT m), '{}'::uuid[]) INTO v_mentions
  FROM unnest(COALESCE(p_mentions, '{}'::uuid[])) AS m
  WHERE m <> v_uid
    AND (
      public.has_role(m, 'admin')
      OR m = v_case.assigned_to
      OR (v_visibility = 'shared' AND m = v_case.student_user_id)
    );

  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.case_messages (case_id, author_id, author_role, author_name, body, visibility, attachments, kind, request_status, mentions)
  VALUES (p_case_id, v_uid, v_role, v_name, btrim(COALESCE(p_body,'')), v_visibility, v_att, v_kind,
          CASE WHEN v_kind = 'request' THEN 'pending' ELSE NULL END, v_mentions)
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
            '/student/messages');
  END IF;

  FOREACH v_mentioned IN ARRAY v_mentions LOOP
    IF NOT EXISTS (SELECT 1 FROM public.message_thread_mutes m
                   WHERE m.user_id = v_mentioned AND m.thread_type = 'case' AND m.thread_id = p_case_id) THEN
      INSERT INTO public.notifications (user_id, title, body, source, case_id, title_ar, title_en, body_ar, body_en, link)
      VALUES (v_mentioned, 'You were mentioned', left(btrim(COALESCE(p_body,'')), 140), 'case_mention', p_case_id,
              'تمت الإشارة إليك', 'You were mentioned',
              left(btrim(COALESCE(p_body,'')), 140), left(btrim(COALESCE(p_body,'')), 140),
              CASE
                WHEN public.has_role(v_mentioned, 'admin') THEN '/admin/messages'
                WHEN v_mentioned = v_case.student_user_id THEN '/student/messages'
                ELSE '/team/messages'
              END);
    END IF;
  END LOOP;

  PERFORM public.log_case_event(p_case_id,
    CASE WHEN v_kind = 'request' THEN 'document_requested' ELSE 'message_sent' END,
    jsonb_build_object('visibility', v_visibility, 'author_role', v_role,
                       'attachments', jsonb_array_length(v_att)),
    v_visibility = 'internal');

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_direct_message(p_thread_id uuid, p_body text, p_attachments jsonb DEFAULT '[]'::jsonb, p_mentions uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_id uuid;
  v_name text;
  v_role text;
  v_body text := btrim(COALESCE(p_body, ''));
  v_att jsonb := public.validate_chat_attachments(p_attachments);
  v_other record;
  v_mentions uuid[];
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_body = '' AND jsonb_array_length(v_att) = 0 THEN RAISE EXCEPTION 'Message body required'; END IF;
  IF length(v_body) > 5000 THEN RAISE EXCEPTION 'Message is too long'; END IF;
  IF NOT public.is_direct_thread_member(p_thread_id, v_me) THEN
    RAISE EXCEPTION 'You are not a participant in this conversation';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT m), '{}'::uuid[]) INTO v_mentions
  FROM unnest(COALESCE(p_mentions, '{}'::uuid[])) AS m
  WHERE m <> v_me AND public.is_direct_thread_member(p_thread_id, m);

  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_me;
  SELECT role::text INTO v_role FROM public.user_roles WHERE user_id = v_me LIMIT 1;

  INSERT INTO public.direct_messages (thread_id, author_id, author_name, author_role, body, attachments, mentions)
  VALUES (p_thread_id, v_me, COALESCE(v_name, 'Unknown'), COALESCE(v_role, 'staff'), v_body, v_att, v_mentions)
  RETURNING id INTO v_id;

  UPDATE public.direct_threads SET last_message_at = now(), updated_at = now() WHERE id = p_thread_id;
  UPDATE public.direct_thread_participants SET last_read_at = now()
  WHERE thread_id = p_thread_id AND user_id = v_me;

  FOR v_other IN
    SELECT p.user_id FROM public.direct_thread_participants p
    JOIN public.profiles pr ON pr.id = p.user_id
    WHERE p.thread_id = p_thread_id AND p.user_id <> v_me
      AND (COALESCE(pr.notify_in_app, true) = true OR p.user_id = ANY(v_mentions))
      AND NOT EXISTS (SELECT 1 FROM public.message_thread_mutes m
                      WHERE m.user_id = p.user_id AND m.thread_type = 'direct' AND m.thread_id = p_thread_id)
  LOOP
    INSERT INTO public.notifications (user_id, title, body, source, title_ar, title_en, body_ar, body_en, link)
    VALUES (v_other.user_id,
            CASE WHEN v_other.user_id = ANY(v_mentions) THEN 'You were mentioned' ELSE 'New message' END,
            left(v_body, 140), 'direct_message',
            CASE WHEN v_other.user_id = ANY(v_mentions) THEN 'تمت الإشارة إليك' ELSE 'رسالة جديدة' END,
            CASE WHEN v_other.user_id = ANY(v_mentions) THEN 'You were mentioned' ELSE 'New message' END,
            left(v_body, 140), left(v_body, 140),
            CASE
              WHEN public.has_role(v_other.user_id, 'admin') THEN '/admin/messages'
              WHEN public.has_role(v_other.user_id, 'team_member') THEN '/team/messages'
              WHEN public.has_role(v_other.user_id, 'student') THEN '/student/messages'
              ELSE '/partner/messages'
            END);
  END LOOP;

  RETURN v_id;
END;
$function$;