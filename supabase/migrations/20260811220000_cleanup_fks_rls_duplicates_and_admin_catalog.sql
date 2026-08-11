-- Cleanup pass from the pipeline production-readiness audit (Low items).
--
-- 1. Foreign keys: the legacy `student_cases` table (dropped in
--    20260310093240 with CASCADE) carried the FKs from case_payments and
--    case_service_snapshots. Those constraints died with it, so today neither
--    table has a FK to `cases`. Re-add them (orphaned rows are unreachable and
--    are removed first).
-- 2. RLS: case_payments accumulated 5+ policies over time with two identical
--    pairs (legacy policy names survived the phase-2 rewrite). Normalise to a
--    single canonical set of three. case_finance_confirmations gets its single
--    read policy recreated idempotently.
-- 3. master_services: admins could read but not write through RLS (writes only
--    worked via migrations). Add the admin manage policy + grants.

-- ── 1. Foreign keys ─────────────────────────────────────────────────────────

DELETE FROM public.case_service_snapshots css
WHERE NOT EXISTS (SELECT 1 FROM public.cases c WHERE c.id = css.case_id);

DELETE FROM public.case_payments cp
WHERE NOT EXISTS (SELECT 1 FROM public.cases c WHERE c.id = cp.case_id);

ALTER TABLE public.case_payments DROP CONSTRAINT IF EXISTS case_payments_case_id_fkey;
ALTER TABLE public.case_payments
  ADD CONSTRAINT case_payments_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;

ALTER TABLE public.case_service_snapshots DROP CONSTRAINT IF EXISTS case_service_snapshots_case_id_fkey;
ALTER TABLE public.case_service_snapshots
  ADD CONSTRAINT case_service_snapshots_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;

-- ── 2. case_payments — drop every known policy name, then rebuild canonical ─

DROP POLICY IF EXISTS "Admins manage all case payments" ON public.case_payments;
DROP POLICY IF EXISTS "Team manage payments on assigned cases" ON public.case_payments;
DROP POLICY IF EXISTS "Students read payments on their case" ON public.case_payments;
DROP POLICY IF EXISTS "Admins can manage all case payments" ON public.case_payments;
DROP POLICY IF EXISTS "Admins manage all payments" ON public.case_payments;
DROP POLICY IF EXISTS "Team can view payments for assigned cases" ON public.case_payments;
DROP POLICY IF EXISTS "Team manage payments on their cases" ON public.case_payments;
DROP POLICY IF EXISTS "Admins can manage case payments" ON public.case_payments;
DROP POLICY IF EXISTS "Team insert payments on their cases" ON public.case_payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON public.case_payments;
DROP POLICY IF EXISTS "Team can view payments on their cases" ON public.case_payments;
DROP POLICY IF EXISTS "Students can view own case payments" ON public.case_payments;

CREATE POLICY "Admins manage all case payments"
  ON public.case_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team manage payments on assigned cases"
  ON public.case_payments FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'team_member')
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_payments.case_id AND c.assigned_to = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'team_member')
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_payments.case_id AND c.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Students read payments on their case"
  ON public.case_payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_payments.case_id AND c.student_user_id = auth.uid()
    )
  );

-- ── 2b. case_finance_confirmations — single read policy, idempotent ─────────

DROP POLICY IF EXISTS "Case readers can read finance confirmations" ON public.case_finance_confirmations;
CREATE POLICY "Case readers can read finance confirmations"
  ON public.case_finance_confirmations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_finance_confirmations.case_id
        AND (c.assigned_to = auth.uid() OR c.student_user_id = auth.uid())
    )
  );

-- ── 3. master_services — admin write access ────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage master services" ON public.master_services;
CREATE POLICY "Admins can manage master services"
  ON public.master_services FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_services TO authenticated;
GRANT ALL ON public.master_services TO service_role;
