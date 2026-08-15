-- get_my_agent_students: complete, server-attributed case list for the agent
-- students page.
--
-- Replaces the previous client-side fetch on AgentStudentsPage, which:
--   1. hard-truncated results at 200 rows (`.limit(200)`), hiding students for
--      agents with larger networks; and
--   2. classified source client-side, returning "all" for any case whose
--      partner_id/referred_by matched no known recruit, so per-source chip
--      counts never summed to the "All" total.
--
-- This RPC returns every attributable case (no truncation) with a computed
-- `src` column using the same precedence as get_my_agent_kpis (self first,
-- then ambassador, then partner, else 'unknown'), so every row is attributed
-- and the per-source counts always sum to the total (minus any 'unknown').

CREATE OR REPLACE FUNCTION public.get_my_agent_students()
RETURNS TABLE (
  id uuid,
  full_name text,
  status text,
  created_at timestamptz,
  source text,
  partner_id uuid,
  referred_by uuid,
  source_attribution_method text,
  src text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_me AND ur.role = 'agent'
  ) THEN
    RAISE EXCEPTION 'Agent access required';
  END IF;

  RETURN QUERY
  WITH recruits AS (
    SELECT p.id,
           COALESCE((SELECT ur.role::text FROM public.user_roles ur
                      WHERE ur.user_id = p.id AND ur.role IN ('social_media_partner','ambassador')
                      LIMIT 1), 'social_media_partner') AS role
    FROM public.profiles p
    WHERE p.agent_id = v_me AND p.deleted_at IS NULL
  ),
  scoped AS (
    SELECT DISTINCT ON (c.id)
           c.id,
           c.full_name,
           c.status,
           c.created_at,
           c.source,
           c.partner_id,
           c.referred_by,
           c.source_attribution_method,
           CASE
             WHEN c.partner_id = v_me OR c.referred_by = v_me THEN 'self'
             WHEN r.role = 'ambassador' THEN 'ambassador'
             WHEN r.role = 'social_media_partner' THEN 'partner'
             ELSE 'unknown'
           END AS src
    FROM public.cases c
    LEFT JOIN recruits r ON r.id = c.partner_id OR r.id = c.referred_by
    WHERE COALESCE(c.archived, false) = false
      AND c.deleted_at IS NULL
      AND (c.partner_id = v_me OR c.referred_by = v_me OR r.id IS NOT NULL)
    ORDER BY c.id,
             (CASE WHEN c.partner_id = v_me OR c.referred_by = v_me THEN 0 ELSE 1 END)
  )
  SELECT id, full_name, status, created_at, source, partner_id, referred_by,
         source_attribution_method, src
  FROM scoped
  ORDER BY created_at DESC, id DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_agent_students() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_agent_students() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_agent_students() TO authenticated;
