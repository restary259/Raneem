-- Fix cases_submitted KPI semantics.
--
-- get_my_agent_kpis previously counted BOTH 'submitted' and 'enrollment_paid'
-- cases under cases_submitted, while cases_enrolled also counted
-- 'enrollment_paid'. Every enrolled case therefore inflated both the
-- "Submitted" and "Paid cases" numbers, double-counting enrolled cases across
-- the two KPIs.
--
-- This migration redefines cases_submitted to count ONLY the 'submitted'
-- stage, so enrolled cases are no longer double-counted. No schema change;
-- the function body is rewritten in full so the corrected definition is the
-- single source of truth.

CREATE OR REPLACE FUNCTION public.get_my_agent_kpis()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_me IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_me AND ur.role = 'agent'
  ) THEN
    RAISE EXCEPTION 'Agent access required';
  END IF;

  WITH recruits AS (
    SELECT p.id,
           p.deactivated_at,
           COALESCE((SELECT ur.role::text FROM public.user_roles ur
                      WHERE ur.user_id = p.id AND ur.role IN ('social_media_partner','ambassador')
                      LIMIT 1), 'social_media_partner') AS role
    FROM public.profiles p
    WHERE p.agent_id = v_me AND p.deleted_at IS NULL
  ),
  -- Every case attributable to the agent, exactly once, tagged by source.
  scoped AS (
    SELECT DISTINCT ON (c.id)
           c.id,
           c.status,
           c.created_at,
           CASE
             WHEN c.partner_id = v_me OR c.referred_by = v_me THEN 'self'
             WHEN r.role = 'ambassador' THEN 'ambassador'
             ELSE 'partner'
           END AS src
    FROM public.cases c
    LEFT JOIN recruits r ON r.id = c.partner_id OR r.id = c.referred_by
    WHERE COALESCE(c.archived, false) = false
      AND c.deleted_at IS NULL
      AND (c.partner_id = v_me OR c.referred_by = v_me OR r.id IS NOT NULL)
    ORDER BY c.id,
             (CASE WHEN c.partner_id = v_me OR c.referred_by = v_me THEN 0 ELSE 1 END)
  ),
  rw AS (
    SELECT amount, status, unlock_at, reward_type
    FROM public.rewards WHERE user_id = v_me
  )
  SELECT jsonb_build_object(
    'partners',           (SELECT count(*) FROM recruits WHERE role = 'social_media_partner'),
    'ambassadors',        (SELECT count(*) FROM recruits WHERE role = 'ambassador'),
    'members_total',      (SELECT count(*) FROM recruits),
    'members_active',     (SELECT count(*) FROM recruits WHERE deactivated_at IS NULL),
    'students_direct',    (SELECT count(*) FROM scoped WHERE src = 'self'),
    'students_partner',   (SELECT count(*) FROM scoped WHERE src = 'partner'),
    'students_ambassador',(SELECT count(*) FROM scoped WHERE src = 'ambassador'),
    'students_network',   (SELECT count(*) FROM scoped WHERE src <> 'self'),
    'students_total',     (SELECT count(*) FROM scoped),
    'cases_new',          (SELECT count(*) FROM scoped WHERE status = 'new'),
    'cases_submitted',    (SELECT count(*) FROM scoped WHERE status = 'submitted'),
    'cases_enrolled',     (SELECT count(*) FROM scoped WHERE status = 'enrollment_paid'),
    'cases_last_30d',     (SELECT count(*) FROM scoped WHERE created_at >= now() - interval '30 days'),
    'commission_total',   (SELECT COALESCE(sum(amount),0) FROM rw),
    'commission_locked',  (SELECT COALESCE(sum(amount),0) FROM rw WHERE status IN ('pending','approved') AND unlock_at > now()),
    'commission_pending', (SELECT COALESCE(sum(amount),0) FROM rw WHERE status IN ('pending','approved') AND unlock_at <= now()),
    'commission_requested',(SELECT COALESCE(sum(amount),0) FROM rw WHERE status = 'requested'),
    'commission_paid',    (SELECT COALESCE(sum(amount),0) FROM rw WHERE status = 'paid'),
    'commission_network', (SELECT COALESCE(sum(amount),0) FROM rw WHERE reward_type = 'agent_override'),
    'commission_self',    (SELECT COALESCE(sum(amount),0) FROM rw WHERE reward_type <> 'agent_override')
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_agent_kpis() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_agent_kpis() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_agent_kpis() TO authenticated;
