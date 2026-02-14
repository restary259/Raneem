
-- Add expanded profile fields to student_cases for Ready to Apply
ALTER TABLE public.student_cases
  ADD COLUMN IF NOT EXISTS student_address text,
  ADD COLUMN IF NOT EXISTS student_age integer,
  ADD COLUMN IF NOT EXISTS language_proficiency text,
  ADD COLUMN IF NOT EXISTS intensive_course text,
  ADD COLUMN IF NOT EXISTS passport_number text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS country_of_birth text,
  ADD COLUMN IF NOT EXISTS student_email text,
  ADD COLUMN IF NOT EXISTS student_phone text,
  ADD COLUMN IF NOT EXISTS student_full_name text;
