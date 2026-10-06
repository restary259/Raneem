-- MANUAL DEPLOY. No data is changed or deleted.
-- Gives team members read access to documents of students they created
-- (profiles.created_by = me), matching the profiles and user_roles rules.
-- Assigned-case access is unchanged.

DROP POLICY IF EXISTS "Team can view assigned documents" ON public.documents;
CREATE POLICY "Team can view assigned documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member'::public.app_role)
  AND (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.assigned_to = auth.uid()
        AND (c.id = documents.case_id OR c.student_user_id = documents.student_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles sp
      WHERE sp.id = documents.student_id
        AND sp.created_by = auth.uid()
        AND sp.deleted_at IS NULL
    )
  )
);

-- Verify:
-- select pg_get_expr(polqual, polrelid) from pg_policy
--  where polrelid = 'public.documents'::regclass and polname = 'Team can view assigned documents';
