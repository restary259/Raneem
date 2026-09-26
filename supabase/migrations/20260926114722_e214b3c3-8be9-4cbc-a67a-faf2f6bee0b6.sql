ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS preferred_major_id text;
ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_preferred_major_id_format;
ALTER TABLE public.cases ADD CONSTRAINT cases_preferred_major_id_format CHECK (preferred_major_id IS NULL OR preferred_major_id ~ '^[a-z0-9-]{2,80}$');
COMMENT ON COLUMN public.cases.preferred_major_id IS 'Student-selected major id (majorsData / Major Intelligence id) from the apply form. degree_interest keeps the raw text. Team confirmation lives in intel_major_id.';