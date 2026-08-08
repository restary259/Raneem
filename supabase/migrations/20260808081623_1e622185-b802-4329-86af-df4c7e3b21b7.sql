-- 1. profile flags
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_manager boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_in_app boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT true;

-- 2. staff directory: team members only reach admins + managers
DROP FUNCTION IF EXISTS public.get_staff_directory();
CREATE FUNCTION public.get_staff_directory()
RETURNS TABLE(id uuid, full_name text, role text, is_manager boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id, p.full_name, ur.role::text, p.is_manager
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role IN ('team_member','admin','social_media_partner')
    AND p.deleted_at IS NULL
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (
        public.has_role(auth.uid(), 'team_member'::app_role)
        AND (ur.role = 'admin' OR p.is_manager = true)
      )
    )
$function$;

GRANT EXECUTE ON FUNCTION public.get_staff_directory() TO authenticated;

-- 3. thread creation rule for team members
CREATE OR REPLACE FUNCTION public.start_direct_thread(p_other_user uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_thread uuid;
  v_me_admin boolean;
  v_other_admin boolean;
  v_other_manager boolean;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_other_user IS NULL OR p_other_user = v_me THEN
    RAISE EXCEPTION 'Pick another staff member';
  END IF;

  v_me_admin := public.has_role(v_me, 'admin'::app_role);
  v_other_admin := public.has_role(p_other_user, 'admin'::app_role);
  SELECT COALESCE(is_manager, false) INTO v_other_manager FROM public.profiles WHERE id = p_other_user;

  IF NOT (v_me_admin OR v_other_admin OR v_other_manager) THEN
    RAISE EXCEPTION 'Direct messages must include an admin or a manager';
  END IF;

  IF NOT (v_me_admin
          OR public.has_role(v_me, 'team_member'::app_role)
          OR public.has_role(v_me, 'social_media_partner'::app_role)
          OR public.has_role(v_me, 'ambassador'::app_role)) THEN
    RAISE EXCEPTION 'Only staff can use direct messages';
  END IF;

  IF NOT (v_other_admin
          OR public.has_role(p_other_user, 'team_member'::app_role)
          OR public.has_role(p_other_user, 'social_media_partner'::app_role)
          OR public.has_role(p_other_user, 'ambassador'::app_role)) THEN
    RAISE EXCEPTION 'The selected user is not staff';
  END IF;

  -- team members may only talk to admins or managers
  IF NOT v_me_admin AND public.has_role(v_me, 'team_member'::app_role)
     AND NOT (v_other_admin OR v_other_manager) THEN
    RAISE EXCEPTION 'Team members can only message an admin or a manager';
  END IF;

  SELECT p1.thread_id INTO v_thread
  FROM public.direct_thread_participants p1
  JOIN public.direct_thread_participants p2 ON p2.thread_id = p1.thread_id
  WHERE p1.user_id = v_me AND p2.user_id = p_other_user
  LIMIT 1;

  IF v_thread IS NOT NULL THEN
    RETURN v_thread;
  END IF;

  INSERT INTO public.direct_threads (created_by) VALUES (v_me) RETURNING id INTO v_thread;
  INSERT INTO public.direct_thread_participants (thread_id, user_id)
  VALUES (v_thread, v_me), (v_thread, p_other_user);

  RETURN v_thread;
END;
$function$;

-- 4. respect the in-app notification switch
CREATE OR REPLACE FUNCTION public.send_direct_message(p_thread_id uuid, p_body text, p_attachments jsonb DEFAULT '[]'::jsonb)
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
    JOIN public.profiles pr ON pr.id = p.user_id
    WHERE p.thread_id = p_thread_id AND p.user_id <> v_me
      AND COALESCE(pr.notify_in_app, true) = true
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