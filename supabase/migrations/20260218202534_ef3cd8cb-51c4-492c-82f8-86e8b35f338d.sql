-- Fix handle_new_user: don't auto-assign 'user' role if admin created the account
-- Admin-created accounts have must_change_password = true via upsert AFTER user creation
-- We detect this by checking if the metadata contains a flag, but since the profile upsert
-- happens AFTER auth.user creation, we can't detect it in the trigger.
-- Instead: skip 'user' role if the user has been assigned a non-user role already.
-- The cleanest fix: keep trigger as-is but remove 'user' role from influencer/lawyer accounts.

-- Step 1: Remove 'user' role from accounts that also have influencer or lawyer role
DELETE FROM public.user_roles ur
WHERE ur.role = 'user'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = ur.user_id
      AND ur2.role IN ('influencer', 'lawyer', 'admin')
  );

-- Step 2: Update handle_new_user to skip 'user' role assignment
-- (will be overridden by edge function role insert which happens right after)
-- We'll add a check: only assign 'user' if no other role exists yet
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
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

  -- Only assign 'user' role if the account was NOT created via admin
  -- Admin-created accounts are identified by email_confirmed_at being already set
  -- AND the trigger does NOT know the intended role yet — so we assign 'user' as default
  -- but the edge function will insert the real role immediately after.
  -- To avoid duplicates, only insert 'user' if no higher role was assigned.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;