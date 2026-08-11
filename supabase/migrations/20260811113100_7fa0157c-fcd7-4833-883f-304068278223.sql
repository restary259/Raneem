CREATE OR REPLACE FUNCTION public.team_can_view_student_role(_student_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cases c
    WHERE c.assigned_to = auth.uid()
      AND c.student_user_id = _student_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.team_can_view_student_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.team_can_view_student_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_can_view_student_role(uuid) TO service_role;

DROP POLICY IF EXISTS "Team can view student roles" ON public.user_roles;

CREATE POLICY "Team can view assigned student roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  role = 'student'::app_role
  AND public.has_role(auth.uid(), 'team_member'::app_role)
  AND public.team_can_view_student_role(user_id)
);