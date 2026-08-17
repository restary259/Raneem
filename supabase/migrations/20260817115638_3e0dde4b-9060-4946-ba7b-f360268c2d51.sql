-- 1) schools: drop the blanket authenticated read, replace with active-only read
DROP POLICY IF EXISTS "Authenticated can read schools" ON public.schools;

CREATE POLICY "Authenticated can read active schools"
ON public.schools
FOR SELECT
TO authenticated
USING (is_active = true);

-- 2) case_invoices: tighten member read to live cases only (invoice rows carry student PII)
DROP POLICY IF EXISTS "Case members read invoices" ON public.case_invoices;

CREATE POLICY "Case members read invoices"
ON public.case_invoices
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.cases c
    WHERE c.id = case_invoices.case_id
      AND c.deleted_at IS NULL
      AND (c.assigned_to = auth.uid() OR c.student_user_id = auth.uid())
  )
);