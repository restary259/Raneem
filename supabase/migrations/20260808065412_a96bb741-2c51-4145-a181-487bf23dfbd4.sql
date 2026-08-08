ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS price_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cefr_range text,
  ADD COLUMN IF NOT EXISTS hours_per_week numeric,
  ADD COLUMN IF NOT EXISTS start_rule text,
  ADD COLUMN IF NOT EXISTS registration_fee numeric,
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL;

ALTER TABLE public.accommodations
  ADD COLUMN IF NOT EXISTS price_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS deposit numeric,
  ADD COLUMN IF NOT EXISTS placement_fee numeric,
  ADD COLUMN IF NOT EXISTS meals text,
  ADD COLUMN IF NOT EXISTS room_type text,
  ADD COLUMN IF NOT EXISTS distance_note text;

CREATE INDEX IF NOT EXISTS idx_programs_school_id ON public.programs(school_id);