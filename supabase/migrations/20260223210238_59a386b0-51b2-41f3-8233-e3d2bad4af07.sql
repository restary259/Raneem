
-- CRITICAL FIX 1: Restrict lawyer SELECT on student_cases to only their assigned cases
-- Drop the overly permissive policy and replace with scoped one
DROP POLICY IF EXISTS "Lawyers can view all active cases" ON public.student_cases;

CREATE POLICY "Lawyers can view assigned active cases"
  ON public.student_cases
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'lawyer'::app_role)
    AND assigned_lawyer_id = auth.uid()
    AND deleted_at IS NULL
  );
