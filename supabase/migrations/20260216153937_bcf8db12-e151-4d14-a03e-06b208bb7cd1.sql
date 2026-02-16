
-- Drop the anonymous SELECT policy that allows role enumeration
DROP POLICY IF EXISTS "Anonymous can check influencer status" ON public.user_roles;

-- Create a SECURITY DEFINER RPC to validate referral codes without exposing user_roles
CREATE OR REPLACE FUNCTION public.validate_influencer_ref(ref_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = ref_id AND role = 'influencer'
  )
$$;
