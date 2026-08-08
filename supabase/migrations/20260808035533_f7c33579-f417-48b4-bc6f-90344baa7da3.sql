GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_payments TO authenticated;
GRANT ALL ON public.case_payments TO service_role;

DROP POLICY IF EXISTS "Admins manage all payments" ON public.case_payments;
CREATE POLICY "Admins manage all payments"
  ON public.case_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Team manage payments on their cases" ON public.case_payments;
CREATE POLICY "Team manage payments on their cases"
  ON public.case_payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_payments.case_id AND c.assigned_to = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_payments.case_id AND c.assigned_to = auth.uid()));

DROP POLICY IF EXISTS "Students read payments on their case" ON public.case_payments;
CREATE POLICY "Students read payments on their case"
  ON public.case_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_payments.case_id AND c.student_user_id = auth.uid()));