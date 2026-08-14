
-- 1. Agent reward is ADDITIVE: never clamp it to the partner pool.
CREATE OR REPLACE FUNCTION public.get_effective_agent_split(p_agent_id uuid, p_recruited_partner_id uuid)
RETURNS TABLE(agent_amount integer, agent_id uuid, pool_amount integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool integer;
  v_amount integer := 0;
  v_override numeric;
BEGIN
  v_pool := public.partner_base_pool(p_recruited_partner_id);
  IF p_agent_id IS NULL THEN
    RETURN QUERY SELECT 0, NULL::uuid, v_pool;
    RETURN;
  END IF;

  SELECT commission_amount INTO v_override
  FROM agent_commission_overrides WHERE agent_id = p_agent_id;
  IF v_override IS NOT NULL THEN
    v_amount := v_override::integer;
  ELSE
    SELECT COALESCE(agent_commission_rate, 0) INTO v_amount FROM platform_settings LIMIT 1;
  END IF;

  -- Additive model: the agent share is paid on top of the partner pool and is
  -- absorbed by DARB's margin, so it is NOT capped by the pool.
  v_amount := GREATEST(0, v_amount);
  RETURN QUERY SELECT v_amount, p_agent_id, v_pool;
END;
$$;

-- 2. Network list: count a recruit's cases via partner_id OR referred_by,
--    excluding archived / soft-deleted cases. No double counting (per case id).
CREATE OR REPLACE FUNCTION public.get_my_agent_network()
RETURNS TABLE(
  partner_id uuid,
  full_name text,
  email text,
  city text,
  referral_code text,
  joined_at timestamptz,
  status text,
  students_count bigint,
  paid_cases bigint,
  override_earned numeric,
  agent_amount integer,
  role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT id FROM public.profiles
    WHERE id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'agent')
  ),
  recruits AS (
    SELECT p.id, p.full_name, p.email, p.city, p.referral_code, p.created_at, p.deactivated_at
    FROM public.profiles p
    JOIN me ON p.agent_id = me.id
    WHERE p.deleted_at IS NULL
  )
  SELECT r.id,
         r.full_name,
         r.email,
         r.city,
         r.referral_code,
         r.created_at,
         CASE WHEN r.deactivated_at IS NULL THEN 'active' ELSE 'inactive' END,
         (SELECT count(DISTINCT c.id) FROM public.cases c
           WHERE (c.partner_id = r.id OR c.referred_by = r.id)
             AND COALESCE(c.archived, false) = false
             AND c.deleted_at IS NULL),
         (SELECT count(DISTINCT c.id) FROM public.cases c
           WHERE (c.partner_id = r.id OR c.referred_by = r.id)
             AND COALESCE(c.archived, false) = false
             AND c.deleted_at IS NULL
             AND c.status = 'enrollment_paid'),
         (SELECT COALESCE(sum(rw.amount), 0) FROM public.rewards rw
           WHERE rw.user_id = auth.uid()
             AND rw.reward_type = 'agent_override'
             AND rw.source_user_id = r.id),
         COALESCE((SELECT eas.agent_amount FROM public.get_effective_agent_split(auth.uid(), r.id) eas), 0),
         COALESCE((SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = r.id AND ur.role IN ('social_media_partner','ambassador') LIMIT 1), 'social_media_partner')
  FROM recruits r
  ORDER BY r.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.get_my_agent_network() TO authenticated;

-- 3. One authoritative KPI function for the agent dashboard.
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
    'cases_submitted',    (SELECT count(*) FROM scoped WHERE status IN ('submitted','enrollment_paid')),
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

REVOKE ALL ON FUNCTION public.get_my_agent_kpis() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_agent_kpis() TO authenticated;

-- 4. RLS: agents must also see cases where a network recruit is the referrer.
DROP POLICY IF EXISTS "Agents can view network and self-referral cases" ON public.cases;
CREATE POLICY "Agents can view network and self-referral cases"
ON public.cases FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'agent')
  AND (
    partner_id = auth.uid()
    OR referred_by = auth.uid()
    OR public.agent_owns_recruit(partner_id, auth.uid())
    OR public.agent_owns_recruit(referred_by, auth.uid())
  )
);
