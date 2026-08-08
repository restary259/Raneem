ALTER TABLE public.insurances
  ADD COLUMN IF NOT EXISTS age_price_tiers jsonb NOT NULL DEFAULT '[]'::jsonb;