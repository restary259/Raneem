DROP FUNCTION IF EXISTS public.get_partner_pool_cases();

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
    AND (p_sources IS NULL OR c.source = ANY(p_sources))
  ORDER BY c.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.get_partner_pool_cases(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_pool_cases(text[]) TO authenticated;