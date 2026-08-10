-- Capture the case_finance_confirmations table and six finance/enrollment RPCs
-- that exist in the live database but had NO migration file. They were created
-- directly via the Supabase SQL editor.
--
-- Why this is critical:
--   `assert_case_ready_for_enrollment` is the enrollment gate — the single most
--   security-critical finance check. `admin-mark-paid` (Edge Function) calls it
--   via the user's JWT before allowing a case to flip to enrollment_paid. Without
--   this migration, `supabase db reset` silently omits the gate, and marking a
--   case paid would fail (or worse, the gate would be absent) on a fresh DB.
--
--   The table these RPCs operate on (case_finance_confirmations) was likewise
--   untracked. This migration creates it too.
--
-- All six RPCs are SECURITY DEFINER with search_path = public and re-check
-- auth.uid()/role inside, matching the pattern used by every other finance RPC
-- in the codebase (get_case_financials, set_case_services, etc.).
--
-- Signatures reproduced exactly from src/integrations/supabase/types.ts:
--   assert_case_ready_for_enrollment(p_case_id uuid) -> jsonb
--   confirm_agency_service_payment(p_case_id uuid) -> jsonb
--   confirm_german_finance_item(p_case_id uuid, p_finance_type text,
--                              p_note text DEFAULT NULL, p_proof_reference text DEFAULT NULL) -> jsonb
--   ensure_case_finance_confirmations(p_case_id uuid) -> void
--   get_case_darb_service_total(p_case_id uuid) -> numeric
--   sync_case_school_payments(p_case_id uuid) -> void

-- ── 0. case_finance_confirmations table ──────────────────────────────────
-- Tracks per-finance-item confirmation state for a case. One row per
-- (case_id, finance_type). finance_type ∈ {service_fee, school_course,
-- school_accommodation, school_insurance}. status ∈ {pending, confirmed, rejected}.
CREATE TABLE IF NOT EXISTS public.case_finance_confirmations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  finance_type    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  confirmed_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_at    TIMESTAMPTZ,
  proof_note      TEXT,
  proof_reference TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS case_finance_confirmations_case_type_key
  ON public.case_finance_confirmations (case_id, finance_type);

ALTER TABLE public.case_finance_confirmations ENABLE ROW LEVEL SECURITY;

