-- confirm_agency_service_payment must also record the confirmed DARB agency
-- fee as a confirmed row in case_payments.
--
-- The Finance tab derives its confirmed state from get_case_financials, which
-- builds its `payments` array exclusively from case_payments
-- (20260809170523_a1fd9839-4656-4941-8bf0-38667f464bb1.sql:292-305). The
-- previous version of this RPC only wrote case_finance_confirmations,
-- case_submissions and cases.status, so the frontend's `agencyConfirmed` (and
-- therefore the "Create the student account & send invite" block) could never
-- become true -- the whole submit-to-admin flow was unreachable from the UI.
--
-- This redefinition keeps the existing three writes and adds a fourth: an
-- idempotent upsert of the confirmed agency_service payment, so the payment
-- appears exactly once in Payment History and the KPI totals
-- (total_confirmed / remaining) reflect it. It also returns payment_id and
-- amount_ils so the CasePaymentService contract holds.

CREATE OR REPLACE FUNCTION public.confirm_agency_service_payment(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_case RECORD;
  v_total numeric;
  v_payment_id uuid;
  v_already_confirmed boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, assigned_to, status INTO v_case
    FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;

  IF NOT (public.has_role(v_uid, 'admin') OR v_case.assigned_to = v_uid) THEN
    RAISE EXCEPTION 'Not allowed to confirm payments for this case';
  END IF;

  -- DARB service total must be positive before the fee can be confirmed.
  v_total := public.get_case_darb_service_total(p_case_id);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Cannot confirm payment before selecting DARB services';
  END IF;

  PERFORM public.ensure_case_finance_confirmations(p_case_id);

  SELECT EXISTS (
    SELECT 1 FROM public.case_finance_confirmations
     WHERE case_id = p_case_id AND finance_type = 'service_fee' AND status = 'confirmed'
  ) INTO v_already_confirmed;

  -- 1. Finance-confirmation row (re-confirming refreshes the stamp).
  UPDATE public.case_finance_confirmations
     SET status = 'confirmed',
         confirmed_by = v_uid,
         confirmed_at = now(),
         updated_at = now()
   WHERE case_id = p_case_id AND finance_type = 'service_fee';

  -- 2. Legacy submission flag used by the stage-transition trigger and the
  --    submit_case_for_review gate. Without this the case can never move on.
  UPDATE public.case_submissions
     SET payment_confirmed = true,
         payment_confirmed_at = COALESCE(payment_confirmed_at, now()),
         payment_confirmed_by = COALESCE(payment_confirmed_by, v_uid)
   WHERE case_id = p_case_id AND deleted_at IS NULL;

  -- 3. Advance the case to payment_confirmed when it is still at the
  --    profile_completion stage. The BEFORE UPDATE trigger on cases permits
  --    profile_completion -> payment_confirmed only when the profile is
  --    complete, which is a precondition for reaching this RPC.
  IF v_case.status = 'profile_completion' THEN
    UPDATE public.cases SET status = 'payment_confirmed' WHERE id = p_case_id;
  END IF;

  -- 4. Record the confirmed DARB agency fee in case_payments. Idempotent:
  --    re-confirming updates the existing row instead of creating a duplicate,
  --    so the payment appears exactly once in Payment History.
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
       note, recorded_by, submitted_by, submitted_at, confirmed_by, confirmed_at)
    VALUES
      (p_case_id, 'agency_service', round(v_total, 2), 'ILS', 'confirmed', 'paid', now(),
       'DARB agency service fee - confirmed', v_uid, v_uid, now(), v_uid, now())
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
           confirmed_at = now()
     WHERE id = v_payment_id;
  END IF;

  RETURN jsonb_build_object(
    'case_id', p_case_id,
    'finance_type', 'service_fee',
    'status', 'confirmed',
    'payment_id', v_payment_id,
    'amount_ils', round(v_total, 2),
    'service_total', v_total,
    'case_status', CASE WHEN v_case.status = 'profile_completion'
                        THEN 'payment_confirmed' ELSE v_case.status END,
    'already_confirmed', v_already_confirmed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_agency_service_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_agency_service_payment(uuid) TO authenticated, service_role;
