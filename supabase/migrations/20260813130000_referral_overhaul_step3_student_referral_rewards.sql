-- ════════════════════════════════════════════════════════════════════════
-- Referral overhaul — STEP 3 (student referrals never pay the partner pool)
--
-- 1. record_case_commission now ROLE-CHECKS the person linked via
--    partner_id / referred_by: only social_media_partner / ambassador roles
--    receive the ₪1,000 partner pool. A student who referred a friend
--    (cases.referred_by = student) previously fell through to
--    partner_base_pool, which returns the global default for ANY user id —
--    so the student was about to be paid ₪1,000. Per product decision,
--    student referrers get ₪0 cash reward (only the friend's discount
--    applies, handled in Step 2).
-- 2. When the referred friend's case reaches enrollment_paid, the linked
--    referral (referrals.referred_case_id) advances to status 'rewarded' —
--    the terminal success milestone for the referral lifecycle.
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

  SELECT COALESCE(SUM(GREATEST(unit_price * quantity - discount, 0)), 0)::numeric
  INTO v_base
  FROM case_services
  WHERE case_id = p_case_id AND currency = 'ILS';

  IF v_base <= 0 THEN
    RAISE EXCEPTION 'Cannot record commission: the case has no positive ILS DARB service total';
  END IF;

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

  v_admin_remainder := GREATEST(0, v_base - v_t_comm - v_pool);

  UPDATE cases
  SET platform_revenue_ils = v_admin_remainder,
      commission_split_done = true
  WHERE id = p_case_id;

  PERFORM public.log_case_event(
    p_case_id,
    'commission_recorded',
    jsonb_build_object(
      'base_amount', v_base,
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
-- Referral status milestone — friend's case reaches 'enrolled'.
-- Fires on the cases table when the linked case transitions into `enrolled`,
-- advancing the referral row (referred_case_id) from pending/contacted to
-- enrolled. The enrollment_paid → 'rewarded' transition is handled inside
-- record_case_commission above.
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.advance_referral_on_enroll()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'enrolled' AND OLD.status IS DISTINCT FROM 'enrolled' THEN
    UPDATE public.referrals
       SET status = 'enrolled'
     WHERE referred_case_id = NEW.id
       AND status IN ('pending', 'contacted');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_advance_referral_on_enroll ON public.cases;
CREATE TRIGGER trg_advance_referral_on_enroll
  AFTER UPDATE OF status ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.advance_referral_on_enroll();
