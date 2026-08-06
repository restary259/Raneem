-- ============================================================
-- case_submissions: team limited to their assigned cases
-- ============================================================
DROP POLICY IF EXISTS "Team manage submissions" ON public.case_submissions;

CREATE POLICY "Team manage assigned submissions"
ON public.case_submissions
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_submissions.case_id
      AND c.assigned_to = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_submissions.case_id
      AND c.assigned_to = auth.uid()
  )
);

-- ============================================================
-- visa_applications: team limited to their assigned cases
-- ============================================================
DROP POLICY IF EXISTS "Team manage visa applications" ON public.visa_applications;

CREATE POLICY "Team manage assigned visa applications"
ON public.visa_applications
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = visa_applications.case_id
      AND c.assigned_to = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = visa_applications.case_id
      AND c.assigned_to = auth.uid()
  )
);

-- ============================================================
-- visa_field_values: team limited to students on their cases
-- ============================================================
DROP POLICY IF EXISTS "Team manage visa values" ON public.visa_field_values;

CREATE POLICY "Team manage assigned visa values"
ON public.visa_field_values
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.student_user_id = visa_field_values.student_user_id
      AND c.assigned_to = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.student_user_id = visa_field_values.student_user_id
      AND c.assigned_to = auth.uid()
  )
);