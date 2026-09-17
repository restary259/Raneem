ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS intel_major_id text,
  ADD COLUMN IF NOT EXISTS intel_major_confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS intel_major_confirmed_at timestamptz;

COMMENT ON COLUMN public.cases.intel_major_id IS 'Confirmed DARB Major Intelligence major id. Suggested from degree_interest, always confirmed by a human. degree_interest stays the raw student text.';