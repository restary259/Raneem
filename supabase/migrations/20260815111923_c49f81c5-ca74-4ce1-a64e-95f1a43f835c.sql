-- Remove exact-duplicate policies on public.case_payment_proofs.
-- Keeps one admin ALL policy and one student SELECT policy; the assigned-team
-- SELECT policy is untouched. No effective access change.
DROP POLICY IF EXISTS "Admins can manage payment proofs" ON public.case_payment_proofs;
DROP POLICY IF EXISTS "Students can view own payment proofs" ON public.case_payment_proofs;