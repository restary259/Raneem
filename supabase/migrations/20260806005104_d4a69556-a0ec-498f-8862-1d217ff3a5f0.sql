-- 1. Partner case visibility: replace blanket read with own-cases-only
DROP POLICY IF EXISTS "Partner can view all cases" ON public.cases;

CREATE POLICY "Partners can view their own cases"
ON public.cases
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'social_media_partner'::app_role)
  AND (partner_id = auth.uid() OR referred_by = auth.uid())
);

-- Pool-mode reader: reduced column set, only when pool mode is enabled
CREATE OR REPLACE FUNCTION public.get_partner_pool_cases()
RETURNS TABLE (
  id uuid,
  full_name text,
  status text,
  source text,
  created_at timestamptz,
  education_level text,
  degree_interest text,
  partner_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.full_name, c.status, c.source, c.created_at,
         c.education_level, c.degree_interest, c.partner_id
  FROM public.cases c
  WHERE c.deleted_at IS NULL
    AND public.has_role(auth.uid(), 'social_media_partner'::app_role)
    AND COALESCE(
      (SELECT ps.partner_dashboard_show_all_cases FROM public.platform_settings ps LIMIT 1),
      false
    ) = true
$$;

REVOKE ALL ON FUNCTION public.get_partner_pool_cases() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_pool_cases() TO authenticated;

-- 2. platform_settings: restrict reads to staff + partners
DROP POLICY IF EXISTS "All authenticated can read settings" ON public.platform_settings;

CREATE POLICY "Staff and partners can read settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'team_member'::app_role)
  OR public.has_role(auth.uid(), 'social_media_partner'::app_role)
);