-- ════════════════════════════════════════════════════════════════════════
-- Agent commission carve-out in record_case_commission.
-- ════════════════════════════════════════════════════════════════════════
-- When a case reaches enrollment_paid and the referring partner/ambassador was
-- recruited by an Agent (profiles.agent_id), the Agent earns a flat admin-set
-- commission carved out of the SAME ₪1000 partner pool — never extra money,
-- never from the team member's commission or Darb's margin. Identical principle
-- to the master-partner override (COMMISSION_RULES.md §8–9).
--
-- Carve order from the fixed pool (confirmed product decision):
--   1. agent_share   (resolved via get_effective_agent_split, clamped to pool)
--   2. master_share  (capped at pool − agent_share)
--   3. partner_amount = GREATEST(pool − agent_share − master_share, 0)
-- The whole pool is still paid out and platform_revenue_ils is unchanged
-- (still GREATEST(0, net − team − pool)).
--
-- get_effective_partner_split is left UNCHANGED (it is consumed by
-- PartnerNetworkPage for the partner/master preview and its negotiated-offer
-- branch must stay intact). The agent share is resolved separately here.
--
-- The agent reward is recorded with:
--   reward_type      = 'agent_override'
--   recipient_role   = 'agent'
--   source_user_id   = the referring partner
--   unlock_at        = now() + interval '20 days'   (same lock as every reward)
--   created_by_event  = 'case_enrollment_paid'
-- with the same ON CONFLICT (case_id, user_id, reward_type) DO NOTHING
-- idempotency guard.
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
  v_split RECORD;
  v_agent uuid;
  v_agent_share integer := 0;
  v_agent_split RECORD;
  v_admin_remainder integer := 0;
  v_global_team_rate integer := 100;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('case_commission:' || p_case_id::text));

  SELECT id, assigned_to, source, partner_id, referred_by, status, case_reference, commission_split_done, referral_discount
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

  -- Net base after the referral discount — the amount the student was actually
  -- invoiced/paid. Platform revenue is computed from this so DARB's margin
  -- absorbs the discount. Team/partner flat commissions are unaffected.
  v_net := GREATEST(v_base - COALESCE(v_case.referral_discount, 0), 0);

  SELECT COALESCE(team_member_commission_rate, 100)
  INTO v_global_team_rate
  FROM platform_settings LIMIT 1;

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

  -- The partner pool is reserved for ACTUAL partners/ambassadors. A student
  -- linked via cases.referred_by gets ₪0 — partner_base_pool would return
  -- the global default for any user id, so without this role check a student
  -- referrer would be paid the full ₪1,000 pool.
  v_partner_id := COALESCE(v_case.partner_id, v_case.referred_by);
  IF v_partner_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = v_partner_id AND ur.role IN ('social_media_partner', 'ambassador')
    ) INTO v_is_partner;
  END IF;

  IF v_is_partner THEN
    SELECT * INTO v_split FROM public.get_effective_partner_split(v_partner_id);
    v_pool := COALESCE(v_split.pool_amount, 0);
    v_partner_comm := COALESCE(v_split.partner_amount, 0);
    v_master_share := COALESCE(v_split.master_share, 0);
    v_master := v_split.master_partner_id;

    -- ── Agent carve-out (from the same pool) ──────────────────────────────
    -- The referring partner/ambassador may have been recruited by an Agent
    -- (profiles.agent_id). The agent earns a flat admin-set amount carved out
    -- of the pool FIRST, then the master share, then the partner gets the
    -- remainder. The pool outlay never changes.
    SELECT p.agent_id INTO v_agent FROM public.profiles p WHERE p.id = v_partner_id;
    IF v_agent IS NOT NULL AND v_agent <> v_partner_id THEN
      SELECT * INTO v_agent_split FROM public.get_effective_agent_split(v_agent, v_partner_id);
      v_agent_share := COALESCE(v_agent_split.agent_amount, 0);
      v_agent_share := GREATEST(0, LEAST(v_agent_share, v_pool));
    END IF;

    -- Re-apply carve order: agent first, master capped at the remainder, partner
    -- gets what is left. Total = pool.
    v_master_share := GREATEST(0, LEAST(v_master_share, v_pool - v_agent_share));
    v_partner_comm := GREATEST(0, v_pool - v_agent_share - v_master_share);

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
        'agent', v_case.case_reference, v_agent_share, v_pool, 'calculated_service_total',
        now() + interval '20 days', 'case_enrollment_paid'
      ) ON CONFLICT (case_id, user_id, reward_type) WHERE case_id IS NOT NULL DO NOTHING;
    END IF;
  END IF;

  -- Referral lifecycle milestone: the referred friend's case reaching
  -- enrollment_paid is the terminal success state for the referral row.
  UPDATE public.referrals
     SET status = 'rewarded'
   WHERE referred_case_id = p_case_id
     AND status IS DISTINCT FROM 'rewarded';

  -- Platform revenue absorbs the referral discount (net base), matching
  -- get_case_financials.service_total and the admin Payment-Split preview.
  -- The agent carve comes out of the pool, not the margin, so this is
  -- unchanged: GREATEST(0, net − team − pool).
  v_admin_remainder := GREATEST(0, v_net - v_t_comm - v_pool);

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
      'platform_revenue', v_admin_remainder,
      'referral_discount', COALESCE(v_case.referral_discount, 0),
      'student_referrer_reward', 0,
      'source', 'case_services'
    ),
    true
  );
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════
-- Verification (run in the SQL editor after deploying)
-- ════════════════════════════════════════════════════════════════════════
-- For a case whose referring partner was recruited by an agent, after
-- enrollment_paid the three reward rows must sum to the pool and
-- platform_revenue_ils must equal net − team − pool (unchanged):
--
-- SELECT c.id, c.case_reference,
--        (SELECT COALESCE(SUM(amount),0) FROM rewards WHERE case_id = c.id
--          AND reward_type IN ('referral','master_partner','agent_override')) AS pool_paid,
--        (SELECT COALESCE(SUM(amount),0) FROM rewards WHERE case_id = c.id
--          AND reward_type = 'agent_override') AS agent_share,
--        c.platform_revenue_ils
-- FROM public.cases c
-- WHERE c.commission_split_done
--   AND EXISTS (
--     SELECT 1 FROM profiles p
--     WHERE p.id = COALESCE(c.partner_id, c.referred_by) AND p.agent_id IS NOT NULL
--   );
