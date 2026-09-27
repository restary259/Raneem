BEGIN;

CREATE OR REPLACE FUNCTION public.validate_chat_attachments(_att jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
DECLARE
  v jsonb := COALESCE(_att, '[]'::jsonb);
  item jsonb;
  v_kind text;
  v_mime text;
  v_duration numeric;
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

    v_kind := COALESCE(NULLIF(item->>'kind', ''), 'file');
    v_mime := COALESCE(item->>'mime', '');

    IF v_kind = 'voice' THEN
      IF v_mime NOT IN ('audio/webm','audio/webm;codecs=opus','audio/mp4','audio/ogg','audio/ogg;codecs=opus') THEN
        RAISE EXCEPTION 'Voice format is not allowed';
      END IF;
      IF COALESCE(item->>'durationMs', '') = '' OR item->>'durationMs' !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'Voice duration is invalid';
      END IF;
      v_duration := (item->>'durationMs')::numeric;
      IF v_duration <= 0 OR v_duration > 300000 THEN
        RAISE EXCEPTION 'Voice recording must be between 1ms and 5 minutes';
      END IF;
    ELSE
      IF v_kind <> 'file' THEN RAISE EXCEPTION 'Attachment kind is not allowed'; END IF;
      IF v_mime NOT IN (
        'image/png','image/jpeg','image/webp','image/gif','application/pdf',
        'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
      ) THEN
        RAISE EXCEPTION 'File type not allowed';
      END IF;
    END IF;
  END LOOP;
  RETURN v;
END;
$function$;

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
  v_preview text;
  v_preview_ar text;
  v_is_voice boolean := false;
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

  v_is_voice := EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_att) AS item WHERE item->>'kind' = 'voice'
  );
  v_preview := CASE
    WHEN btrim(COALESCE(p_body,'')) = '' AND v_is_voice THEN 'Voice message'
    WHEN btrim(COALESCE(p_body,'')) = '' THEN NULL
    ELSE left(btrim(p_body), 140)
  END;
  v_preview_ar := CASE
    WHEN v_is_voice THEN 'رسالة صوتية'
    ELSE v_preview
  END;

  IF v_role = 'student' THEN
    IF v_case.assigned_to IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.message_thread_mutes m
      WHERE m.user_id = v_case.assigned_to AND m.thread_type = 'case' AND m.thread_id = p_case_id) THEN
      INSERT INTO public.notifications (user_id, title, body, source, case_id, title_ar, title_en, body_ar, body_en, link)
      VALUES (v_case.assigned_to,
              public.chat_sender_label(v_uid, v_case.assigned_to, 'en'),
              COALESCE(v_preview, 'Sent an attachment'), 'case_message', p_case_id,
              public.chat_sender_label(v_uid, v_case.assigned_to, 'ar'),
              public.chat_sender_label(v_uid, v_case.assigned_to, 'en'),
              COALESCE(v_preview_ar, 'أرسل مرفقًا'), COALESCE(v_preview, 'Sent an attachment'),
              '/team/cases/' || p_case_id::text);
    END IF;
  ELSIF v_visibility = 'shared' AND v_case.student_user_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.message_thread_mutes m
      WHERE m.user_id = v_case.student_user_id AND m.thread_type = 'case' AND m.thread_id = p_case_id) THEN
    INSERT INTO public.notifications (user_id, title, body, source, case_id, title_ar, title_en, body_ar, body_en, link)
    VALUES (v_case.student_user_id,
            public.chat_sender_label(v_uid, v_case.student_user_id, 'en'),
            CASE WHEN v_kind = 'request' THEN 'Requested a document' ELSE COALESCE(v_preview, 'Sent an attachment') END,
            'case_message', p_case_id,
            public.chat_sender_label(v_uid, v_case.student_user_id, 'ar'),
            public.chat_sender_label(v_uid, v_case.student_user_id, 'en'),
            CASE WHEN v_kind = 'request' THEN 'طلب مستندًا' ELSE COALESCE(v_preview_ar, 'أرسل مرفقًا') END,
            CASE WHEN v_kind = 'request' THEN 'Requested a document' ELSE COALESCE(v_preview, 'Sent an attachment') END,
            '/student/messages');
  END IF;

  FOREACH v_mentioned IN ARRAY v_mentions LOOP
    IF NOT EXISTS (SELECT 1 FROM public.message_thread_mutes m
                   WHERE m.user_id = v_mentioned AND m.thread_type = 'case' AND m.thread_id = p_case_id) THEN
      INSERT INTO public.notifications (user_id, title, body, source, case_id, title_ar, title_en, body_ar, body_en, link)
      VALUES (v_mentioned,
              public.chat_sender_label(v_uid, v_mentioned, 'en') || ' mentioned you',
              COALESCE(v_preview, 'Sent an attachment'), 'case_mention', p_case_id,
              public.chat_sender_label(v_uid, v_mentioned, 'ar') || ' أشار إليك',
              public.chat_sender_label(v_uid, v_mentioned, 'en') || ' mentioned you',
              COALESCE(v_preview_ar, 'أرسل مرفقًا'), COALESCE(v_preview, 'Sent an attachment'),
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
  v_preview text;
  v_preview_ar text;
  v_label_en text;
  v_label_ar text;
  v_mentioned boolean;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_body = '' AND jsonb_array_length(v_att) = 0 THEN RAISE EXCEPTION 'Message body required'; END IF;
  IF length(v_body) > 5000 THEN RAISE EXCEPTION 'Message is too long'; END IF;
  IF NOT public.is_direct_thread_member(p_thread_id, v_me) THEN
    RAISE EXCEPTION 'You are not a participant in this conversation';
  END IF;

  -- Students may only post into their own payout conversation thread(s), never
  -- as a general direct channel. The payout flow inserts the payout_requests
  -- row before calling this, so the payout card message still posts.
  IF public.has_role(v_me, 'student'::app_role) AND NOT EXISTS (
    SELECT 1 FROM public.payout_requests pr
    WHERE pr.thread_id = p_thread_id AND pr.requestor_id = v_me
  ) THEN
    RAISE EXCEPTION 'Students can only message their payout conversation';
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

  v_is_voice := EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_att) AS item WHERE item->>'kind' = 'voice'
  );
  v_preview := CASE
    WHEN v_body = '' AND v_is_voice THEN 'Voice message'
    WHEN v_body = '' THEN NULL
    ELSE left(v_body, 140)
  END;
  v_preview_ar := CASE
    WHEN v_is_voice THEN 'رسالة صوتية'
    ELSE v_preview
  END;

  FOR v_other IN
    SELECT p.user_id FROM public.direct_thread_participants p
    JOIN public.profiles pr ON pr.id = p.user_id
    WHERE p.thread_id = p_thread_id AND p.user_id <> v_me
      AND (COALESCE(pr.notify_in_app, true) = true OR p.user_id = ANY(v_mentions))
      AND NOT EXISTS (SELECT 1 FROM public.message_thread_mutes m
                      WHERE m.user_id = p.user_id AND m.thread_type = 'direct' AND m.thread_id = p_thread_id)
  LOOP
    v_mentioned := v_other.user_id = ANY(v_mentions);
    v_label_en := public.chat_sender_label(v_me, v_other.user_id, 'en');
    v_label_ar := public.chat_sender_label(v_me, v_other.user_id, 'ar');

    INSERT INTO public.notifications (user_id, title, body, source, title_ar, title_en, body_ar, body_en, link)
    VALUES (v_other.user_id,
            CASE WHEN v_mentioned THEN v_label_en || ' mentioned you' ELSE v_label_en END,
            COALESCE(v_preview, 'Sent an attachment'), 'direct_message',
            CASE WHEN v_mentioned THEN v_label_ar || ' أشار إليك' ELSE v_label_ar END,
            CASE WHEN v_mentioned THEN v_label_en || ' mentioned you' ELSE v_label_en END,
            COALESCE(v_preview_ar, 'أرسل مرفقًا'), COALESCE(v_preview, 'Sent an attachment'),
            CASE
              WHEN public.has_role(v_other.user_id, 'admin') THEN '/admin/messages'
              WHEN public.has_role(v_other.user_id, 'team_member') THEN '/team/messages'
              WHEN public.has_role(v_other.user_id, 'student') THEN '/student/messages'
              WHEN public.has_role(v_other.user_id, 'agent') THEN '/agent/messages'
              ELSE '/partner/messages'
            END);
  END LOOP;

  RETURN v_id;
END;
$function$;

COMMIT;
