-- Restrict SECURITY DEFINER commission function grants (code-review fixes).
--
-- H1 (CRITICAL): the canonical record_case_commission (20260816010000 /
-- 20260817010000 / 20260817040000) granted EXECUTE to `authenticated`, where
-- the pre-canonical versions (20260806001221 / 20260809163608) granted
-- service_role only. record_case_commission is SECURITY DEFINER with no caller
-- gate, so any signed-in user who knew a case UUID could record commissions,
-- freeze the immutable financial snapshot, and lock attribution. No frontend
-- or edge caller needs authenticated EXECUTE.
--
-- M2: partner_base_pool and get_student_referral_reward are STABLE SECURITY
-- DEFINER config lookups with no direct client callers — restrict to
-- service_role. get_effective_agent_split IS called by the admin commission
-- preview (AdminSubmissionsPage), so it stays callable by authenticated but
-- gains an authorization gate (admin / agent-self / the trusted
-- app.internal_commission_split GUC). The GUC exemption is required because
-- record_case_commission calls it under a service-role session (auth.uid() is
-- NULL there) — a naive role gate would break commission recording via the
-- auto_split_payment trigger (admin-mark-paid edge function).

-- 1. record_case_commission — service_role ONLY (restores pre-canonical grant).
REVOKE ALL ON FUNCTION public.record_case_commission(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_case_commission(uuid, integer) TO service_role;

-- 2. partner_base_pool / get_student_referral_reward — service_role ONLY
-- (no direct client callers; internal SECURITY DEFINER owner calls are
-- unaffected by grants).
REVOKE ALL ON FUNCTION public.partner_base_pool(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.partner_base_pool(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_student_referral_reward(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_referral_reward(uuid, text) TO service_role;

-- 3. get_effective_agent_split — keep authenticated (admin preview) but add an
-- authorization gate. Body is byte-for-byte identical to 20260816010000
-- otherwise (additive model, no pool clamp).
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
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR (p_agent_id IS NOT NULL AND p_agent_id = auth.uid())
          OR COALESCE(current_setting('app.internal_commission_split', true), '') = 'on') THEN
    RAISE EXCEPTION 'Insufficient privileges to view this agent split';
  END IF;

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

-- 4. record_case_commission — full CREATE OR REPLACE of the 20260817040000
-- canonical engine, byte-for-byte identical EXCEPT the internal
-- get_effective_agent_split call is wrapped in the trusted
-- app.internal_commission_split GUC so the engine keeps working under a
-- service-role session (auth.uid() IS NULL). The GUC is reset to 'off'
-- immediately after the call, so nothing else in the transaction is affected.
-- Grant restricted to service_role (step 1).
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
  v_total_payouts integer := 0;
  v_referrer_role text;
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

  -- ── Resolve the referrer and classify the chain (attribution priority) ────
  -- ATTRIBUTION PRIORITY (deterministic, single winner):
  --   1. cases.partner_id wins over cases.referred_by (COALESCE order).
  --   2. Role lookup on the winner: partner/ambassador > agent (self-ref) > student.
  --      The first match wins — no fallback chain once a role is found.
  --   3. Student referrals create a NEW attribution boundary (Rule 6, ISOLATED):
  --      they pay ONLY the referring student and NEVER propagate upstream.
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
    SELECT p.agent_id INTO v_agent FROM public.profiles p WHERE p.id = v_partner_id;
    IF v_agent IS NOT NULL AND v_agent <> v_partner_id THEN
      PERFORM set_config('app.internal_commission_split', 'on', true);
      SELECT * INTO v_agent_split FROM public.get_effective_agent_split(v_agent, v_partner_id);
      PERFORM set_config('app.internal_commission_split', 'off', true);
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
    v_total_payouts := v_t_comm + v_agent_self_amount;
    v_referrer_role := 'agent';
  ELSIF v_is_student_referrer THEN
    v_admin_remainder := GREATEST(0, v_net - v_t_comm - v_student_reward);
    v_total_payouts := v_t_comm + v_student_reward;
    v_referrer_role := 'student';
  ELSE
    v_admin_remainder := GREATEST(0, v_net - v_t_comm - v_pool - v_agent_share);
    v_total_payouts := v_t_comm + v_pool + v_agent_share;
    v_referrer_role := CASE WHEN v_partner_id IS NOT NULL THEN 'partner' ELSE NULL END;
  END IF;

  -- ── G2: Margin-safety warning (non-blocking) ─────────────────────────────
  IF v_total_payouts > v_net THEN
    PERFORM public.log_case_event(
      p_case_id,
      'commission_margin_warning',
      jsonb_build_object(
        'net', v_net,
        'total_payouts', v_total_payouts,
        'overage', v_total_payouts - v_net,
        'team', v_t_comm,
        'pool', v_pool,
        'agent_share', v_agent_share,
        'agent_self_amount', v_agent_self_amount,
        'student_reward', v_student_reward,
        'model', 'additive'
      ),
      true
    );
  END IF;

  -- ── G3: Write the immutable financial snapshot (once, never overwritten) ─
  INSERT INTO public.case_financial_snapshots (
    case_id, gross_total, referral_discount, net_total,
    referrer_id, referrer_role, agent_id, master_partner_id,
    partner_rate_used, agent_rate_used, master_rate_used, team_rate_used, student_reward_used,
    partner_commission, agent_override, master_override, team_commission,
    student_reward, total_payouts, darb_margin,
    attribution_model, is_agent_self_referral, is_student_referrer, student_referral_type
  ) VALUES (
    p_case_id, v_base, COALESCE(v_case.referral_discount, 0), v_net,
    v_partner_id, v_referrer_role, v_agent, v_master,
    v_pool, v_agent_share, v_master_share, v_t_comm, v_student_reward,
    v_partner_comm, v_agent_share, v_master_share, v_t_comm,
    v_student_reward, v_total_payouts, v_admin_remainder,
    'additive', v_is_agent_self_referral, v_is_student_referrer, v_referral_type
  ) ON CONFLICT (case_id) DO NOTHING;

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
      'total_payouts', v_total_payouts,
      'model', 'additive',
      'source', 'case_services'
    ),
    true
  );
END;
$function$;

-- Re-assert the restricted grant after the redefinition (idempotent).
REVOKE ALL ON FUNCTION public.record_case_commission(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_case_commission(uuid, integer) TO service_role;
