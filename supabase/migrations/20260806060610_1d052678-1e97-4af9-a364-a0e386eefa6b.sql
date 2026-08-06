CREATE OR REPLACE FUNCTION public.check_referral_code(p_code text)
RETURNS TABLE(valid boolean, owner_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT TRUE, split_part(btrim(p.full_name), ' ', 1)
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p_code IS NOT NULL
    AND btrim(p_code) <> ''
    AND length(btrim(p_code)) <= 40
    AND lower(p.referral_code) = lower(btrim(p_code))
    AND p.referral_code_enabled = true
    AND p.deleted_at IS NULL
    AND ur.role IN ('social_media_partner', 'ambassador', 'student', 'team_member')
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.check_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_referral_code(text) TO anon, authenticated;