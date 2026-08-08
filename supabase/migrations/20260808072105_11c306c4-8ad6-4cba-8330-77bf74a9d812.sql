ALTER TABLE public.insurances
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS coverage_scope text,
  ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS min_months integer,
  ADD COLUMN IF NOT EXISTS max_months integer,
  ADD COLUMN IF NOT EXISTS max_age integer,
  ADD COLUMN IF NOT EXISTS waiting_periods jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS terms_url text,
  ADD COLUMN IF NOT EXISTS description_ar text,
  ADD COLUMN IF NOT EXISTS description_en text;