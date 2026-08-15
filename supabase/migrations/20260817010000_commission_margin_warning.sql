-- ════════════════════════════════════════════════════════════════════════
-- G2 + G6 + G7 — Margin-safety warning, attribution-priority docs, trigger sync
-- ════════════════════════════════════════════════════════════════════════
-- Three surgical hardening changes to the commission engine, all behavior-
-- preserving for the money math:
--
-- G2 (MEDIUM): record_case_commission now logs a non-blocking
--   `commission_margin_warning` case event when total payouts exceed NET
--   (negative Darb margin). It does NOT block enrollment — the existing
--   `platform_revenue_ils = GREATEST(0, ...)` clamp is kept so the column
--   never goes negative. The warning makes a previously-silent negative
--   margin visible in the case event log for admin review. Recomputed per
--   branch (agent self-referral / student referrer / partner pool) so the
--   comparison uses the payouts that branch actually created.
--
-- G6 (LOW): the deterministic attribution priority (partner_id > referred_by,
--   then role lookup partner/ambassador > agent > student) is now documented
--   in a header comment on record_case_commission. No logic change.
--
-- G7 (defensive): auto_split_payment() is redefined to call
--   record_case_commission(NEW.id, 0) directly, dropping the stale
--   case_submissions.service_fee read (the canonical engine ignores the
--   payment argument and derives the base from case_services, so the read was
--   harmless but confusing). trg_auto_split_payment is defensively DROP+CREATE
--   to guarantee continuity regardless of which historical migration ran last.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- record_case_commission — canonical engine (additive) + margin warning
-- ════════════════════════════════════════════════════════════════════════
-- Model (ADDITIVE):
--   platform_revenue_ils = max(0, net − team − pool − agent_share − student_reward)
-- where net = max(0, base − referral_discount). The agent share and the
-- student-referral reward are funded from DARB's margin; the partner pool
-- (incl. master carve) is paid from the pool itself.
--
-- ATTRIBUTION PRIORITY (deterministic, single winner):
--   1. cases.partner_id wins over cases.referred_by (COALESCE order).
--   2. Role lookup on the winner: partner/ambassador > agent (self-ref) > student.
--      The first match wins — no fallback chain once a role is found.
--   3. Student referrals create a NEW attribution boundary (Rule 6, ISOLATED):
--      they pay ONLY the referring student and NEVER propagate upstream.
--   4. A NULL referrer (no partner_id and no referred_by) pays only the team
--      commission (if assigned); the rest is platform margin.
-- ════════════════════════════════════════════════════════════════════════
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
    v_total_payouts := v_t_comm + v_agent_self_amount;
  ELSIF v_is_student_referrer THEN
    v_admin_remainder := GREATEST(0, v_net - v_t_comm - v_student_reward);
    v_total_payouts := v_t_comm + v_student_reward;
  ELSE
    v_admin_remainder := GREATEST(0, v_net - v_t_comm - v_pool - v_agent_share);
    v_total_payouts := v_t_comm + v_pool + v_agent_share;
  END IF;

  -- ── G2: Margin-safety warning (non-blocking) ─────────────────────────────
  -- If total payouts exceed NET, Darb's margin would be negative. We do NOT
  -- block enrollment (the clamp above keeps platform_revenue_ils >= 0); we
  -- log a visible warning so an admin can review the rate/discount config.
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

REVOKE ALL ON FUNCTION public.record_case_commission(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_case_commission(uuid, integer) TO authenticated, service_role;


-- ════════════════════════════════════════════════════════════════════════
-- G7 — Defensive re-creation of the enrollment trigger + sync to the engine
-- ════════════════════════════════════════════════════════════════════════
-- auto_split_payment() previously read case_submissions.service_fee and passed
-- it as the second arg to record_case_commission. The canonical engine ignores
-- that argument (it derives the base from case_services), so the read was
-- harmless but misleading. Redefined here to call record_case_commission(NEW.id, 0)
-- directly. The trigger is DROP+CREATE'd defensively so continuity is
-- guaranteed regardless of which historical migration ran last on a given DB.
CREATE OR REPLACE FUNCTION public.auto_split_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status = 'enrollment_paid' AND OLD.status IS DISTINCT FROM 'enrollment_paid' THEN
    IF NOT NEW.commission_split_done THEN
      PERFORM public.record_case_commission(NEW.id, 0);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_split_payment ON public.cases;
CREATE TRIGGER trg_auto_split_payment
  AFTER UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.auto_split_payment();
