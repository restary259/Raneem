
-- Fix RLS on cases: team members should ONLY see cases assigned to them
-- Remove the source exception that allowed any team member to see all manual cases
DROP POLICY IF EXISTS "Team can manage assigned cases" ON public.cases;

CREATE POLICY "Team can manage assigned cases"
  ON public.cases FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'team_member'::app_role) AND assigned_to = auth.uid()
  )
  WITH CHECK (
    has_role(auth.uid(), 'team_member'::app_role)
  );
