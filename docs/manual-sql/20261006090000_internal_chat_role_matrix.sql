-- Internal chat role matrix (MANUAL DEPLOY). Deletes no data.
-- One relationship = one conversation:
--   student  -> admin            : direct
--   student  -> own team member  : CASE THREAD ONLY (no direct thread)
--   team     -> team             : direct (start_team_chat_thread keeps its own flag gate)
--   team     -> admin            : direct
--   admin    -> anyone           : direct
--   agent / partner / ambassador -> admin only
-- Enforced in start_direct_thread, send_direct_message and the new
-- start_student_admin_thread, so the UI is never the security layer.

CREATE OR REPLACE FUNCTION public.chat_pair_allowed(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p_a IS NOT NULL AND p_b IS NOT NULL AND p_a <> p_b
    AND (
      public.has_role(p_a, 'admin'::public.app_role)
      OR public.has_role(p_b, 'admin'::public.app_role)
      OR (
        public.has_role(p_a, 'team_member'::public.app_role)
        AND public.has_role(p_b, 'team_member'::public.app_role)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.chat_pair_allowed(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_pair_allowed(uuid, uuid) TO authenticated, service_role;

-- Direct threads: everyone except team<->team (own RPC) must include an admin.
CREATE OR REPLACE FUNCTION public.start_direct_thread(p_other_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_thread uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_other_user IS NULL OR p_other_user = v_me THEN
    RAISE EXCEPTION 'Pick another staff member';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_other_user AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'The selected user is not available';
  END IF;

  IF NOT (public.has_role(v_me, 'admin'::public.app_role)
          OR public.has_role(p_other_user, 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Direct messages must include an admin';
  END IF;

  SELECT p1.thread_id INTO v_thread
  FROM public.direct_thread_participants p1
  JOIN public.direct_thread_participants p2 ON p2.thread_id = p1.thread_id
  WHERE p1.user_id = v_me AND p2.user_id = p_other_user
  LIMIT 1;
  IF v_thread IS NOT NULL THEN RETURN v_thread; END IF;

  INSERT INTO public.direct_threads (created_by) VALUES (v_me) RETURNING id INTO v_thread;
  INSERT INTO public.direct_thread_participants (thread_id, user_id)
  VALUES (v_thread, v_me), (v_thread, p_other_user);
  RETURN v_thread;
END;
$$;

REVOKE ALL ON FUNCTION public.start_direct_thread(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_direct_thread(uuid) TO authenticated;

-- Student's single direct line: DARB Administration. Idempotent.
CREATE OR REPLACE FUNCTION public.start_student_admin_thread()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_admin uuid;
  v_thread uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(v_me, 'student'::public.app_role) THEN
    RAISE EXCEPTION 'Only students can open this conversation';
  END IF;

  SELECT p1.thread_id INTO v_thread
  FROM public.direct_thread_participants p1
  JOIN public.direct_thread_participants p2 ON p2.thread_id = p1.thread_id AND p2.user_id <> v_me
  WHERE p1.user_id = v_me
    AND public.has_role(p2.user_id, 'admin'::public.app_role)
    AND NOT EXISTS (SELECT 1 FROM public.payout_requests pr WHERE pr.thread_id = p1.thread_id)
  ORDER BY p1.thread_id
  LIMIT 1;
  IF v_thread IS NOT NULL THEN RETURN v_thread; END IF;

  SELECT ur.user_id INTO v_admin
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id AND p.deleted_at IS NULL
  WHERE ur.role = 'admin'::public.app_role
  ORDER BY p.created_at
  LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'No administrator is available'; END IF;

  INSERT INTO public.direct_threads (created_by) VALUES (v_me) RETURNING id INTO v_thread;
  INSERT INTO public.direct_thread_participants (thread_id, user_id)
  VALUES (v_thread, v_me), (v_thread, v_admin);
  RETURN v_thread;
END;
$$;

REVOKE ALL ON FUNCTION public.start_student_admin_thread() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_student_admin_thread() TO authenticated;

-- Send gate: a non-payout thread must contain a pair allowed by the matrix.
CREATE OR REPLACE FUNCTION public.send_direct_message(p_thread_id uuid, p_body text, p_attachments jsonb DEFAULT '[]'::jsonb, p_mentions uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me      uuid := auth.uid();
  v_id      uuid;
  v_name    text;
  v_role    text;
  v_body    text := btrim(COALESCE(p_body, ''));
  v_att     jsonb := public.validate_chat_attachments(p_attachments);
  v_other   record;
  v_mentions uuid[];
  v_preview  text;
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

  IF NOT EXISTS (
       SELECT 1 FROM public.payout_requests pr
       WHERE pr.thread_id = p_thread_id AND pr.requestor_id = v_me
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.direct_thread_participants p
       WHERE p.thread_id = p_thread_id AND p.user_id <> v_me
         AND public.chat_pair_allowed(v_me, p.user_id)
     ) THEN
    RAISE EXCEPTION 'This conversation is not allowed. Students reach their team through the case conversation.';
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

  v_preview := CASE WHEN v_body = '' THEN NULL ELSE left(v_body, 140) END;

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
            COALESCE(v_preview, 'أرسل مرفقًا'), COALESCE(v_preview, 'Sent an attachment'),
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

-- The old student<->team direct-thread starter is retired.
REVOKE EXECUTE ON FUNCTION public.start_student_team_member_thread() FROM PUBLIC, authenticated;

-- Verification after deploy:
--   select public.chat_pair_allowed('<student>', '<team_member>');  -- false
--   select public.chat_pair_allowed('<student>', '<admin>');        -- true
--   select public.chat_pair_allowed('<agent>', '<partner>');        -- false
--   select public.chat_pair_allowed('<team_a>', '<team_b>');        -- true
