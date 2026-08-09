ALTER TABLE public.case_submissions
  ADD COLUMN IF NOT EXISTS program_weeks integer,
  ADD COLUMN IF NOT EXISTS accommodation_weeks integer,
  ADD COLUMN IF NOT EXISTS program_weekly_price numeric,
  ADD COLUMN IF NOT EXISTS accommodation_weekly_price numeric;

COMMENT ON COLUMN public.case_submissions.program_price IS 'Total program cost = program_weekly_price * program_weeks';
COMMENT ON COLUMN public.case_submissions.accommodation_price IS 'Total accommodation cost = accommodation_weekly_price * accommodation_weeks';