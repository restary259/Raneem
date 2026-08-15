-- Allow payment-proof uploads to precede a payment row.
--
-- The live schema has case_payment_proofs.payment_id as NOT NULL (captured in
-- 20260810070000_capture_untracked_tables.sql). The align_darb migration
-- (20260810130000) intended to make it nullable via CREATE TABLE IF NOT EXISTS,
-- but that is a no-op on an already-existing table, so the NOT NULL was
-- silently retained. The submit_german_payment_proof RPC (and its
-- submit_case_payment_proof delegate) inserts without payment_id because a
-- Germany-side proof can arrive before any payment row exists — so every such
-- upload hits a NOT NULL violation.
--
-- This migration drops the NOT NULL and re-points both foreign keys so deletes
-- behave sanely:
--   • payment_id  → ON DELETE SET NULL (a proof is evidence; don't delete it
--     when a payment record is removed, just unlink it).
--   • uploaded_by → ON DELETE RESTRICT (the live FK was SET NULL on a NOT NULL
--     column, which makes profile deletion fail with a cryptic violation.
--     RESTRICT expresses the same intent cleanly: remove the proofs first).

ALTER TABLE public.case_payment_proofs ALTER COLUMN payment_id DROP NOT NULL;

ALTER TABLE public.case_payment_proofs DROP CONSTRAINT IF EXISTS case_payment_proofs_payment_id_fkey;
ALTER TABLE public.case_payment_proofs
  ADD CONSTRAINT case_payment_proofs_payment_id_fkey
  FOREIGN KEY (payment_id) REFERENCES public.case_payments(id) ON DELETE SET NULL;

ALTER TABLE public.case_payment_proofs DROP CONSTRAINT IF EXISTS case_payment_proofs_uploaded_by_fkey;
ALTER TABLE public.case_payment_proofs
  ADD CONSTRAINT case_payment_proofs_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

-- Deprecation marker: referrals.discount_applied is a boolean that was never
-- flipped to true by any code path. The referral discount now lives on the
-- case row (cases.referral_discount), which is the single source of truth that
-- get_case_financials subtracts and record_case_commission nets. The column is
-- kept for backward compatibility but should not be written to.
COMMENT ON COLUMN public.referrals.discount_applied IS
  'DEPRECATED — never written. Use cases.referral_discount (the snapshotted case column that finance subtracts).';
