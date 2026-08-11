-- Team members may only read/update submissions for cases assigned to them.
-- The previous policy (`FOR ALL USING has_role(team_member)`) let any team
-- member read and update EVERY student's submission directly via PostgREST —
-- including PII held in case_submissions (email, passport number, date of
-- birth in extra_data) and financial columns — even though the documented
-- access model (DATA_INVENTORY.md) scopes team access to their own cases.
--
-- The team-facing spreadsheets (students sheet) already filter by
-- `case.assigned_to = user`; this policy makes that filter real instead of
-- cosmetic. Admin policy is unchanged. The students' own-read policy is
-- unchanged. Case creation for a new student stays possible for admins
-- (admin policy) and for team members assigning the case to themselves.

DROP POLICY IF EXISTS "Team manage submissions" ON public.case_submissions;

CREATE POLICY "Team manage submissions" ON public.case_submissions
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'team_member')
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_submissions.case_id
        AND c.assigned_to = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'team_member')
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_submissions.case_id
        AND c.assigned_to = auth.uid()
    )
  );
