-- ════════════════════════════════════════════════════════════════════════
-- Commission Hub — Migration B: ONE canonical commission engine
-- ════════════════════════════════════════════════════════════════════════
-- record_case_commission had been redefined ~16 times across the migration
-- history and get_effective_agent_split ~3 times, with the latest two
-- definitions contradicting COMMISSION_RULES.md §10 (doc said carve-from-pool;
-- live code was additive). This migration ships the SINGLE canonical version
-- of each, matching the confirmed ADDITIVE model (Rule 2: "the ₪500 agent
-- commission is NOT deducted from the Partner's commission") and adds the
-- student-referral reward branch (Rule 6). COMMISSION_RULES.md §10/§11 now
-- match this code.
--
-- CREATE OR REPLACE only affects FUTURE enrollment_paid cases. Historical
-- rewards are frozen by cases.commission_split_done + ON CONFLICT DO NOTHING,
-- so already-paid commissions are NEVER recalculated.
--
-- Model (ADDITIVE):
--   platform_revenue_ils = max(0, net − team − pool − agent_share − student_reward)
-- where net = max(0, base − referral_discount). The agent share and the
-- student-referral reward are funded from DARB's margin; the partner pool
-- (incl. master carve) is paid from the pool itself.
--
-- Worked trace (§5 of the audit): ₪5000 case, ₪0 discount, team override ₪100,
-- partner_id = Partner X (agent_id = Agent A, no master).
--   team    = ₪100
--   pool    = ₪1000  (partner keeps full share)
--   agent   = ₪500   (additive, from margin)
--   platform_revenue = max(0, 5000 − 100 − 1000 − 500) = ₪3400
-- Three reward rows: team(₪100), referral/partner(₪1000), agent_override(₪500).
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. get_effective_agent_split — ADDITIVE, no pool clamp ────────────────
-- Returns (agent_amount, agent_id, pool_amount). The agent_amount is resolved
-- from the per-agent override or the global default, then floored at 0. It is
-- NOT clamped to the pool because it is paid on top of the pool from DARB's
-- margin. (The carve variant clamped with GREATEST(0, LEAST(amount, pool));
-- that is no longer the model.)
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

  -- Additive: paid on top of the pool, absorbed by DARB's margin. Floor at 0
  -- only — never cap to the pool.
  v_amount := GREATEST(0, v_amount);
  RETURN QUERY SELECT v_amount, p_agent_id, v_pool;
END;
$$;

REVOKE ALL ON FUNCTION public.get_effective_agent_split(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_effective_agent_split(uuid, uuid) TO authenticated, service_role;

-- ── 2. partner_base_pool — pure override/global lookup ───────────────────
-- Kept as a pure lookup: per-account override wins, else the global default.
-- Role enforcement lives in record_case_commission (v_is_partner) — putting a
-- role check here would make get_effective_partner_split silently return ₪0
-- for a partner whose user_roles row is stale, which is a silent-failure
-- money bug. A pure lookup is predictable and testable.
CREATE OR REPLACE FUNCTION public.partner_base_pool(p_partner_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool integer;
BEGIN
  IF p_partner_id IS NULL THEN RETURN 0; END IF;

  SELECT commission_amount INTO v_pool
  FROM partner_commission_overrides WHERE partner_id = p_partner_id;
  IF v_pool IS NULL THEN
    SELECT COALESCE(partner_commission_rate, 0) INTO v_pool FROM platform_settings LIMIT 1;
  END IF;
  RETURN COALESCE(v_pool, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.partner_base_pool(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_base_pool(uuid) TO authenticated, service_role;

-- ── 3. get_student_referral_reward — resolve a student referrer's reward ───
-- Per-student override (by referral_type) wins; otherwise the global default.
-- Returns 0 for an unknown/NULL referral_type (legacy rows pay ₪0, preserving
-- isolation and the no-unsafe-default rule). This is ONLY called when the
-- referrer is a student (not a partner/ambassador/agent).
CREATE OR REPLACE FUNCTION public.get_student_referral_reward(p_student_id uuid, p_referral_type text)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_override numeric;
  v_amount integer := 0;
  v_type text;
BEGIN
  IF p_student_id IS NULL THEN RETURN 0; END IF;
  v_type := lower(COALESCE(p_referral_type, ''));
  IF v_type NOT IN ('friend', 'family') THEN
    RETURN 0;
  END IF;

  SELECT reward_amount INTO v_override
  FROM student_referral_reward_overrides
  WHERE student_id = p_student_id AND referral_type = v_type;
  IF v_override IS NOT NULL THEN
    v_amount := v_override::integer;
  ELSE
    SELECT CASE v_type
             WHEN 'friend' THEN COALESCE(student_refer_friend_reward, 0)
             WHEN 'family' THEN COALESCE(student_refer_family_reward, 0)
           END
    INTO v_amount FROM platform_settings LIMIT 1;
  END IF;

  RETURN GREATEST(0, v_amount);
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_referral_reward(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_referral_reward(uuid, text) TO authenticated, service_role;

-- ── 4. record_case_commission — the ONE canonical engine ──────────────────
-- Additive agent + student-referral branch + role-check isolation. Runs once
-- per case at enrollment_paid (auto_split_payment trigger), idempotent via
-- commission_split_done + ON CONFLICT (case_id, user_id, reward_type) DO NOTHING.
CREATE OR REPLACE FUNCTION public.record_case_commission(p_case_id uuid, p_total_payment_ils integer DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_case RECORD;
  v_base integer := 0;
  v_net integer := 0;
  v_t_comm integer := 0;
  v_pool integer := 0;
  v_partner_comm integer := 0;
  v_master_share integer := 0;
  v_master uuid;
  v_partner_id uuid;
  v_is_partner boolean := false;
  v_is_agent_self_referral boolean := false;
  v_is_student_referrer boolean := false;
  v_agent_self_amount integer := 0;
  v_split RECORD;
  v_agent uuid;
  v_agent_share integer := 0;
  v_agent_split RECORD;
  v_student_reward integer := 0;
  v_referral_type text;
  v_admin_remainder integer := 0;
  v_global_team_rate integer := 100;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('case_commission:' || p_case_id::text));

  SELECT id, assigned_to, source, partner_id, referred_by, status, case_reference,
         commission_split_done, referral_discount
  INTO v_case FROM cases WHERE id = p_case_id;
  IF NOT FOUND OR v_case.commission_split_done THEN RETURN; END IF;
  IF v_case.status IS DISTINCT FROM 'enrollment_paid' THEN
    RAISE EXCEPTION 'Commission can only be recorded once the case reaches enrollment_paid (current: %)', v_case.status;
  END IF;

  -- Gross base — matches get_case_darb_service_total (no currency filter: DARB
  -- service lines are always ILS, and the read functions sum all rows).
  SELECT COALESCE(SUM(GREATEST(unit_price * quantity - discount, 0)), 0)::integer
  INTO v_base
  FROM case_services
  WHERE case_id = p_case_id;

  IF v_base <= 0 THEN
    RAISE EXCEPTION 'Cannot record commission: the case has no positive DARB service total';
  END IF;

  -- Net base after the referral discount (the amount the student was invoiced).
  v_net := GREATEST(v_base - COALESCE(v_case.referral_discount, 0), 0);

  SELECT COALESCE(team_member_commission_rate, 100)
  INTO v_global_team_rate
  FROM platform_settings LIMIT 1;

  -- ── Team commission (flat, from margin, independent of the referral chain) ─
  IF v_case.assigned_to IS NOT NULL THEN
    SELECT commission_amount INTO v_t_comm
    FROM team_member_commission_overrides
    WHERE team_member_id = v_case.assigned_to;
    v_t_comm := COALESCE(v_t_comm, v_global_team_rate);
    IF v_t_comm > 0 THEN
      INSERT INTO rewards (
        user_id, amount, status, case_id, reward_type, admin_notes,
        recipient_role, case_reference, rate_used, base_amount, rate_source,
        unlock_at, created_by_event
      ) VALUES (
        v_case.assigned_to, v_t_comm, 'pending', p_case_id, 'team',
        'Team commission from case ' || COALESCE(v_case.case_reference, p_case_id::text),
        'team_member', v_case.case_reference, v_t_comm, v_base, 'calculated_service_total',
        now() + interval '20 days', 'case_enrollment_paid'
      ) ON CONFLICT (case_id, user_id, reward_type) WHERE case_id IS NOT NULL DO NOTHING;
    END IF;
  END IF;

  -- ── Resolve the referrer and classify the chain ──────────────────────────
  v_partner_id := COALESCE(v_case.partner_id, v_case.referred_by);
  IF v_partner_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = v_partner_id AND ur.role IN ('social_media_partner', 'ambassador')
    ) INTO v_is_partner;

    IF NOT v_is_partner THEN
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = v_partner_id AND ur.role = 'agent'
      ) INTO v_is_agent_self_referral;
    END IF;

    IF NOT v_is_partner AND NOT v_is_agent_self_referral THEN
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = v_partner_id AND ur.role = 'student'
      ) INTO v_is_student_referrer;
    END IF;
  END IF;

  IF v_is_student_referrer THEN
    -- ── Student → Student referral (Rule 6, ISOLATED) ───────────────────────
    -- Pays ONLY the referring student a flat reward. NEVER propagates upstream
    -- (no partner pool, no agent override, no master share). The reward is
    -- funded from DARB's margin, parallel to the referral discount the friend
    -- already received. referral_type comes from the referrals row.
    SELECT referral_type INTO v_referral_type
    FROM public.referrals
    WHERE referred_case_id = p_case_id
    ORDER BY created_at DESC
    LIMIT 1;

    v_student_reward := public.get_student_referral_reward(v_partner_id, v_referral_type);
    IF v_student_reward > 0 THEN
      INSERT INTO rewards (
        user_id, amount, status, case_id, reward_type, source_user_id, admin_notes,
        recipient_role, case_reference, rate_used, base_amount, rate_source,
        unlock_at, created_by_event
      ) VALUES (
        v_partner_id, v_student_reward, 'pending', p_case_id, 'student_referral', v_partner_id,
        'Student ' || COALESCE(v_referral_type, 'referral') || ' referral reward from case '
          || COALESCE(v_case.case_reference, p_case_id::text),
        'student', v_case.case_reference, v_student_reward, v_base, 'calculated_service_total',
        now() + interval '20 days', 'case_enrollment_paid'
      ) ON CONFLICT (case_id, user_id, reward_type) WHERE case_id IS NOT NULL DO NOTHING;
    END IF;

  ELSIF v_is_agent_self_referral THEN
    -- ── Agent self-referral (agent is the direct referrer) ──────────────────
    -- Pays the self-referral rate as a 'referral' reward. NO agent_override
    -- reward is created (isolation: self-referral is not a network override).
    SELECT amount INTO v_agent_self_amount FROM public.get_effective_agent_self_referral(v_partner_id);
    v_agent_self_amount := COALESCE(v_agent_self_amount, 0);
    IF v_agent_self_amount > 0 THEN
      INSERT INTO rewards (
        user_id, amount, status, case_id, reward_type, admin_notes,
        recipient_role, case_reference, rate_used, base_amount, rate_source,
        unlock_at, created_by_event
      ) VALUES (
        v_partner_id, v_agent_self_amount, 'pending', p_case_id, 'referral',
        'Agent self-referral from case ' || COALESCE(v_case.case_reference, p_case_id::text),
        'agent', v_case.case_reference, v_agent_self_amount, v_base, 'calculated_service_total',
        now() + interval '20 days', 'case_enrollment_paid'
      ) ON CONFLICT (case_id, user_id, reward_type) WHERE case_id IS NOT NULL DO NOTHING;
    END IF;

  ELSIF v_is_partner THEN
    -- ── Partner / Ambassador referral (the professional pool) ───────────────
    SELECT * INTO v_split FROM public.get_effective_partner_split(v_partner_id);
    v_pool := COALESCE(v_split.pool_amount, 0);
    v_partner_comm := COALESCE(v_split.partner_amount, 0);
    v_master_share := COALESCE(v_split.master_share, 0);
    v_master := v_split.master_partner_id;

    -- Agent override is ADDITIVE: paid on top of the pool, from DARB's margin.
    -- The partner keeps their full pool share.
    SELECT p.agent_id INTO v_agent FROM public.profiles p WHERE p.id = v_partner_id;
    IF v_agent IS NOT NULL AND v_agent <> v_partner_id THEN
      SELECT * INTO v_agent_split FROM public.get_effective_agent_split(v_agent, v_partner_id);
      v_agent_share := GREATEST(0, COALESCE(v_agent_split.agent_amount, 0));
    END IF;

    -- Master carve is from the pool (section 8), independent of the agent.
    v_master_share := GREATEST(0, LEAST(v_master_share, v_pool));
    v_partner_comm := GREATEST(0, v_pool - v_master_share);

    IF v_partner_comm > 0 THEN
      INSERT INTO rewards (
        user_id, amount, status, case_id, reward_type, admin_notes,
        recipient_role, case_reference, rate_used, base_amount, rate_source,
        unlock_at, created_by_event
      ) VALUES (
        v_partner_id, v_partner_comm, 'pending', p_case_id, 'referral',
        'Partner commission from case ' || COALESCE(v_case.case_reference, p_case_id::text),
        'partner', v_case.case_reference, v_partner_comm, v_pool, 'calculated_service_total',
        now() + interval '20 days', 'case_enrollment_paid'
      ) ON CONFLICT (case_id, user_id, reward_type) WHERE case_id IS NOT NULL DO NOTHING;
    END IF;

    IF v_master IS NOT NULL AND v_master <> v_partner_id AND v_master_share > 0 THEN
      INSERT INTO rewards (
        user_id, amount, status, case_id, reward_type, source_user_id, admin_notes,
        recipient_role, case_reference, rate_used, base_amount, rate_source,
        unlock_at, created_by_event
      ) VALUES (
        v_master, v_master_share, 'pending', p_case_id, 'master_partner', v_partner_id,
        'Recruitment share from case ' || COALESCE(v_case.case_reference, p_case_id::text),
        'master_partner', v_case.case_reference, v_master_share, v_pool, 'calculated_service_total',
        now() + interval '20 days', 'case_enrollment_paid'
      ) ON CONFLICT (case_id, user_id, reward_type) WHERE case_id IS NOT NULL DO NOTHING;
    END IF;

    IF v_agent IS NOT NULL AND v_agent <> v_partner_id AND v_agent_share > 0 THEN
      INSERT INTO rewards (
        user_id, amount, status, case_id, reward_type, source_user_id, admin_notes,
        recipient_role, case_reference, rate_used, base_amount, rate_source,
        unlock_at, created_by_event
      ) VALUES (
        v_agent, v_agent_share, 'pending', p_case_id, 'agent_override', v_partner_id,
        'Agent recruitment share from case ' || COALESCE(v_case.case_reference, p_case_id::text),
        'agent', v_case.case_reference, v_agent_share, v_agent_share, 'calculated_service_total',
        now() + interval '20 days', 'case_enrollment_paid'
      ) ON CONFLICT (case_id, user_id, reward_type) WHERE case_id IS NOT NULL DO NOTHING;
    END IF;
  END IF;

  -- Referral lifecycle milestone.
  UPDATE public.referrals
     SET status = 'rewarded'
   WHERE referred_case_id = p_case_id
     AND status IS DISTINCT FROM 'rewarded';

  -- ── Platform revenue (ADDITIVE model) ────────────────────────────────────
  IF v_is_agent_self_referral THEN
    v_admin_remainder := GREATEST(0, v_net - v_t_comm - v_agent_self_amount);
  ELSIF v_is_student_referrer THEN
    v_admin_remainder := GREATEST(0, v_net - v_t_comm - v_student_reward);
  ELSE
    v_admin_remainder := GREATEST(0, v_net - v_t_comm - v_pool - v_agent_share);
  END IF;

  UPDATE cases
  SET platform_revenue_ils = v_admin_remainder,
      commission_split_done = true
  WHERE id = p_case_id;

  PERFORM public.log_case_event(
    p_case_id,
    'commission_recorded',
    jsonb_build_object(
      'base_amount', v_base,
      'net_after_discount', v_net,
      'team_amount', v_t_comm,
      'partner_pool', v_pool,
      'partner_amount', v_partner_comm,
      'master_share', v_master_share,
      'agent_share', v_agent_share,
      'agent_id', v_agent,
      'agent_self_referral', v_is_agent_self_referral,
      'agent_self_referral_amount', v_agent_self_amount,
      'student_referrer', v_is_student_referrer,
      'student_referrer_reward', v_student_reward,
      'student_referral_type', v_referral_type,
      'platform_revenue', v_admin_remainder,
      'referral_discount', COALESCE(v_case.referral_discount, 0),
      'model', 'additive',
      'source', 'case_services'
    ),
    true
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_case_commission(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_case_commission(uuid, integer) TO authenticated, service_role;

