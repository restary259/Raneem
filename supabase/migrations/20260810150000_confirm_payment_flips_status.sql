-- Redefine confirm_agency_service_payment so confirming the DARB agency fee
-- also flips the legacy case_submissions.payment_confirmed flag and moves the
-- case to the payment_confirmed stage. The previous version only wrote the new
-- case_finance_confirmations row, which left the stage-transition trigger and
-- submit_case_for_review unable to proceed (the trigger checks
-- case_submissions.payment_confirmed for payment_confirmed -> submitted).
--
-- This is idempotent: confirming again is a no-op for status/flag. The
-- finance-confirmation row is still updated (re-confirming refreshes the
-- confirmed_by / confirmed_at stamp). Security model unchanged.

CREATE OR REPLACE FUNCTION public.confirm_agency_service_payment(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_case RECORD;
  v_sub RECORD;
  v_total numeric;
  v_already_confirmed boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, assigned_to, student_user_id, status INTO v_case
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

  RETURN jsonb_build_object(
    'case_id', p_case_id,
    'finance_type', 'service_fee',
    'status', 'confirmed',
    'service_total', v_total,
    'case_status', CASE WHEN v_case.status = 'profile_completion'
                        THEN 'payment_confirmed' ELSE v_case.status END,
    'already_confirmed', v_already_confirmed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_agency_service_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_agency_service_payment(uuid) TO authenticated, service_role;
