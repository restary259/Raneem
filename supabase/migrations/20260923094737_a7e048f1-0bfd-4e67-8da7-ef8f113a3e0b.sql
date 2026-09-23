CREATE OR REPLACE FUNCTION public.start_student_team_member_thread()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me        uuid := auth.uid();
  v_other     uuid;
  v_thread_id uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT public.has_role(v_me, 'student'::app_role) THEN
    RAISE EXCEPTION 'Only students can start a team member thread';
  END IF;

  -- 1) The team member handling the student's most recent case (any stage).
  SELECT c.assigned_to INTO v_other
  FROM public.cases c
  WHERE c.student_user_id = v_me
    AND c.deleted_at IS NULL
    AND c.assigned_to IS NOT NULL
  ORDER BY c.updated_at DESC
  LIMIT 1;

  -- 2) Otherwise the staff member who created the student's account.
  IF v_other IS NULL THEN
    SELECT p.created_by INTO v_other
    FROM public.profiles p
    WHERE p.id = v_me AND p.created_by IS NOT NULL;
  END IF;

  -- 3) Otherwise an active admin, so the student is never left without contact.
  IF v_other IS NULL THEN
    SELECT ur.user_id INTO v_other
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'admin'::app_role
      AND p.deleted_at IS NULL
      AND COALESCE(p.is_deactivated, false) = false
    ORDER BY p.created_at
    LIMIT 1;
  END IF;

  IF v_other IS NULL THEN
    RAISE EXCEPTION 'No team member assigned yet';
  END IF;

  -- Reuse an existing thread between this exact pair.
  SELECT dt.id INTO v_thread_id
  FROM public.direct_threads dt
  JOIN public.direct_thread_participants p1
    ON p1.thread_id = dt.id AND p1.user_id = v_me
  JOIN public.direct_thread_participants p2
    ON p2.thread_id = dt.id AND p2.user_id = v_other
  WHERE dt.purpose = 'team_member'
  LIMIT 1;

  IF v_thread_id IS NOT NULL THEN
    RETURN v_thread_id;
  END IF;

  INSERT INTO public.direct_threads (created_by, purpose)
  VALUES (v_me, 'team_member')
  RETURNING id INTO v_thread_id;

  INSERT INTO public.direct_thread_participants (thread_id, user_id)
  VALUES (v_thread_id, v_me),
         (v_thread_id, v_other);

  RETURN v_thread_id;
END;
$function$;