-- The DARB invoice `totals` snapshot must carry the confirmed-payment state at
-- issue time. Previously issue_case_invoice only wrote `service_total`, so the
-- public invoice page and the invoice PDF always fell back to paid = 0 and
-- remaining = full total -- even for fully-paid cases. get_invoice_by_token
-- returns i.totals verbatim, so there was no way for the client to know what
-- had been confirmed.
--
-- This redefinition adds two keys to the snapshot, mirroring the authoritative
-- get_case_financials (20260809170523_a1fd9839-4656-4941-8bf0-38667f464bb1.sql)
-- but scoped to the DARB agency-service payment this invoice represents:
--   total_confirmed -> confirmed agency_service payments (ILS)
--   remaining        -> GREATEST(service_total - total_confirmed, 0)

CREATE OR REPLACE FUNCTION public.issue_case_invoice(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_case RECORD;
  v_sub RECORD;
  v_inv public.case_invoices%ROWTYPE;
  v_number text;
  v_services jsonb;
  v_total numeric := 0;
  v_confirmed numeric := 0;
  v_totals jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, case_reference, full_name, email, assigned_to
    INTO v_case
    FROM public.cases
   WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;

  IF NOT (public.has_role(v_uid, 'admin') OR v_case.assigned_to = v_uid) THEN
    RAISE EXCEPTION 'Not allowed to issue an invoice for this case';
  END IF;

  SELECT student_email INTO v_sub
    FROM public.case_submissions
   WHERE case_id = p_case_id AND deleted_at IS NULL
   ORDER BY created_at DESC LIMIT 1;

  SELECT COALESCE(SUM(unit_price * quantity - discount), 0)
    INTO v_total
    FROM public.case_services
   WHERE case_id = p_case_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', cs.id,
      'description', cs.description,
      'category', cs.category,
      'quantity', cs.quantity,
      'unit_price', cs.unit_price,
      'discount', cs.discount,
      'currency', cs.currency,
      'line_total', round((cs.unit_price * cs.quantity - cs.discount), 2)
    ) ORDER BY cs.created_at
  ), '[]'::jsonb)
    INTO v_services
    FROM public.case_services cs
   WHERE cs.case_id = p_case_id;

  -- DARB agency fee confirmed at issue time. Only the agency-service payment
  -- belongs on the student invoice; Germany (EUR) rows are verified later.
  SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0)
    INTO v_confirmed
    FROM public.case_payments
   WHERE case_id = p_case_id AND payment_type = 'agency_service';

  v_totals := jsonb_build_object(
    'case_id', p_case_id,
    'case_reference', v_case.case_reference,
    'student_name', v_case.full_name,
    'currency', 'ILS',
    'services', v_services,
    'service_total', round(v_total, 2),
    'total_confirmed', round(v_confirmed, 2),
    'remaining', round(GREATEST(v_total - v_confirmed, 0), 2),
    'payment_type', 'agency_service'
  );

  SELECT * INTO v_inv FROM public.case_invoices WHERE case_id = p_case_id;

  IF FOUND THEN
    UPDATE public.case_invoices
       SET totals = v_totals,
           case_reference = v_case.case_reference,
           student_name = v_case.full_name,
           student_email = COALESCE(v_sub.student_email, v_case.email),
           issued_at = now(),
           issued_by = v_uid,
           email_status = 'pending',
           email_error = NULL
     WHERE id = v_inv.id
     RETURNING * INTO v_inv;
  ELSE
    v_number := 'DRB-INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.case_invoice_seq')::text, 6, '0');
    INSERT INTO public.case_invoices (
      case_id, invoice_number, case_reference, student_name, student_email, totals, issued_by
    ) VALUES (
      p_case_id, v_number, v_case.case_reference, v_case.full_name,
      COALESCE(v_sub.student_email, v_case.email), v_totals, v_uid
    ) RETURNING * INTO v_inv;
  END IF;

  RETURN to_jsonb(v_inv);
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_case_invoice(uuid) TO authenticated, service_role;
