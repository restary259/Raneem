CREATE OR REPLACE FUNCTION public.get_partner_pool_cases(p_sources text[] DEFAULT NULL)
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
    AND (
      p_sources IS NULL
      OR c.source = ANY(p_sources)
    )
    AND (
      c.partner_id = auth.uid()
      OR c.referred_by = auth.uid()
      OR COALESCE(
        (SELECT ps.partner_dashboard_show_all_cases FROM public.platform_settings ps LIMIT 1),
        false
      ) = true
    )
$$;

REVOKE ALL ON FUNCTION public.get_partner_pool_cases(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_pool_cases(text[]) TO authenticated;
