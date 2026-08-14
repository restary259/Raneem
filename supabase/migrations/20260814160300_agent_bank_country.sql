-- ════════════════════════════════════════════════════════════════════════
-- Bank country selector for the premium bank-details experience.
--
-- Adds `profiles.bank_country` ('il' | 'de') so the UI can render the correct
-- Israeli or German banking fields. The IL form uses bank_name + branch +
-- account_number; the DE form uses iban + bic + bank_name. Both still write
-- to the existing shared columns so the payout infrastructure is unchanged.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bank_country text DEFAULT 'il' CHECK (bank_country IN ('il', 'de'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bic text;

-- bank_country is a user-editable preference (not a security-sensitive field
-- like iban_confirmed_at), so it is NOT guarded by restrict_profiles_write.
-- The existing trigger only blocks security-sensitive columns.

COMMIT;
