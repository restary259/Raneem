ALTER TABLE public.school_level_durations
  ADD COLUMN IF NOT EXISTS weeks_max integer,
  ADD COLUMN IF NOT EXISTS hours_min integer,
  ADD COLUMN IF NOT EXISTS hours_max integer;

ALTER TABLE public.school_accommodation_price_tiers
  ADD COLUMN IF NOT EXISTS extra_day_price numeric;

ALTER TABLE public.partner_schools
  ADD COLUMN IF NOT EXISTS featured_weeks integer,
  ADD COLUMN IF NOT EXISTS featured_note_en text,
  ADD COLUMN IF NOT EXISTS featured_note_ar text;