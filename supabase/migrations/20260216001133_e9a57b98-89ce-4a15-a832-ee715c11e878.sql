
-- Add consent tracking fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS consent_version TEXT DEFAULT NULL;

-- Update handle_new_user to pull more metadata into profile on account activation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone_number, country, influencer_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم جديد'),
    NEW.raw_user_meta_data->>'phone_number',
    NEW.raw_user_meta_data->>'country',
    CASE WHEN NEW.raw_user_meta_data->>'influencer_id' IS NOT NULL
         THEN (NEW.raw_user_meta_data->>'influencer_id')::uuid
         ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    phone_number = COALESCE(EXCLUDED.phone_number, profiles.phone_number),
    country = COALESCE(EXCLUDED.country, profiles.country),
    influencer_id = COALESCE(EXCLUDED.influencer_id, profiles.influencer_id),
    updated_at = now();
  
  -- Auto-assign user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$function$;
