-- Structured home address + nationality default for the onboarding wizard.
--
-- The wizard's "Address / country" step was a single free-text field stored in
-- profiles.country. It is now three structured fields (street, house number,
-- residential city). The legacy profiles.country column is kept and written as
-- a combined "Street Housenumber, City" string on save so every existing
-- reader (AdminStudentsPage "Address / Country", StudentProfile home_address)
-- keeps working unchanged. The new columns are nullable so old profiles are
-- not re-gated by isProfileComplete (it accepts the new fields OR country).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS house_number text,
  ADD COLUMN IF NOT EXISTS residential_city text;
