CREATE OR REPLACE FUNCTION public.reassign_case(p_case_id uuid, p_new_assignee uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_case RECORD;
  v_is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, assigned_to, status INTO v_case
  FROM public.cases WHERE id = p_case_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Case not found';
  END IF;

  v_is_admin := public.has_role(auth.uid(), 'admin'::app_role);

  IF NOT v_is_admin AND v_case.assigned_to IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only reassign cases assigned to you';
  END IF;

  IF NOT public.has_role(p_new_assignee, 'team_member'::app_role)
     AND NOT public.has_role(p_new_assignee, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Target user is not a team member';
  END IF;

  IF NOT v_is_admin AND v_case.status NOT IN (
    'new', 'contacted', 'appointment_scheduled', 'profile_completion', 'payment_confirmed'
  ) THEN
    RAISE EXCEPTION 'Reassignment is only allowed before submission to admin';
  END IF;

  UPDATE public.cases SET assigned_to = p_new_assignee WHERE id = p_case_id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_id, target_table, details)
  VALUES (auth.uid(), 'reassign_case', p_case_id::text, 'cases',
          'Reassigned from ' || COALESCE(v_case.assigned_to::text, 'unassigned') || ' to ' || p_new_assignee::text);
END;
$$;

REVOKE ALL ON FUNCTION public.reassign_case(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reassign_case(uuid, uuid) TO authenticated, service_role;