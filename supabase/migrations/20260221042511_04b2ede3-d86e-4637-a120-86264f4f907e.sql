
-- Allow team members (lawyers) to VIEW all active cases
CREATE POLICY "Lawyers can view all active cases"
  ON public.student_cases
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'lawyer'::app_role)
    AND deleted_at IS NULL
  );

-- Drop the old restrictive SELECT policy
DROP POLICY IF EXISTS "Lawyers can view assigned cases" ON public.student_cases;

-- Allow team members to view all non-deleted leads (needed for case context)
CREATE POLICY "Lawyers can view all active leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'lawyer'::app_role)
    AND deleted_at IS NULL
  );

-- Drop the old restrictive leads SELECT policy
DROP POLICY IF EXISTS "Lawyers can view leads for assigned cases" ON public.leads;
