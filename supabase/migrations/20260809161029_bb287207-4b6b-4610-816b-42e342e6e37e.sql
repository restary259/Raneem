-- Authoritative case financials
CREATE OR REPLACE FUNCTION public.get_case_financials(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_case RECORD;
  v_sub RECORD;
  v_services jsonb := '[]'::jsonb;
  v_service_total numeric := 0;
  v_confirmed numeric := 0;
  v_submitted numeric := 0;
  v_payments jsonb := '[]'::jsonb;
  v_school jsonb := '[]'::jsonb;
  v_prog RECORD;
  v_acc RECORD;
  v_ins RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, case_reference, full_name, assigned_to, student_user_id, status
    INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;

  IF NOT (
    public.has_role(v_uid, 'admin')
    OR v_case.assigned_to = v_uid
    OR v_case.student_user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Not allowed to read financials for this case';
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'description'), '[]'::jsonb),
         COALESCE(SUM((x->>'line_total')::numeric), 0)
    INTO v_services, v_service_total
  FROM (
    SELECT jsonb_build_object(
      'id', cs.id,
      'service_id', cs.service_id,
      'description', cs.description,
      'category', cs.category,
      'quantity', cs.quantity,
      'unit_price', round(cs.unit_price, 2),
      'discount', round(cs.discount, 2),
      'currency', cs.currency,
      'line_total', round(cs.unit_price * cs.quantity - cs.discount, 2)
    ) AS x
    FROM public.case_services cs WHERE cs.case_id = p_case_id
  ) s;

  SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0),
         COALESCE(SUM(amount) FILTER (WHERE status = 'submitted'), 0)
    INTO v_confirmed, v_submitted
  FROM public.case_payments WHERE case_id = p_case_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', p.id, 'amount', round(p.amount, 2), 'currency', p.currency,
           'payment_type', p.payment_type, 'status', p.status, 'note', p.note,
           'submitted_by', p.submitted_by, 'submitted_at', p.submitted_at,
           'confirmed_by', p.confirmed_by, 'confirmed_at', p.confirmed_at,
           'rejected_reason', p.rejected_reason, 'created_at', p.created_at
         ) ORDER BY p.created_at DESC), '[]'::jsonb)
    INTO v_payments
  FROM public.case_payments p WHERE p.case_id = p_case_id;

  SELECT * INTO v_sub FROM public.case_submissions
   WHERE case_id = p_case_id AND deleted_at IS NULL
   ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    IF v_sub.program_id IS NOT NULL THEN
      SELECT name_ar, name_en, currency INTO v_prog FROM public.programs WHERE id = v_sub.program_id;
      v_school := v_school || jsonb_build_object(
        'kind', 'program',
        'name_ar', v_prog.name_ar, 'name_en', v_prog.name_en,
        'weekly_price', round(COALESCE(v_sub.program_weekly_price, 0), 2),
        'weeks', COALESCE(v_sub.program_weeks, 0),
        'total', round(COALESCE(v_sub.program_price, COALESCE(v_sub.program_weekly_price,0) * COALESCE(v_sub.program_weeks,0)), 2),
        'currency', COALESCE(v_prog.currency, 'EUR'),
        'estimate', true
      );
    END IF;
    IF v_sub.accommodation_id IS NOT NULL THEN
      SELECT name_ar, name_en, currency INTO v_acc FROM public.accommodations WHERE id = v_sub.accommodation_id;
      v_school := v_school || jsonb_build_object(
        'kind', 'accommodation',
        'name_ar', v_acc.name_ar, 'name_en', v_acc.name_en,
        'weekly_price', round(COALESCE(v_sub.accommodation_weekly_price, 0), 2),
        'weeks', COALESCE(v_sub.accommodation_weeks, 0),
        'total', round(COALESCE(v_sub.accommodation_price, COALESCE(v_sub.accommodation_weekly_price,0) * COALESCE(v_sub.accommodation_weeks,0)), 2),
        'currency', COALESCE(v_acc.currency, 'EUR'),
        'estimate', true
      );
    END IF;
    IF v_sub.insurance_id IS NOT NULL THEN
      SELECT name, currency INTO v_ins FROM public.insurances WHERE id = v_sub.insurance_id;
      v_school := v_school || jsonb_build_object(
        'kind', 'insurance',
        'name_ar', v_ins.name, 'name_en', v_ins.name,
        'weekly_price', NULL, 'weeks', NULL,
        'total', round(COALESCE(v_sub.insurance_price, 0), 2),
        'currency', COALESCE(v_ins.currency, 'EUR'),
        'estimate', true
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'case_id', v_case.id,
    'case_reference', v_case.case_reference,
    'student_name', v_case.full_name,
    'status', v_case.status,
    'school_id', v_sub.school_id,
    'currency', 'ILS',
    'services', v_services,
    'service_total', round(v_service_total, 2),
    'school_costs', v_school,
    'payments', v_payments,
    'total_confirmed', round(v_confirmed, 2),
    'total_pending_review', round(v_submitted, 2),
    'remaining', round(GREATEST(v_service_total - v_confirmed, 0), 2)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_case_financials(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_case_financials(uuid) TO authenticated, service_role;

-- Team submits a received payment
CREATE OR REPLACE FUNCTION public.submit_case_payment(
  p_case_id uuid,
  p_amount numeric,
  p_note text DEFAULT NULL,
  p_idem_key text DEFAULT NULL,
  p_payment_type text DEFAULT 'service_fee'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_case RECORD;
  v_total numeric := 0;
  v_already numeric := 0;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_is_admin := public.has_role(v_uid, 'admin');

  SELECT id, assigned_to INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;
  IF NOT (v_is_admin OR v_case.assigned_to = v_uid) THEN
    RAISE EXCEPTION 'Not allowed to record payments for this case';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  IF p_idem_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.case_payments
     WHERE case_id = p_case_id AND idem_key = p_idem_key AND status <> 'rejected' LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  SELECT COALESCE(SUM(unit_price * quantity - discount), 0) INTO v_total
    FROM public.case_services WHERE case_id = p_case_id;
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'No services selected for this case — cannot record a payment yet';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_already
    FROM public.case_payments WHERE case_id = p_case_id AND status IN ('submitted','confirmed');

  IF round(v_already + p_amount, 2) > round(v_total, 2) THEN
    RAISE EXCEPTION 'Payment exceeds the case total (total %, already recorded %)', round(v_total,2), round(v_already,2);
  END IF;

  INSERT INTO public.case_payments
    (case_id, payment_type, amount, currency, status, paid_status, paid_date,
     note, recorded_by, submitted_by, submitted_at, idem_key)
  VALUES
    (p_case_id, COALESCE(p_payment_type, 'service_fee'), round(p_amount, 2), 'ILS', 'submitted', 'pending', now(),
     p_note, v_uid, v_uid, now(), p_idem_key)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_case_payment(uuid, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_case_payment(uuid, numeric, text, text, text) TO authenticated, service_role;

-- Admin confirms
CREATE OR REPLACE FUNCTION public.confirm_case_payment(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Only an administrator can confirm a payment';
  END IF;

  UPDATE public.case_payments
     SET status = 'confirmed',
         paid_status = 'paid',
         paid_date = COALESCE(paid_date, now()),
         confirmed_by = v_uid,
         confirmed_at = now(),
         rejected_reason = NULL
   WHERE id = p_payment_id AND status IN ('pending','submitted');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found or already resolved';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_case_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_case_payment(uuid) TO authenticated, service_role;

-- Admin rejects
CREATE OR REPLACE FUNCTION public.reject_case_payment(p_payment_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Only an administrator can reject a payment';
  END IF;

  UPDATE public.case_payments
     SET status = 'rejected',
         paid_status = 'pending',
         rejected_reason = p_reason,
         confirmed_by = v_uid,
         confirmed_at = now()
   WHERE id = p_payment_id AND status IN ('pending','submitted');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found or already resolved';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_case_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_case_payment(uuid, text) TO authenticated, service_role;