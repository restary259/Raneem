-- The DARB invoice must only be issuable after Team has submitted the case to
-- Admin. Migration 20260810130200 added that INVOICE_BLOCKED status gate, but
-- the snapshot redefinition in 20260810170000 replaced the whole function body
-- from an older template and silently dropped the gate, letting any assigned
-- team member or admin mint an invoice (and consume an invoice_number from the
-- sequence) for a case that was never submitted.
--
-- This redefinition restores the gate inside the same function while keeping
-- the 20260810170000 snapshot keys (total_confirmed / remaining). It is safe
-- for the submit flow: submit_case_for_review advances cases.status to
-- 'submitted' BEFORE calling issue_case_invoice (20260810130000, lines
-- 129-134), so the gate never blocks the side-effect issuance.
--
-- Privileges are re-asserted explicitly (same set as 20260810080000 /
-- 20260810170000): no PUBLIC/anon execute.

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

  SELECT id, case_reference, full_name, email, assigned_to, status
    INTO v_case
    FROM public.cases
   WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;

  IF NOT (public.has_role(v_uid, 'admin') OR v_case.assigned_to = v_uid) THEN
    RAISE EXCEPTION 'Not allowed to issue an invoice for this case';
  END IF;

  -- Restored from 20260810130200: issuance is a submission side effect.
  IF v_case.status NOT IN ('submitted','enrollment_paid') THEN
    RAISE EXCEPTION 'INVOICE_BLOCKED: invoice is issued only after the Team submits the case to Admin';
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

REVOKE ALL ON FUNCTION public.issue_case_invoice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_case_invoice(uuid) TO authenticated, service_role;
