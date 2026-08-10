-- Align finance workflow with the DARB specification.
--
-- Rules:
-- 1. DARB services are ILS and are the only amounts represented on the
--    team-issued case invoice.
-- 2. The assigned Team member confirms DARB service payment.
-- 3. Germany costs remain EUR estimates and are verified by Admin only after
--    student proof is submitted.
-- 4. Submission is gated server-side by DARB service selection/payment,
--    profile completeness, and valid school/program/accommodation data.
-- 5. Client checkboxes are never authoritative.

-- ---------------------------------------------------------------------------
-- Payment proof audit trail for Germany-side payments.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_payment_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.case_payments(id) ON DELETE SET NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('school_course','school_accommodation','school_insurance')),
  file_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS case_payment_proofs_case_idx
  ON public.case_payment_proofs(case_id, payment_type, uploaded_at DESC);

ALTER TABLE public.case_payment_proofs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Case members read payment proofs" ON public.case_payment_proofs;
CREATE POLICY "Case members read payment proofs"
  ON public.case_payment_proofs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_payment_proofs.case_id
        AND (c.assigned_to = auth.uid() OR c.student_user_id = auth.uid())
    )
  );

GRANT SELECT ON public.case_payment_proofs TO authenticated;
GRANT ALL ON public.case_payment_proofs TO service_role;

-- ---------------------------------------------------------------------------
-- Canonical submission gate.
-- The client may show a checklist, but this function is authoritative.
-- ---------------------------------------------------------------------------
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
  v_service_total numeric := 0;
  v_agency_confirmed boolean := false;
  v_inv jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, status, assigned_to, case_reference, full_name
    INTO v_case
    FROM public.cases
   WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;

  IF NOT (public.has_role(v_uid, 'admin') OR v_case.assigned_to = v_uid) THEN
    RAISE EXCEPTION 'Not allowed to submit this case';
  END IF;

  IF v_case.status NOT IN ('profile_completion','payment_confirmed') THEN
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

  IF v_sub.school_id IS NULL OR v_sub.program_id IS NULL OR v_sub.program_start_date IS NULL THEN
    RAISE EXCEPTION 'SUBMIT_BLOCKED: school, course and start date are required';
  END IF;

  SELECT COALESCE(SUM(unit_price * quantity - discount), 0)
    INTO v_service_total
    FROM public.case_services
   WHERE case_id = p_case_id;

  IF v_service_total <= 0 THEN
    RAISE EXCEPTION 'SUBMIT_BLOCKED: select at least one DARB service before submitting';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.case_finance_confirmations cfc
     WHERE cfc.case_id = p_case_id
       AND cfc.finance_type = 'service_fee'
       AND cfc.status = 'confirmed'
  ) INTO v_agency_confirmed;

  IF NOT v_agency_confirmed THEN
    RAISE EXCEPTION 'SUBMIT_BLOCKED: DARB service payment must be confirmed by the assigned team member';
  END IF;

  UPDATE public.case_submissions
     SET submitted_at = now(),
         submitted_by = v_uid,
         review_status = 'submitted',
         review_note = NULL
   WHERE id = v_sub.id;

  UPDATE public.cases
     SET status = 'submitted'
   WHERE id = p_case_id;

  -- The invoice issued at submission contains DARB agency services only.
  v_inv := public.issue_case_invoice(p_case_id);
  RETURN v_inv;
END;
$$;

-- ---------------------------------------------------------------------------
-- Invoice snapshot: DARB services only. Germany costs are estimates and are
-- never mixed into the ILS agency invoice.
-- ---------------------------------------------------------------------------
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

  v_totals := jsonb_build_object(
    'case_id', p_case_id,
    'case_reference', v_case.case_reference,
    'student_name', v_case.full_name,
    'currency', 'ILS',
    'services', v_services,
    'service_total', round(v_total, 2),
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

-- ---------------------------------------------------------------------------
-- German proof submission. Students can submit proof; only Admin can later
-- confirm/reject the corresponding finance item.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_german_payment_proof(
  p_case_id uuid,
  p_payment_type text,
  p_file_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_case RECORD;
  v_proof public.case_payment_proofs%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_payment_type NOT IN ('school_course','school_accommodation','school_insurance') THEN
    RAISE EXCEPTION 'Unknown German payment type';
  END IF;
  IF NULLIF(trim(p_file_path), '') IS NULL THEN
    RAISE EXCEPTION 'Proof file is required';
  END IF;

  SELECT id, student_user_id INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;
  IF v_case.student_user_id <> v_uid THEN
    RAISE EXCEPTION 'Only the student can submit payment proof';
  END IF;

  INSERT INTO public.case_payment_proofs (
    case_id, payment_type, file_path, uploaded_by, status
  ) VALUES (
    p_case_id, p_payment_type, p_file_path, v_uid, 'pending'
  ) RETURNING * INTO v_proof;

  INSERT INTO public.case_finance_confirmations (case_id, finance_type, status, proof_reference)
  VALUES (p_case_id, p_payment_type, 'pending', p_file_path)
  ON CONFLICT (case_id, finance_type)
  DO UPDATE SET status = CASE
      WHEN public.case_finance_confirmations.status = 'confirmed' THEN public.case_finance_confirmations.status
      ELSE 'pending'
    END,
    proof_reference = EXCLUDED.proof_reference,
    updated_at = now();

  RETURN jsonb_build_object(
    'id', v_proof.id,
    'case_id', v_proof.case_id,
    'payment_type', v_proof.payment_type,
    'file_path', v_proof.file_path,
    'status', v_proof.status,
    'uploaded_at', v_proof.uploaded_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_german_payment_proof(uuid,text,text) TO authenticated;

-- Admin review of a Germany proof. Confirmation remains Admin-only.
CREATE OR REPLACE FUNCTION public.review_german_payment_proof(
  p_proof_id uuid,
  p_approved boolean,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_proof public.case_payment_proofs%ROWTYPE;
  v_status text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Only admins can review German payment proof';
  END IF;

  SELECT * INTO v_proof FROM public.case_payment_proofs WHERE id = p_proof_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment proof not found'; END IF;

  v_status := CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END;

  UPDATE public.case_payment_proofs
     SET status = v_status,
         reviewed_by = v_uid,
         reviewed_at = now(),
         rejection_reason = CASE WHEN p_approved THEN NULL ELSE p_rejection_reason END
   WHERE id = p_proof_id;

  IF p_approved THEN
    PERFORM public.confirm_german_finance_item(
      v_proof.case_id,
      v_proof.payment_type,
      NULL,
      v_proof.file_path
    );
  ELSE
    UPDATE public.case_finance_confirmations
       SET status = 'rejected',
           proof_reference = v_proof.file_path,
           updated_at = now()
     WHERE case_id = v_proof.case_id
       AND finance_type = v_proof.payment_type;
  END IF;

  RETURN jsonb_build_object(
    'id', p_proof_id,
    'status', v_status,
    'case_id', v_proof.case_id,
    'payment_type', v_proof.payment_type
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_german_payment_proof(uuid,boolean,text) TO authenticated;
