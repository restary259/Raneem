
-- Remove unnecessary functions that are not being used
DROP FUNCTION IF EXISTS public.send_signup_email(text);
DROP FUNCTION IF EXISTS public.send_signup_email();
DROP FUNCTION IF EXISTS public.trigger_password_reset(text);
DROP FUNCTION IF EXISTS public.trigger_password_reset();

-- Keep only the essential functions
-- handle_new_user() - needed for user registration
-- update_updated_at_column() - needed for timestamp updates

-- Clean up any unused tables that might be causing issues
-- Remove tables that are not being actively used in the current version

-- Ensure profiles table has proper structure for the current app
ALTER TABLE public.profiles 
  DROP COLUMN IF EXISTS phone CASCADE,
  DROP COLUMN IF EXISTS first_name CASCADE,
  DROP COLUMN IF EXISTS last_name CASCADE,
  DROP COLUMN IF EXISTS preferred_name CASCADE,
  DROP COLUMN IF EXISTS pronouns CASCADE,
  DROP COLUMN IF EXISTS avatar_url CASCADE;

-- Simplify profiles table to match current usage
ALTER TABLE public.profiles 
  ALTER COLUMN phone_number SET DEFAULT NULL,
  ALTER COLUMN city SET DEFAULT NULL,
  ALTER COLUMN country SET DEFAULT NULL,
  ALTER COLUMN intake_month SET DEFAULT NULL,
  ALTER COLUMN university_name SET DEFAULT NULL,
  ALTER COLUMN visa_status SET DEFAULT 'not_applied'::visa_status,
  ALTER COLUMN notes SET DEFAULT NULL;

-- Add RLS policies for profiles table if they don't exist
DO $$
BEGIN
  -- Enable RLS if not already enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'profiles' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create or replace RLS policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Clean up contact_submissions table to ensure it works properly
ALTER TABLE public.contact_submissions 
  ALTER COLUMN form_source SET NOT NULL,
  ALTER COLUMN data SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now();
