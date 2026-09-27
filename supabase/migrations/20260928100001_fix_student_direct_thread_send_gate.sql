-- Let a student write in the thread start_student_team_member_thread opened for
-- them, instead of only in a payout conversation.
--
-- The bug: 20260817080000_student_direct_thread_gate.sql closed the
-- student -> arbitrary-staff back-channel by requiring every student direct
-- message to target a thread linked to one of their own payout_requests rows.
-- That gate is correct in spirit but it is applied to the wrong set of threads:
-- 20260923094737 later added start_student_team_member_thread, which creates a
-- one-to-one student <-> staff thread with purpose = 'team_member' and NO
-- payout_requests row. StudentMessagesPage calls that RPC, so a student who
-- opened "my team member" conversation could not post a single message into it —
-- send_direct_message raised 'Students can only message their payout
-- conversation'. The feature was dead on arrival.
--
-- What changes: a student may post when the thread is EITHER
--   (a) linked to one of their own payout_requests rows  — unchanged, byte for byte
--   (b) a purpose = 'team_member' thread whose single other participant is
--       admin or team_member
-- (b) is exactly the fingerprint of start_student_team_member_thread: only that
-- function writes purpose = 'team_member', and the per-student thread gate
-- above already proved the caller is a participant of the thread. This is NOT a
-- general student chat channel — a student still cannot open a direct thread
-- with an arbitrary staff member, because start_direct_thread rejects students
-- outright and only start_student_team_member_thread / the payout flow can
-- create a thread a student is a participant of.
--
-- Everything below the gate is byte-for-byte identical to the 20260927130000
-- definition; only the gate condition and its comment differ.

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
  v_is_voice boolean := false;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_body = '' AND jsonb_array_length(v_att) = 0 THEN RAISE EXCEPTION 'Message body required'; END IF;
  IF length(v_body) > 5000 THEN RAISE EXCEPTION 'Message is too long'; END IF;
  IF NOT public.is_direct_thread_member(p_thread_id, v_me) THEN
    RAISE EXCEPTION 'You are not a participant in this conversation';
  END IF;

  -- Students may post into their own payout conversation (the payout flow
  -- inserts the payout_requests row before calling this, so the payout card
  -- message still posts) OR into the one-to-one thread
  -- start_student_team_member_thread opened with the staff member handling
  -- their case. Never as a general direct channel: 'team_member' is written
  -- only by that function, and the other side must still be staff.
  IF public.has_role(v_me, 'student'::app_role)
     AND NOT EXISTS (
       SELECT 1 FROM public.payout_requests pr
       WHERE pr.thread_id = p_thread_id AND pr.requestor_id = v_me
     )
     AND NOT EXISTS (
       SELECT 1
         FROM public.direct_threads dt
         JOIN public.direct_thread_participants other
           ON other.thread_id = dt.id AND other.user_id <> v_me
        WHERE dt.id = p_thread_id
          AND dt.purpose = 'team_member'
          AND (
            public.has_role(other.user_id, 'admin'::app_role)
            OR public.has_role(other.user_id, 'team_member'::app_role)
          )
     )
  THEN
    RAISE EXCEPTION 'Students can only message their payout or team member conversation';
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

REVOKE ALL ON FUNCTION public.send_direct_message(uuid, text, jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid, text, jsonb, uuid[]) TO authenticated, service_role;
