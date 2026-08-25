-- 1. confirm_agency_service_payment: use the real finance_type label and fail loudly on a mismatch.
CREATE OR REPLACE FUNCTION public.confirm_agency_service_payment(p_case_id uuid, p_payment_method text DEFAULT 'bank_transfer'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_case RECORD;
  v_total numeric;
  v_payment_id uuid;
  v_already_confirmed boolean := false;
  v_rows int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_payment_method NOT IN ('cash', 'bank_transfer') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_payment_method;
  END IF;

  SELECT id, assigned_to, status INTO v_case
    FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;

  IF NOT (public.has_role(v_uid, 'admin') OR v_case.assigned_to = v_uid) THEN
    RAISE EXCEPTION 'Not allowed to confirm payments for this case';
  END IF;

  v_total := public.get_case_darb_service_total(p_case_id);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Cannot confirm payment before selecting DARB services';
  END IF;

  PERFORM public.ensure_case_finance_confirmations(p_case_id);

  SELECT EXISTS (
    SELECT 1 FROM public.case_finance_confirmations
     WHERE case_id = p_case_id AND finance_type = 'agency_service_fee' AND status = 'confirmed'
  ) INTO v_already_confirmed;

  UPDATE public.case_finance_confirmations
     SET status = 'confirmed',
         confirmed_by = v_uid,
         confirmed_at = now(),
         updated_at = now()
   WHERE case_id = p_case_id AND finance_type = 'agency_service_fee';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Finance confirmation row for the DARB service fee is missing';
  END IF;

  UPDATE public.case_submissions
     SET payment_confirmed = true,
         payment_confirmed_at = COALESCE(payment_confirmed_at, now()),
         payment_confirmed_by = COALESCE(payment_confirmed_by, v_uid)
   WHERE case_id = p_case_id AND deleted_at IS NULL;

  IF v_case.status = 'profile_completion' THEN
    UPDATE public.cases SET status = 'payment_confirmed' WHERE id = p_case_id;
  END IF;

  SELECT id INTO v_payment_id
    FROM public.case_payments
   WHERE case_id = p_case_id
     AND payment_type = 'agency_service'
     AND status IN ('pending', 'submitted', 'confirmed')
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_payment_id IS NULL THEN
    INSERT INTO public.case_payments
      (case_id, payment_type, amount, currency, status, paid_status, paid_date,
       note, recorded_by, submitted_by, submitted_at, confirmed_by, confirmed_at,
       payment_method)
    VALUES
      (p_case_id, 'agency_service', round(v_total, 2), 'ILS', 'confirmed', 'paid', now(),
       'DARB agency service fee - confirmed', v_uid, v_uid, now(), v_uid, now(),
       p_payment_method)
    RETURNING id INTO v_payment_id;
  ELSE
    UPDATE public.case_payments
       SET status = 'confirmed',
           paid_status = 'paid',
           paid_date = COALESCE(paid_date, now()),
           amount = round(v_total, 2),
           currency = 'ILS',
           rejected_reason = NULL,
           confirmed_by = v_uid,
           confirmed_at = now(),
           payment_method = p_payment_method
     WHERE id = v_payment_id;
  END IF;

  RETURN jsonb_build_object(
    'case_id', p_case_id,
    'finance_type', 'agency_service_fee',
    'status', 'confirmed',
    'payment_id', v_payment_id,
    'amount_ils', round(v_total, 2),
    'service_total', v_total,
    'payment_method', p_payment_method,
    'case_status', CASE WHEN v_case.status = 'profile_completion'
                        THEN 'payment_confirmed' ELSE v_case.status END,
    'already_confirmed', v_already_confirmed
  );
END;
$function$;

-- 2. submit_case_for_review: read the real label, and accept the intake month
--    (extra_data.start_month) instead of demanding a course start date.
CREATE OR REPLACE FUNCTION public.submit_case_for_review(p_case_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_case RECORD;
  v_sub RECORD;
  v_service_total numeric;
  v_agency_confirmed boolean;
  v_inv jsonb;
  v_t_comm integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, status, assigned_to, case_reference, full_name
    INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;

  IF NOT (public.has_role(v_uid, 'admin') OR v_case.assigned_to = v_uid) THEN
    RAISE EXCEPTION 'Not allowed to submit this case';
  END IF;

  IF v_case.status NOT IN ('profile_completion', 'payment_confirmed') THEN
    RAISE EXCEPTION 'SUBMIT_BLOCKED: the case is not ready for team submission';
  END IF;

  SELECT * INTO v_sub
    FROM public.case_submissions
   WHERE case_id = p_case_id AND deleted_at IS NULL
   ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUBMIT_BLOCKED: the student file is missing';
  END IF;

  IF v_sub.profile_completed_at IS NULL THEN
    RAISE EXCEPTION 'SUBMIT_BLOCKED: the student profile must be complete first';
  END IF;

  IF v_sub.school_id IS NULL OR v_sub.program_id IS NULL THEN
    RAISE EXCEPTION 'SUBMIT_BLOCKED: school and course are required';
  END IF;

  IF v_sub.program_start_date IS NULL
     AND COALESCE(NULLIF(btrim(v_sub.extra_data->>'start_month'), ''), '') = '' THEN
    RAISE EXCEPTION 'SUBMIT_BLOCKED: the intake month is required';
  END IF;

  SELECT COALESCE(SUM(unit_price * quantity - discount), 0)
    INTO v_service_total
    FROM public.case_services WHERE case_id = p_case_id;

  IF v_service_total <= 0 THEN
    RAISE EXCEPTION 'SUBMIT_BLOCKED: select at least one DARB service before submitting';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.case_finance_confirmations cfc
     WHERE cfc.case_id    = p_case_id
       AND cfc.finance_type = 'agency_service_fee'
       AND cfc.status      = 'confirmed'
  ) INTO v_agency_confirmed;

  IF NOT v_agency_confirmed THEN
    RAISE EXCEPTION 'SUBMIT_BLOCKED: DARB service payment must be confirmed by the assigned team member';
  END IF;

  UPDATE public.case_submissions
     SET submitted_at   = now(),
         submitted_by   = v_uid,
         review_status  = 'submitted',
         review_note    = NULL
   WHERE id = v_sub.id;

  UPDATE public.cases SET status = 'submitted' WHERE id = p_case_id;

  IF v_case.assigned_to IS NOT NULL THEN
    SELECT commission_amount INTO v_t_comm
      FROM public.team_member_commission_overrides
     WHERE team_member_id = v_case.assigned_to;

    IF v_t_comm IS NULL THEN
      SELECT COALESCE(team_member_commission_rate, 100)
        INTO v_t_comm
        FROM public.platform_settings LIMIT 1;
    END IF;

    v_t_comm := COALESCE(v_t_comm, 100);

    IF v_t_comm > 0 THEN
      INSERT INTO public.rewards (
        user_id, amount, status, case_id, reward_type, admin_notes,
        recipient_role, case_reference, rate_used, base_amount, rate_source,
        unlock_at, created_by_event
      ) VALUES (
        v_case.assigned_to,
        v_t_comm,
        'pending',
        p_case_id,
        'team',
        'Team commission (provisional) from case '
          || COALESCE(v_case.case_reference, p_case_id::text),
        'team_member',
        v_case.case_reference,
        v_t_comm,
        v_service_total,
        'calculated_service_total',
        now() + interval '20 days',
        'case_submitted'
      )
      ON CONFLICT (case_id, user_id, reward_type)
      WHERE case_id IS NOT NULL
      DO NOTHING;
    END IF;
  END IF;

  v_inv := public.issue_case_invoice(p_case_id);
  RETURN v_inv;
END;
$function$;

-- 3. validate_case_submission: intake month satisfies the start requirement.
CREATE OR REPLACE FUNCTION public.validate_case_submission()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  digits text;
BEGIN
  IF NEW.student_email IS NOT NULL AND btrim(NEW.student_email) <> '' THEN
    IF NEW.student_email !~ '^[^@\s]+@[^@\s.]+\.[^@\s]+$' THEN
      RAISE EXCEPTION 'INVALID_FIELD:student_email';
    END IF;
  END IF;

  IF NEW.student_phone IS NOT NULL AND btrim(NEW.student_phone) <> '' THEN
    digits := regexp_replace(NEW.student_phone, '\D', '', 'g');
    IF length(digits) < 7 OR length(digits) > 15 THEN
      RAISE EXCEPTION 'INVALID_FIELD:student_phone';
    END IF;
  END IF;

  IF NEW.review_status = 'submitted' AND COALESCE(OLD.review_status, '') <> 'submitted' THEN
    IF NEW.school_id IS NULL THEN RAISE EXCEPTION 'INVALID_FIELD:school_id'; END IF;
    IF NEW.program_id IS NULL THEN RAISE EXCEPTION 'INVALID_FIELD:program_id'; END IF;
    IF NEW.program_start_date IS NULL
       AND COALESCE(NULLIF(btrim(NEW.extra_data->>'start_month'), ''), '') = '' THEN
      RAISE EXCEPTION 'INVALID_FIELD:start_month';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. assert_case_ready_for_enrollment: check the German-side items that really exist.
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
      'confirmed', (v_req.status = 'confirmed')
    );
    IF v_req.status <> 'confirmed' THEN
      IF (v_req.finance_type = 'language_course' AND v_sub.program_id IS NOT NULL)
      OR (v_req.finance_type = 'accommodation' AND v_sub.accommodation_id IS NOT NULL)
      OR (v_req.finance_type = 'insurance' AND v_sub.insurance_id IS NOT NULL) THEN
        v_ready := false;
      END IF;
    END IF;
  END LOOP;

  IF NOT v_ready THEN
    RAISE EXCEPTION 'Case % is not ready for enrollment: one or more German finance items are not confirmed', p_case_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN jsonb_build_object(
    'case_id', p_case_id,
    'ready', true,
    'items', v_items
  );
END;
$function$;