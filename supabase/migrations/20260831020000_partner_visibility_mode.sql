-- Make partner dashboard visibility explicit. Commission-only override rows
-- previously left show_all_cases NULL, which the dashboards interpreted as
-- referral-only. NULL now becomes an explicit inherit/default mode.

ALTER TABLE public.partner_commission_overrides
  ADD COLUMN IF NOT EXISTS visibility_mode text;

UPDATE public.partner_commission_overrides
SET visibility_mode = CASE
  WHEN show_all_cases IS TRUE THEN 'all_cases'
  WHEN show_all_cases IS FALSE THEN 'partner_sources'
  ELSE 'inherit'
END
WHERE visibility_mode IS NULL
   OR visibility_mode NOT IN ('inherit', 'all_cases', 'partner_sources', 'referral_only');

ALTER TABLE public.partner_commission_overrides
  ALTER COLUMN visibility_mode SET DEFAULT 'inherit',
  ALTER COLUMN visibility_mode SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partner_commission_overrides_visibility_mode_check'
      AND conrelid = 'public.partner_commission_overrides'::regclass
  ) THEN
    ALTER TABLE public.partner_commission_overrides
      ADD CONSTRAINT partner_commission_overrides_visibility_mode_check
      CHECK (visibility_mode IN ('inherit', 'all_cases', 'partner_sources', 'referral_only'));
  END IF;
END $$;
