-- 1. Staff directory: names/roles only, no financial or identity fields
CREATE OR REPLACE FUNCTION public.get_staff_directory()
RETURNS TABLE (id uuid, full_name text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, ur.role::text
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role IN ('team_member','admin','social_media_partner')
    AND p.deleted_at IS NULL
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'team_member'::app_role)
    )
$$;

REVOKE ALL ON FUNCTION public.get_staff_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_directory() TO authenticated;

-- 2. Remove broad staff-to-staff profile reads (bank/IBAN/passport exposure)
DROP POLICY IF EXISTS "Team members can view team profiles" ON public.profiles;

CREATE POLICY "Admins can view staff profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- 3. Eligibility scoring rules: staff only
DROP POLICY IF EXISTS "Authenticated users can view eligibility config" ON public.eligibility_config;
CREATE POLICY "Staff can view eligibility config"
ON public.eligibility_config
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'team_member'::app_role)
  OR public.has_role(auth.uid(), 'social_media_partner'::app_role)
);

DROP POLICY IF EXISTS "Authenticated can view thresholds" ON public.eligibility_thresholds;
CREATE POLICY "Staff can view thresholds"
ON public.eligibility_thresholds
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'team_member'::app_role)
  OR public.has_role(auth.uid(), 'social_media_partner'::app_role)
);