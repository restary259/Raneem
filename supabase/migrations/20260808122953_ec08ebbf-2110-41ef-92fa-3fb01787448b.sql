CREATE OR REPLACE FUNCTION public.get_staff_directory()
RETURNS TABLE(id uuid, full_name text, role text, is_manager boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
      OR (
        (public.has_role(auth.uid(), 'social_media_partner'::app_role)
         OR public.has_role(auth.uid(), 'ambassador'::app_role))
        AND ur.role = 'admin'
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.start_direct_thread(p_other_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_thread uuid;
  v_me_admin boolean;
  v_me_partner boolean;
  v_other_admin boolean;
  v_other_manager boolean;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_other_user IS NULL OR p_other_user = v_me THEN
    RAISE EXCEPTION 'Pick another staff member';
  END IF;

  v_me_admin := public.has_role(v_me, 'admin'::app_role);
  v_me_partner := public.has_role(v_me, 'social_media_partner'::app_role)
                  OR public.has_role(v_me, 'ambassador'::app_role);
  v_other_admin := public.has_role(p_other_user, 'admin'::app_role);
  SELECT COALESCE(is_manager, false) INTO v_other_manager FROM public.profiles WHERE id = p_other_user;

  IF NOT (v_me_admin OR v_other_admin OR v_other_manager) THEN
    RAISE EXCEPTION 'Direct messages must include an admin or a manager';
  END IF;

  IF NOT (v_me_admin
          OR public.has_role(v_me, 'team_member'::app_role)
          OR v_me_partner) THEN
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

  -- partners and ambassadors may only talk to admins
  IF NOT v_me_admin AND v_me_partner AND NOT v_other_admin THEN
    RAISE EXCEPTION 'Partners can only message an administrator';
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
$$;