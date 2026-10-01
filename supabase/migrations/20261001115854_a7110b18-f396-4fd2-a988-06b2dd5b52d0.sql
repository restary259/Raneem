-- Security: `v_case.assigned_to = v_uid` is NULL for an unassigned case, so
-- NOT (false OR NULL) is NULL and the guard never raised. COALESCE closes it.
CREATE OR REPLACE FUNCTION public.confirm_registration_payment(
  p_payment_id uuid,
  p_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_payment RECORD;
  v_invoice RECORD;
  v_case RECORD;
  v_ref text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_payment
    FROM public.case_registration_payments
   WHERE id = p_payment_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;

  SELECT * INTO v_invoice
    FROM public.case_registration_invoices
   WHERE id = v_payment.invoice_id
   FOR UPDATE;

  SELECT id, assigned_to, status, case_reference INTO v_case
    FROM public.cases WHERE id = v_payment.case_id;

  IF NOT (public.has_role(v_uid,'admin') OR COALESCE(v_case.assigned_to = v_uid, false)) THEN
    RAISE EXCEPTION 'Not allowed to confirm this registration payment';
  END IF;

  IF v_payment.payment_method = 'card' THEN
    RAISE EXCEPTION 'Card payments are confirmed automatically';
  END IF;

  IF v_payment.status = 'confirmed' THEN
    RETURN jsonb_build_object(
      'payment_id',v_payment.id,
      'invoice_id',v_invoice.id,
      'case_id',v_case.id,
      'status','confirmed',
      'case_status',v_case.status
    );
  END IF;

  IF v_invoice.payment_status = 'paid'
     OR EXISTS (
       SELECT 1
       FROM public.case_registration_payments p
       WHERE p.invoice_id = v_invoice.id
         AND p.id <> v_payment.id
         AND p.status = 'confirmed'
     ) THEN
    RAISE EXCEPTION 'This registration has already been paid';
  END IF;

  IF v_payment.status <> 'submitted' THEN
    RAISE EXCEPTION 'Only submitted payments can be confirmed';
  END IF;

  IF v_payment.amount <> v_invoice.total_amount OR v_payment.currency <> v_invoice.currency THEN
    RAISE EXCEPTION 'Payment amount does not match the invoice';
  END IF;

  v_ref := COALESCE(NULLIF(trim(p_reference),''), v_payment.reference, v_case.case_reference);

  UPDATE public.case_registration_payments
     SET status='confirmed', reference=v_ref, confirmed_by=v_uid,
         confirmed_at=now(), failure_reason=NULL, updated_at=now()
   WHERE id=v_payment.id;

  UPDATE public.case_registration_invoices
     SET status='paid', payment_status='paid', updated_at=now()
   WHERE id=v_invoice.id;

  IF v_case.status = 'new' THEN
    UPDATE public.cases SET status='profile_completion' WHERE id=v_case.id;
  END IF;

  PERFORM public.log_case_event(
    v_case.id,
    'registration_payment_confirmed',
    jsonb_build_object(
      'payment_id',v_payment.id,'invoice_id',v_invoice.id,
      'payment_method',v_payment.payment_method,'amount',v_payment.amount,
      'currency',v_payment.currency,'reference',v_ref,'confirmed_by',v_uid
    ),
    true
  );

  RETURN jsonb_build_object(
    'payment_id',v_payment.id,
    'invoice_id',v_invoice.id,
    'case_id',v_case.id,
    'status','confirmed',
    'case_status',CASE WHEN v_case.status='new' THEN 'profile_completion' ELSE v_case.status END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_registration_payment(uuid,text) TO authenticated;
