CREATE SEQUENCE IF NOT EXISTS public.case_invoice_seq;

CREATE TABLE public.case_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL UNIQUE REFERENCES public.cases(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE,
  public_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  case_reference text,
  student_name text,
  student_email text,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by uuid,
  email_status text NOT NULL DEFAULT 'pending',
  email_error text,
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.case_invoices TO authenticated;
GRANT ALL ON public.case_invoices TO service_role;

ALTER TABLE public.case_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read invoices"
  ON public.case_invoices FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Case members read invoices"
  ON public.case_invoices FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_invoices.case_id
      AND (c.assigned_to = auth.uid() OR c.student_user_id = auth.uid())
  ));

CREATE TRIGGER update_case_invoices_updated_at
  BEFORE UPDATE ON public.case_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Issue (or refresh) the invoice for a case using the authoritative financials.
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
  v_fin jsonb;
  v_inv public.case_invoices%ROWTYPE;
  v_number text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, case_reference, full_name, email, assigned_to
    INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;

  IF NOT (public.has_role(v_uid, 'admin') OR v_case.assigned_to = v_uid) THEN
    RAISE EXCEPTION 'Not allowed to issue an invoice for this case';
  END IF;

  SELECT student_email INTO v_sub FROM public.case_submissions
   WHERE case_id = p_case_id AND deleted_at IS NULL
   ORDER BY created_at DESC LIMIT 1;

  v_fin := public.get_case_financials(p_case_id);

  SELECT * INTO v_inv FROM public.case_invoices WHERE case_id = p_case_id;

  IF FOUND THEN
    UPDATE public.case_invoices
       SET totals = v_fin,
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
    v_number := 'DRB-INV-' || to_char(now(), 'YYYY') || '-'
                || lpad(nextval('public.case_invoice_seq')::text, 6, '0');
    INSERT INTO public.case_invoices (
      case_id, invoice_number, case_reference, student_name, student_email, totals, issued_by
    ) VALUES (
      p_case_id, v_number, v_case.case_reference, v_case.full_name,
      COALESCE(v_sub.student_email, v_case.email), v_fin, v_uid
    ) RETURNING * INTO v_inv;
  END IF;

  RETURN to_jsonb(v_inv);
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_case_invoice(uuid) TO authenticated;

-- Single backend entry point for submitting a case to the admin.
CREATE OR REPLACE FUNCTION public.submit_case_for_review(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_case RECORD;
  v_sub RECORD;
  v_inv jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, status, assigned_to INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;

  IF NOT (public.has_role(v_uid, 'admin') OR v_case.assigned_to = v_uid) THEN
    RAISE EXCEPTION 'Not allowed to submit this case';
  END IF;

  IF v_case.status <> 'payment_confirmed' THEN
    RAISE EXCEPTION 'SUBMIT_BLOCKED: the case must be at the payment stage first';
  END IF;

  SELECT * INTO v_sub FROM public.case_submissions
   WHERE case_id = p_case_id AND deleted_at IS NULL
   ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUBMIT_BLOCKED: the student file is missing'; END IF;

  IF COALESCE(v_sub.payment_confirmed, false) = false THEN
    RAISE EXCEPTION 'SUBMIT_BLOCKED: confirm the payment first';
  END IF;
  IF v_sub.profile_completed_at IS NULL THEN
    RAISE EXCEPTION 'SUBMIT_BLOCKED: the student file must be complete first';
  END IF;
  IF v_sub.school_id IS NULL OR v_sub.program_id IS NULL OR v_sub.program_start_date IS NULL THEN
    RAISE EXCEPTION 'SUBMIT_BLOCKED: school, course and start date are required';
  END IF;

  UPDATE public.case_submissions
     SET submitted_at = now(), submitted_by = v_uid,
         review_status = 'submitted', review_note = NULL
   WHERE id = v_sub.id;

  UPDATE public.cases SET status = 'submitted' WHERE id = p_case_id;

  v_inv := public.issue_case_invoice(p_case_id);

  RETURN v_inv;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_case_for_review(uuid) TO authenticated;

-- Public read of a single invoice through its unguessable link token.
CREATE OR REPLACE FUNCTION public.get_invoice_by_token(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'invoice_number', i.invoice_number,
    'case_reference', i.case_reference,
    'student_name', i.student_name,
    'issued_at', i.issued_at,
    'totals', i.totals
  )
  FROM public.case_invoices i
  WHERE i.public_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invoice_by_token(text) TO anon, authenticated;

-- Record the outcome of the invoice email so failures stay visible.
CREATE OR REPLACE FUNCTION public.mark_invoice_email(p_invoice_id uuid, p_status text, p_error text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_status NOT IN ('pending', 'sent', 'failed') THEN
    RAISE EXCEPTION 'Invalid email status';
  END IF;

  UPDATE public.case_invoices i
     SET email_status = p_status,
         email_error = p_error,
         email_sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE i.email_sent_at END
   WHERE i.id = p_invoice_id
     AND EXISTS (
       SELECT 1 FROM public.cases c
       WHERE c.id = i.case_id
         AND (public.has_role(v_uid, 'admin') OR c.assigned_to = v_uid)
     );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_invoice_email(uuid, text, text) TO authenticated;