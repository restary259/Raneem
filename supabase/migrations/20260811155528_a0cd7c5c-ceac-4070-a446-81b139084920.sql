CREATE OR REPLACE FUNCTION public.issue_case_invoice(p_case_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_case RECORD;
  v_fin jsonb;
  v_inv public.case_invoices%ROWTYPE;
  v_number text;
  v_email text;
  v_service_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, case_reference, full_name, assigned_to, student_user_id
    INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;

  IF NOT (public.has_role(v_uid, 'admin') OR v_case.assigned_to = v_uid) THEN
    RAISE EXCEPTION 'Not allowed to issue an invoice for this case';
  END IF;

  -- The submission carries the student's contact email; the linked student
  -- account is the fallback once the dashboard invite has been accepted.
  SELECT NULLIF(btrim(cs.student_email), '') INTO v_email
    FROM public.case_submissions cs
   WHERE cs.case_id = p_case_id AND cs.deleted_at IS NULL
   ORDER BY cs.created_at DESC LIMIT 1;

  IF v_email IS NULL AND v_case.student_user_id IS NOT NULL THEN
    SELECT NULLIF(btrim(p.email), '') INTO v_email
      FROM public.profiles p WHERE p.id = v_case.student_user_id;
  END IF;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Cannot issue an invoice: no student email on file for this case';
  END IF;

  SELECT count(*) INTO v_service_count FROM public.case_services WHERE case_id = p_case_id;
  IF v_service_count = 0 THEN
    RAISE EXCEPTION 'Cannot issue an invoice: no services selected for this case';
  END IF;

  v_fin := public.get_case_financials(p_case_id);

  SELECT * INTO v_inv FROM public.case_invoices WHERE case_id = p_case_id;

  IF FOUND THEN
    UPDATE public.case_invoices
       SET totals = v_fin,
           case_reference = v_case.case_reference,
           student_name = v_case.full_name,
           student_email = v_email,
           issued_at = now(),
           issued_by = v_uid,
           email_status = 'pending',
           email_error = NULL
     WHERE id = v_inv.id
     RETURNING * INTO v_inv;
  ELSE
    v_number := 'DRB-INV-' || to_char(now(), 'YYYY') || '-'
                || lpad(nextval('public.case_invoice_seq')::text, 6, '0');
    INSERT INTO public.case_invoices (
      case_id, invoice_number, case_reference, student_name, student_email, totals, issued_by
    ) VALUES (
      p_case_id, v_number, v_case.case_reference, v_case.full_name,
      v_email, v_fin, v_uid
    ) RETURNING * INTO v_inv;
  END IF;

  RETURN to_jsonb(v_inv);
END;
$function$;