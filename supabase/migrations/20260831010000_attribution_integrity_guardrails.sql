-- Admin-visible attribution integrity guardrails.
-- Surfaces orphaned public-flow cases and duplicate-phone clusters with split
-- attribution. Detection only: recovery stays additive and manual.

CREATE OR REPLACE FUNCTION public.list_attribution_integrity_issues()
RETURNS TABLE(
  issue_type text,
  case_id uuid,
  full_name text,
  phone_number text,
  source text,
  created_at timestamp with time zone,
  confidence text,
  suggested_partner_id uuid,
  suggested_referred_by uuid,
  evidence text,
  cluster_size bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH normalized_cases AS (
    SELECT c.id, c.full_name, c.phone_number, c.source, c.created_at,
           c.partner_id, c.referred_by, c.partner_link_id,
           regexp_replace(coalesce(c.phone_number, ''), '\D', '', 'g') AS normalized_phone
    FROM public.cases c
    WHERE c.deleted_at IS NULL
  ),
  orphan_candidates AS (
    SELECT c.id, c.full_name, c.phone_number, c.source, c.created_at,
           pl.partner_id AS evidence_partner_link_id,
           r.referrer_user_id AS evidence_referrer_id,
           attr.partner_id AS evidence_phone_partner_id,
           attr.source AS evidence_phone_source,
           CASE
             WHEN pl.partner_id IS NOT NULL THEN 'HIGH'
             WHEN r.referrer_user_id IS NOT NULL THEN 'HIGH'
             WHEN attr.partner_id IS NOT NULL THEN 'MEDIUM'
             ELSE 'NONE'
           END AS confidence,
           CASE
             WHEN pl.partner_id IS NOT NULL THEN 'active partner link'
             WHEN r.referrer_user_id IS NOT NULL THEN 'referral row'
             WHEN attr.partner_id IS NOT NULL THEN 'same normalized phone as attributed case'
             ELSE 'no attribution evidence'
           END AS evidence
    FROM normalized_cases c
    LEFT JOIN public.partner_links pl
      ON pl.id = c.partner_link_id
     AND pl.active = true
    LEFT JOIN public.referrals r
      ON r.referred_case_id = c.id
    LEFT JOIN LATERAL (
      SELECT c2.partner_id, c2.source
      FROM normalized_cases c2
      WHERE c2.normalized_phone = c.normalized_phone
        AND c2.normalized_phone <> ''
        AND c2.id <> c.id
        AND c2.partner_id IS NOT NULL
      ORDER BY c2.created_at DESC
      LIMIT 1
    ) attr ON true
    WHERE c.partner_id IS NULL
      AND c.referred_by IS NULL
      AND c.source IN ('contact_form', 'apply_page', 'referral', 'submit_new_student')
  ),
  duplicate_clusters AS (
    SELECT c.normalized_phone,
           count(*) AS cluster_size
    FROM normalized_cases c
    WHERE c.normalized_phone <> ''
    GROUP BY c.normalized_phone
    HAVING count(*) > 1
       AND count(*) FILTER (WHERE c.partner_id IS NULL AND c.referred_by IS NULL) > 0
       AND count(*) FILTER (WHERE c.partner_id IS NOT NULL OR c.referred_by IS NOT NULL) > 0
  )
  SELECT *
  FROM (
    SELECT 'orphan_candidate'::text AS issue_type,
           o.id,
           o.full_name,
           o.phone_number,
           o.source,
           o.created_at,
           o.confidence,
           COALESCE(o.evidence_partner_link_id, o.evidence_phone_partner_id),
           o.evidence_referrer_id,
           o.evidence,
           NULL::bigint AS cluster_size
    FROM orphan_candidates o

    UNION ALL

    SELECT 'duplicate_phone_cluster'::text,
           c.id,
           c.full_name,
           c.phone_number,
           c.source,
           c.created_at,
           'REVIEW'::text,
           NULL::uuid,
           NULL::uuid,
           'same normalized phone has attributed and unattributed rows'::text,
           dc.cluster_size
    FROM normalized_cases c
    JOIN duplicate_clusters dc ON dc.normalized_phone = c.normalized_phone
  ) issues
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY issue_type, confidence, created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.list_attribution_integrity_issues() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_attribution_integrity_issues() TO authenticated;