-- Anyone who can read the case's financials can read its confirmation rows;
-- writes go through the SECURITY DEFINER RPCs (not direct table writes).
CREATE POLICY IF NOT EXISTS "Case readers can read finance confirmations"
  ON public.case_finance_confirmations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_finance_confirmations.case_id
        AND (c.assigned_to = auth.uid() OR c.student_user_id = auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.case_finance_confirmations TO authenticated;
GRANT ALL ON public.case_finance_confirmations TO service_role;

-- ── 1. get_case_darb_service_total ───────────────────────────────────────
-- Authoritative DARB (ILS) service total for a case, read from the frozen
-- case_services snapshot. Mirrors the service_total in get_case_financials.
CREATE OR REPLACE FUNCTION public.get_case_darb_service_total(p_case_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
  v_case RECORD;
  v_total numeric := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id, assigned_to, student_user_id INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;
  IF NOT (public.has_role(v_uid, 'admin') OR v_case.assigned_to = v_uid OR v_case.student_user_id = v_uid) THEN
    RAISE EXCEPTION 'Not allowed to read financials for this case';
  END IF;
  SELECT COALESCE(SUM(unit_price * quantity - discount), 0) INTO v_total
    FROM public.case_services WHERE case_id = p_case_id;
  RETURN round(v_total, 2);
END;
$$;

-- ── 2. ensure_case_finance_confirmations ────────────────────────────────
-- Idempotently creates a 'pending' confirmation row for every finance item
-- the case currently has (DARB service_fee, plus the school items selected in
-- case_submissions). Called when a case's finance tracking is first set up.
CREATE OR REPLACE FUNCTION public.ensure_case_finance_confirmations(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
  v_case RECORD;
  v_sub RECORD;
  v_types text[] := ARRAY[]::text[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id, assigned_to, student_user_id, status INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;
  IF NOT (public.has_role(v_uid, 'admin') OR v_case.assigned_to = v_uid) THEN
    RAISE EXCEPTION 'Not allowed to manage finance confirmations for this case';
  END IF;

  -- DARB agency service fee is always a finance item.
  v_types := array_append(v_types, 'service_fee');

  SELECT program_id, accommodation_id, insurance_id INTO v_sub
    FROM public.case_submissions
   WHERE case_id = p_case_id AND deleted_at IS NULL
   ORDER BY created_at DESC LIMIT 1;
  IF v_sub.program_id IS NOT NULL THEN v_types := array_append(v_types, 'school_course'); END IF;
  IF v_sub.accommodation_id IS NOT NULL THEN v_types := array_append(v_types, 'school_accommodation'); END IF;
  IF v_sub.insurance_id IS NOT NULL THEN v_types := array_append(v_types, 'school_insurance'); END IF;

  INSERT INTO public.case_finance_confirmations (case_id, finance_type, status)
  SELECT p_case_id, t, 'pending' FROM unnest(v_types) AS t
  ON CONFLICT (case_id, finance_type) DO NOTHING;
END;
$$;

-- ── 3. confirm_agency_service_payment ───────────────────────────────────
-- Marks the DARB service_fee confirmation as confirmed. Allowed for the
-- assigned team member (at profile_completion) or an admin. Returns a small
-- JSON summary mirroring get_case_financials fields.
CREATE OR REPLACE FUNCTION public.confirm_agency_service_payment(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
  v_case RECORD;
  v_total numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id, assigned_to, student_user_id, status INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;
  IF NOT (public.has_role(v_uid, 'admin') OR v_case.assigned_to = v_uid) THEN
    RAISE EXCEPTION 'Not allowed to confirm payments for this case';
  END IF;

  PERFORM public.ensure_case_finance_confirmations(p_case_id);

  v_total := public.get_case_darb_service_total(p_case_id);

  UPDATE public.case_finance_confirmations
     SET status = 'confirmed', confirmed_by = v_uid, confirmed_at = now(), updated_at = now()
   WHERE case_id = p_case_id AND finance_type = 'service_fee';

  RETURN jsonb_build_object(
    'case_id', p_case_id,
    'finance_type', 'service_fee',
    'status', 'confirmed',
    'service_total', v_total
  );
END;
$$;

-- ── 4. confirm_german_finance_item ─────────────────────────────────────
-- Marks a single Germany (EUR) school-cost finance item as confirmed. Admin
-- only — German payments require admin review, unlike the DARB service fee.
CREATE OR REPLACE FUNCTION public.confirm_german_finance_item(
  p_case_id uuid,
  p_finance_type text,
  p_note text DEFAULT NULL,
  p_proof_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Only admins can confirm German finance items';
  END IF;
  IF p_finance_type NOT IN ('school_course', 'school_accommodation', 'school_insurance') THEN
    RAISE EXCEPTION 'Unknown German finance type: %', p_finance_type;
  END IF;

  PERFORM public.ensure_case_finance_confirmations(p_case_id);

  UPDATE public.case_finance_confirmations
     SET status = 'confirmed',
         confirmed_by = v_uid,
         confirmed_at = now(),
         proof_note = COALESCE(p_note, proof_note),
         proof_reference = COALESCE(p_proof_reference, proof_reference),
         updated_at = now()
   WHERE case_id = p_case_id AND finance_type = p_finance_type;

  RETURN jsonb_build_object(
    'case_id', p_case_id,
    'finance_type', p_finance_type,
    'status', 'confirmed'
  );
END;
$$;

-- ── 5. sync_case_school_payments ────────────────────────────────────────
-- Reconciles case_finance_confirmations rows with the current case_submissions
-- selections, adding rows for newly selected school items. Does not delete or
-- downgrade existing confirmed rows. Idempotent.
CREATE OR REPLACE FUNCTION public.sync_case_school_payments(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
  v_sub RECORD;
  v_types text[] := ARRAY['school_course','school_accommodation','school_insurance']::text[];
  t text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM 1 FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;

  SELECT program_id, accommodation_id, insurance_id INTO v_sub
    FROM public.case_submissions
   WHERE case_id = p_case_id AND deleted_at IS NULL
   ORDER BY created_at DESC LIMIT 1;

  FOREACH t IN ARRAY v_types LOOP
    IF (t = 'school_course' AND v_sub.program_id IS NOT NULL)
    OR (t = 'school_accommodation' AND v_sub.accommodation_id IS NOT NULL)
    OR (t = 'school_insurance' AND v_sub.insurance_id IS NOT NULL) THEN
      INSERT INTO public.case_finance_confirmations (case_id, finance_type, status)
      VALUES (p_case_id, t, 'pending')
      ON CONFLICT (case_id, finance_type) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- ── 6. assert_case_ready_for_enrollment ─────────────────────────────────
-- THE ENROLLMENT GATE. Returns jsonb describing the readiness checks and
-- RAISES (aborting the calling transaction) if any required Germany finance
-- item is not yet confirmed. admin-mark-paid calls this via the user's JWT and
-- treats a raised exception as an authoritative rejection — it does not trust
-- the client. A required item is one selected in case_submissions: if the case
-- has a program/accommodation/insurance, the matching confirmation must be
-- 'confirmed'. The DARB service_fee is NOT gated here (it is confirmed
-- separately and is an agency matter, not a Germany enrollment prerequisite).
CREATE OR REPLACE FUNCTION public.assert_case_ready_for_enrollment(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
  v_case RECORD;
  v_sub RECORD;
  v_items jsonb := '[]'::jsonb;
  v_ready boolean := true;
  v_req RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id, status INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;

  SELECT program_id, accommodation_id, insurance_id INTO v_sub
    FROM public.case_submissions
   WHERE case_id = p_case_id AND deleted_at IS NULL
   ORDER BY created_at DESC LIMIT 1;

  -- Build the per-item readiness report.
  FOR v_req IN
    SELECT finance_type, status
      FROM public.case_finance_confirmations
     WHERE case_id = p_case_id
       AND finance_type IN ('school_course','school_accommodation','school_insurance')
  LOOP
    v_items := v_items || jsonb_build_object(
      'finance_type', v_req.finance_type,
      'confirmed', (v_req.status = 'confirmed')
    );
    IF v_req.status <> 'confirmed' THEN
      -- Only fail if this item was actually selected for the case.
      IF (v_req.finance_type = 'school_course' AND v_sub.program_id IS NOT NULL)
      OR (v_req.finance_type = 'school_accommodation' AND v_sub.accommodation_id IS NOT NULL)
      OR (v_req.finance_type = 'school_insurance' AND v_sub.insurance_id IS NOT NULL) THEN
        v_ready := false;
      END IF;
    END IF;
  END LOOP;

  IF NOT v_ready THEN
    RAISE EXCEPTION 'Case % is not ready for enrollment: one or more German finance items are not confirmed', p_case_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN jsonb_build_object(
    'case_id', p_case_id,
    'ready', true,
    'items', v_items
  );
END;
$$;

-- Restrict all six functions to authenticated callers (service_role inherits
-- all privileges). They re-check role/ownership internally.
REVOKE ALL ON FUNCTION public.get_case_darb_service_total(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ensure_case_finance_confirmations(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_agency_service_payment(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_german_finance_item(uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.sync_case_school_payments(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.assert_case_ready_for_enrollment(uuid) FROM anon;
