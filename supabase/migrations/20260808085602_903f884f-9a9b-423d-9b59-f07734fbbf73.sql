CREATE OR REPLACE FUNCTION public.search_cases_for_mention(p_query text)
RETURNS TABLE(id uuid, case_reference text, full_name text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.case_reference, c.full_name, c.status
  FROM public.cases c
  WHERE (
      public.has_role(auth.uid(), 'admin')
      OR (public.has_role(auth.uid(), 'team_member') AND c.assigned_to = auth.uid())
    )
    AND (
      coalesce(p_query, '') = ''
      OR c.case_reference ILIKE '%' || p_query || '%'
      OR c.full_name ILIKE '%' || p_query || '%'
    )
  ORDER BY c.last_activity_at DESC NULLS LAST
  LIMIT 8
$$;

REVOKE ALL ON FUNCTION public.search_cases_for_mention(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_cases_for_mention(text) TO authenticated;