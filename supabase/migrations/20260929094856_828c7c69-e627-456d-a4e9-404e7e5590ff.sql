CREATE OR REPLACE FUNCTION public.confirm_agency_service_payment(p_case_id uuid, p_payment_method text DEFAULT 'bank_transfer', p_reference text DEFAULT NULL, p_receipt_path text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_case RECORD;
  v_total numeric;
  v_payment_id uuid;
  v_already_confirmed boolean := false;
  v_rows int;
  v_ref text := NULLIF(btrim(COALESCE(p_reference,'')), '');
  v_receipt text := NULLIF(btrim(COALESCE(p_receipt_path,'')), '');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_payment_method NOT IN ('cash', 'bank_transfer') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_payment_method;
  END IF;
  IF v_ref IS NOT NULL AND length(v_ref) > 100 THEN RAISE EXCEPTION 'Reference too long'; END IF;
  IF v_receipt IS NOT NULL AND v_receipt NOT LIKE 'cases/' || p_case_id::text || '/receipts/%' THEN
    RAISE EXCEPTION 'Invalid receipt path';
  END IF;

  SELECT id, assigned_to, status, case_reference INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;
  IF NOT (public.has_role(v_uid, 'admin') OR v_case.assigned_to = v_uid) THEN
    RAISE EXCEPTION 'Not allowed to confirm payments for this case';
  END IF;

  -- No proof is required: when no bank reference is supplied, the case code is
  -- the payment reference (it is the memo the student is told to wire with).
  IF v_ref IS NULL THEN
    v_ref := NULLIF(btrim(COALESCE(v_case.case_reference, '')), '');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('agency_payment:' || p_case_id::text));

  v_total := public.get_case_darb_service_total(p_case_id);
  IF v_total <= 0 THEN RAISE EXCEPTION 'Cannot confirm payment before selecting DARB services'; END IF;

  PERFORM public.ensure_case_finance_confirmations(p_case_id);
  SELECT EXISTS (SELECT 1 FROM public.case_finance_confirmations
     WHERE case_id = p_case_id AND finance_type = 'agency_service_fee' AND status = 'confirmed') INTO v_already_confirmed;

  UPDATE public.case_finance_confirmations
     SET status = 'confirmed', confirmed_by = v_uid, confirmed_at = now(), updated_at = now()
   WHERE case_id = p_case_id AND finance_type = 'agency_service_fee';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RAISE EXCEPTION 'Finance confirmation row for the DARB service fee is missing'; END IF;

  UPDATE public.case_submissions
     SET payment_confirmed = true,
         payment_confirmed_at = COALESCE(payment_confirmed_at, now()),
         payment_confirmed_by = COALESCE(payment_confirmed_by, v_uid)
   WHERE case_id = p_case_id AND deleted_at IS NULL;

  IF v_case.status = 'profile_completion' THEN
    UPDATE public.cases SET status = 'payment_confirmed' WHERE id = p_case_id;
  END IF;

  SELECT id INTO v_payment_id FROM public.case_payments
   WHERE case_id = p_case_id AND payment_type = 'agency_service' AND status IN ('pending','submitted','confirmed')
   ORDER BY created_at DESC LIMIT 1;

  IF v_payment_id IS NULL THEN
    INSERT INTO public.case_payments
      (case_id, payment_type, amount, currency, status, paid_status, paid_date, note, recorded_by,
       submitted_by, submitted_at, confirmed_by, confirmed_at, payment_method, reference, receipt_path)
    VALUES
      (p_case_id, 'agency_service', round(v_total, 2), 'ILS', 'confirmed', 'paid', now(),
       'DARB agency service fee - confirmed', v_uid, v_uid, now(), v_uid, now(), p_payment_method, v_ref, v_receipt)
    RETURNING id INTO v_payment_id;
  ELSE
    UPDATE public.case_payments
       SET status = 'confirmed', paid_status = 'paid', paid_date = COALESCE(paid_date, now()),
           amount = round(v_total, 2), currency = 'ILS', rejected_reason = NULL,
           confirmed_by = v_uid, confirmed_at = now(), payment_method = p_payment_method,
           reference = COALESCE(v_ref, reference), receipt_path = COALESCE(v_receipt, receipt_path)
     WHERE id = v_payment_id;
  END IF;

  RETURN jsonb_build_object(
    'case_id', p_case_id, 'finance_type', 'agency_service_fee', 'status', 'confirmed',
    'payment_id', v_payment_id, 'amount_ils', round(v_total, 2), 'service_total', v_total,
    'payment_method', p_payment_method, 'reference', v_ref,
    'case_status', CASE WHEN v_case.status = 'profile_completion' THEN 'payment_confirmed' ELSE v_case.status END,
    'already_confirmed', v_already_confirmed);
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_agency_service_payment(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_agency_service_payment(uuid, text, text, text) TO authenticated, service_role;