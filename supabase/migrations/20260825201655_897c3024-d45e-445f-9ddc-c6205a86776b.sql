-- 1) Admin-only commission split preview mirroring record_case_commission
CREATE OR REPLACE FUNCTION public.preview_case_commission_split(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_case RECORD;
  v_base integer := 0;
  v_net integer := 0;
  v_discount integer := 0;
  v_t_comm integer := 0;
  v_t_override integer;
  v_team_name text;
  v_global_team_rate integer := 0;
  v_partner_id uuid;
  v_is_partner boolean := false;
  v_is_ambassador boolean := false;
  v_is_agent_self boolean := false;
  v_is_student boolean := false;
  v_referrer_name text;
  v_referrer_role text;
  v_referrer_amount integer := 0;
  v_referrer_custom boolean := false;
  v_agent uuid;
  v_agent_name text;
  v_agent_share integer := 0;
  v_agent_split RECORD;
  v_referral_type text;
  v_payouts integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Only an administrator can preview a commission split';
  END IF;

  SELECT id, assigned_to, partner_id, referred_by, referral_discount
    INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;

  SELECT COALESCE(SUM(GREATEST(unit_price * quantity - discount, 0)), 0)::integer
    INTO v_base FROM public.case_services WHERE case_id = p_case_id;

  v_discount := COALESCE(v_case.referral_discount, 0)::integer;
  v_net := GREATEST(v_base - v_discount, 0);

  SELECT COALESCE(team_member_commission_rate, 0) INTO v_global_team_rate
    FROM public.platform_settings LIMIT 1;

  IF v_case.assigned_to IS NOT NULL THEN
    SELECT commission_amount INTO v_t_override
      FROM public.team_member_commission_overrides
     WHERE team_member_id = v_case.assigned_to;
    v_t_comm := COALESCE(v_t_override, v_global_team_rate);
    SELECT full_name INTO v_team_name FROM public.profiles WHERE id = v_case.assigned_to;
  END IF;

  v_partner_id := COALESCE(v_case.partner_id, v_case.referred_by);

  IF v_partner_id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.user_roles ur
                    WHERE ur.user_id = v_partner_id AND ur.role = 'ambassador')
      INTO v_is_ambassador;

    IF v_is_ambassador THEN
      v_is_partner := true;
    ELSE
      SELECT EXISTS (SELECT 1 FROM public.user_roles ur
                      WHERE ur.user_id = v_partner_id AND ur.role = 'social_media_partner')
        INTO v_is_partner;
    END IF;

    IF NOT v_is_partner THEN
      SELECT EXISTS (SELECT 1 FROM public.user_roles ur
                      WHERE ur.user_id = v_partner_id AND ur.role = 'agent')
        INTO v_is_agent_self;
    END IF;

    IF NOT v_is_partner AND NOT v_is_agent_self THEN
      SELECT EXISTS (SELECT 1 FROM public.user_roles ur
                      WHERE ur.user_id = v_partner_id AND ur.role = 'student')
        INTO v_is_student;
    END IF;

    SELECT full_name INTO v_referrer_name FROM public.profiles WHERE id = v_partner_id;
  END IF;

  IF v_is_student THEN
    SELECT referral_type INTO v_referral_type
      FROM public.referrals WHERE referred_case_id = p_case_id
     ORDER BY created_at DESC LIMIT 1;
    v_referrer_amount := COALESCE(public.get_student_referral_reward(v_partner_id, v_referral_type), 0)::integer;
    v_referrer_role := 'student';
    v_referrer_custom := EXISTS (
      SELECT 1 FROM public.student_referral_reward_overrides
       WHERE student_id = v_partner_id);

  ELSIF v_is_agent_self THEN
    SELECT amount INTO v_referrer_amount
      FROM public.get_effective_agent_self_referral(v_partner_id);
    v_referrer_amount := COALESCE(v_referrer_amount, 0);
    v_referrer_role := 'agent_self';
    v_referrer_custom := EXISTS (
      SELECT 1 FROM public.agent_self_referral_overrides WHERE agent_id = v_partner_id);

  ELSIF v_is_partner THEN
    v_referrer_amount := GREATEST(0, COALESCE(public.partner_base_pool(v_partner_id), 0));
    v_referrer_role := CASE WHEN v_is_ambassador THEN 'ambassador' ELSE 'partner' END;
    v_referrer_custom := EXISTS (
      SELECT 1 FROM public.partner_commission_overrides WHERE partner_id = v_partner_id);

    SELECT p.agent_id INTO v_agent FROM public.profiles p WHERE p.id = v_partner_id;
    IF v_agent IS NOT NULL AND v_agent <> v_partner_id THEN
      PERFORM set_config('app.internal_commission_split', 'on', true);
      SELECT * INTO v_agent_split
        FROM public.get_effective_agent_split(v_agent, v_partner_id);
      PERFORM set_config('app.internal_commission_split', 'off', true);
      v_agent_share := GREATEST(0, COALESCE(v_agent_split.agent_amount, 0));
      SELECT full_name INTO v_agent_name FROM public.profiles WHERE id = v_agent;
    END IF;
  END IF;

  v_payouts := v_t_comm + v_referrer_amount + v_agent_share;

  RETURN jsonb_build_object(
    'case_id', p_case_id,
    'service_total', v_net,
    'gross_total', v_base,
    'referral_discount', v_discount,
    'team', CASE WHEN v_case.assigned_to IS NULL THEN NULL ELSE jsonb_build_object(
      'user_id', v_case.assigned_to,
      'name', COALESCE(v_team_name, left(v_case.assigned_to::text, 8)),
      'amount', v_t_comm,
      'custom_rate', v_t_override IS NOT NULL
    ) END,
    'referrer', CASE WHEN v_partner_id IS NULL OR v_referrer_role IS NULL THEN NULL ELSE jsonb_build_object(
      'user_id', v_partner_id,
      'name', COALESCE(v_referrer_name, left(v_partner_id::text, 8)),
      'role', v_referrer_role,
      'referral_type', v_referral_type,
      'amount', v_referrer_amount,
      'custom_rate', v_referrer_custom
    ) END,
    'agent', CASE WHEN v_agent IS NULL OR v_agent_share <= 0 THEN NULL ELSE jsonb_build_object(
      'user_id', v_agent,
      'name', COALESCE(v_agent_name, left(v_agent::text, 8)),
      'amount', v_agent_share
    ) END,
    'total_payouts', v_payouts,
    'platform_revenue', GREATEST(0, v_net - v_payouts),
    'margin_warning', (v_payouts > v_net)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.preview_case_commission_split(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_case_commission_split(uuid) TO authenticated;

-- 2) Insurance is no longer a blocking German finance item
CREATE OR REPLACE FUNCTION public.assert_case_ready_for_enrollment(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid();
  v_case RECORD;
  v_sub RECORD;
  v_items jsonb := '[]'::jsonb;
  v_ready boolean := true;
  v_req RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id, status INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;

  SELECT program_id, accommodation_id, insurance_id INTO v_sub
    FROM public.case_submissions
   WHERE case_id = p_case_id AND deleted_at IS NULL
   ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ENROLL_BLOCKED: student submission is missing'
      USING ERRCODE = 'check_violation';
  END IF;

  FOR v_req IN
    SELECT finance_type, status
      FROM public.case_finance_confirmations
     WHERE case_id = p_case_id
       AND finance_type IN ('language_course','accommodation','insurance')
  LOOP
    v_items := v_items || jsonb_build_object(
      'finance_type', v_req.finance_type,
      'confirmed', (v_req.status = 'confirmed'),
      'required', (v_req.finance_type <> 'insurance')
    );
    -- Insurance is paid after the student arrives in Germany, so it never
    -- blocks enrollment. Course and accommodation still do.
    IF v_req.status <> 'confirmed' THEN
      IF (v_req.finance_type = 'language_course' AND v_sub.program_id IS NOT NULL)
      OR (v_req.finance_type = 'accommodation' AND v_sub.accommodation_id IS NOT NULL) THEN
        v_ready := false;
      END IF;
    END IF;
  END LOOP;

  IF NOT v_ready THEN
    RAISE EXCEPTION 'Case % is not ready for enrollment: one or more German finance items are not confirmed', p_case_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN jsonb_build_object('case_id', p_case_id, 'ready', true, 'items', v_items);
END;
$function$;