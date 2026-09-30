-- Add the German residential address field used by the student Profile page.
-- Idempotent so it is safe to apply to environments that already have the column.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS german_address text;

COMMENT ON COLUMN public.profiles.german_address IS
  'Student residential address in Germany, stored as a free-form address string.';
