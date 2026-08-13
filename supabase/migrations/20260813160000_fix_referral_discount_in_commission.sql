-- ════════════════════════════════════════════════════════════════════════
-- Fix referral discount in commission split
-- ════════════════════════════════════════════════════════════════════════
-- Issue 1 (financial): platform_revenue_ils did NOT absorb the referral
-- discount. Step 2 netted the discount inside the read functions
-- (get_case_financials / get_case_darb_service_total subtract
-- cases.referral_discount), but record_case_commission kept computing the
-- GROSS base and set platform_revenue_ils = gross − team − pool. So for a
-- ₪5000 case with a ₪500 discount and ₪100 team commission, the student was
-- invoiced/paid ₪4500, yet the case recorded platform_revenue_ils = ₪4900 —
-- ₪500 of revenue DARB never received, and the admin Payment-Split preview
-- (which reads the net service_total) disagreed with the recorded value.
--
-- Fix: compute v_net = GREATEST(v_base - referral_discount, 0) and set
-- platform_revenue_ils = GREATEST(0, v_net - team - pool). Team/partner/master
-- flat amounts are unchanged (they are flat, not a % of base) and keep using
-- the gross v_base as their rewards.base_amount. The IF v_base <= 0 guard
-- stays on gross. This makes platform_revenue_ils equal the admin split
-- preview and equal invoiced amount minus commissions, matching
-- COMMISSION_RULES.md §4 (service_fee = the NET discounted DARB total).
--
-- Issue 3 (consistency): record_case_commission summed case_services
-- WHERE currency='ILS', while get_case_darb_service_total / get_case_financials
-- sum ALL case_services rows (and hardcode currency='ILS' in the output).
-- DARB service lines are always ILS, so this is a no-op for existing data, but
-- the two computations now use the SAME base so they can never drift.
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
  END IF;

  -- Referral lifecycle milestone: the referred friend's case reaching
  -- enrollment_paid is the terminal success state for the referral row.
  UPDATE public.referrals
     SET status = 'rewarded'
   WHERE referred_case_id = p_case_id
     AND status IS DISTINCT FROM 'rewarded';

  -- Platform revenue absorbs the referral discount (net base), matching
  -- get_case_financials.service_total and the admin Payment-Split preview.
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
-- Verification (run in SQL editor before/after deploying)
-- ════════════════════════════════════════════════════════════════════════
-- After this CREATE OR REPLACE, for any NEW case reaching enrollment_paid with
-- a referral discount, platform_revenue_ils must equal:
--   get_case_financials.service_total − team_commission − partner_pool
-- which is equivalent to:
--   (gross_service_total − referral_discount) − team − pool
--
-- A) Assert the recorded platform_revenue matches the net financials for
--    commission-split cases (run after a case goes through enrollment_paid):
-- SELECT c.id, c.case_reference, c.referral_discount, c.platform_revenue_ils,
--        (get_case_financials(c.id)->>'service_total')::numeric AS net_service_total
-- FROM public.cases c
-- WHERE c.commission_split_done AND c.referral_discount > 0;
--
-- B) Regression guard — non-referral cases (referral_discount = 0) produce
--    platform_revenue_ils identical to the previous formula:
--    gross − team − pool (v_net == v_base when discount is 0).
--
-- C) Existing data note: cases already at enrollment_paid with a referral
--    discount BEFORE this deploy have an overstated platform_revenue_ils.
--    CREATE OR REPLACE cannot retroactively fix them (commission_split_done
--    guards re-run). Inspect and decide on a one-time manual correction:
-- SELECT c.id, c.case_reference, c.referral_discount, c.platform_revenue_ils,
--        (SELECT COALESCE(SUM(GREATEST(unit_price*quantity-discount,0)),0)::int
--         FROM case_services WHERE case_id = c.id) AS gross_base
-- FROM public.cases c
-- WHERE c.commission_split_done
--   AND c.referral_discount > 0
--   AND c.platform_revenue_ils >
--       GREATEST(0, (SELECT COALESCE(SUM(GREATEST(unit_price*quantity-discount,0)),0)::int
--                    FROM case_services WHERE case_id = c.id)
--                - COALESCE(c.referral_discount,0));
