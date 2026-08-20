-- ═══════════════════════════════════════════════════════════════════════
-- Cash Collection workflow — one synchronized source of truth.
--
-- A Team Member confirms a student's payment as cash (payment_method='cash').
-- That confirmed case_payments row is the single record every surface reads:
--   • Admin Command Center  → get_admin_cash_collections()
--   • Admin member drawer   → get_member_cash_debts(uuid)
--   • Team Member dashboard → get_my_cash_debts()
--   • Settle action         → settle_cash_collection(uuid)  (admin only)
--
-- "Cash owed to Admin" = the FULL amount of confirmed cash agency-service
-- payments with cash_settled_at IS NULL. Settling writes cash_settled_at on
-- the same row — nothing else moves, so every view updates atomically.
--
-- Several pieces existed only out-of-band in the live DB (payment_method,
-- v_cash_debts, settle_cash_collection). This migration captures all of them
-- in version control, idempotently, so a fresh deploy matches production.
--
-- NOT touched (per guard rails): get_case_financials, get_members_directory,
-- invoice totals, commission/rewards tables, spreadsheet export (already
-- reads cash_settled_at and picks up settlements automatically), triggers.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. case_payments.payment_method (was out-of-band) ─────────────────────
ALTER TABLE public.case_payments
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'bank_transfer';

-- ── 2. confirm_agency_service_payment records the payment method ──────────
-- Identical behavior to 20260810160000_confirm_payment_records_agency_payment.sql,
-- plus capturing HOW the student paid (cash vs bank_transfer) on the
-- case_payments row. The frontend already passes p_payment_method.
DROP FUNCTION IF EXISTS public.confirm_agency_service_payment(uuid);
DROP FUNCTION IF EXISTS public.confirm_agency_service_payment(uuid, text);

CREATE FUNCTION public.confirm_agency_service_payment(p_case_id uuid, p_payment_method text DEFAULT 'bank_transfer')
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

  IF p_payment_method NOT IN ('cash', 'bank_transfer') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_payment_method;
  END IF;

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
  --    submit_case_for_review gate.
  UPDATE public.case_submissions
     SET payment_confirmed = true,
         payment_confirmed_at = COALESCE(payment_confirmed_at, now()),
         payment_confirmed_by = COALESCE(payment_confirmed_by, v_uid)
   WHERE case_id = p_case_id AND deleted_at IS NULL;

  -- 3. Advance the case to payment_confirmed when it is still at the
  --    profile_completion stage.
  IF v_case.status = 'profile_completion' THEN
    UPDATE public.cases SET status = 'payment_confirmed' WHERE id = p_case_id;
  END IF;

  -- 4. Record the confirmed DARB agency fee in case_payments. Idempotent:
  --    re-confirming updates the existing row instead of creating a duplicate.
  --    payment_method is stamped here — this is what makes the payment show up
  --    in the cash-collection workflow when the student paid in cash.
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
       note, recorded_by, submitted_by, submitted_at, confirmed_by, confirmed_at,
       payment_method)
    VALUES
      (p_case_id, 'agency_service', round(v_total, 2), 'ILS', 'confirmed', 'paid', now(),
       'DARB agency service fee - confirmed', v_uid, v_uid, now(), v_uid, now(),
       p_payment_method)
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
           confirmed_at = now(),
           payment_method = p_payment_method
     WHERE id = v_payment_id;
  END IF;

  RETURN jsonb_build_object(
    'case_id', p_case_id,
    'finance_type', 'service_fee',
    'status', 'confirmed',
    'payment_id', v_payment_id,
    'amount_ils', round(v_total, 2),
    'service_total', v_total,
    'payment_method', p_payment_method,
    'case_status', CASE WHEN v_case.status = 'profile_completion'
                        THEN 'payment_confirmed' ELSE v_case.status END,
    'already_confirmed', v_already_confirmed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_agency_service_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_agency_service_payment(uuid, text) TO authenticated, service_role;

-- ── 3. v_cash_debts — committed definition (was out-of-band) ──────────────
-- One row per confirmed CASH agency-service payment on a live case.
-- amount_owed_to_admin is the full cash amount the team member is holding
-- until it is handed over (cash_settled_at IS NULL → 'pending').
-- Dropped and recreated so the committed definition is authoritative; the
-- reader RPCs below use explicit RETURNS TABLE, so nothing depends on the
-- view's shape.
DROP VIEW IF EXISTS public.v_cash_debts;

CREATE VIEW public.v_cash_debts AS
SELECT
  p.id                                   AS payment_id,
  p.case_id                              AS case_id,
  c.case_reference                       AS case_reference,
  c.full_name                            AS student_name,
  c.assigned_to                          AS team_member_id,
  (SELECT s.service_fee
     FROM public.case_submissions s
    WHERE s.case_id = p.case_id AND s.deleted_at IS NULL
    ORDER BY s.created_at DESC
    LIMIT 1)                             AS service_fee,
  COALESCE(
    (SELECT o.commission_amount
       FROM public.team_member_commission_overrides o
      WHERE o.team_member_id = c.assigned_to),
    (SELECT ps.team_member_commission_rate FROM public.platform_settings ps LIMIT 1),
    100)                                 AS team_commission,
  p.amount                               AS amount_owed_to_admin,
  COALESCE(p.confirmed_at, p.created_at) AS collected_at,
  p.cash_settled_at                      AS settled_at,
  CASE WHEN p.cash_settled_at IS NULL THEN 'pending' ELSE 'settled' END
                                         AS debt_status
FROM public.case_payments p
JOIN public.cases c ON c.id = p.case_id
WHERE p.payment_type = 'agency_service'
  AND p.status = 'confirmed'
  AND p.payment_method = 'cash'
  AND c.deleted_at IS NULL;

ALTER VIEW public.v_cash_debts SET (security_invoker = true);
REVOKE ALL ON public.v_cash_debts FROM anon, authenticated;
GRANT SELECT ON public.v_cash_debts TO service_role;

-- ── 4. Reader RPCs (return type extended → drop first) ────────────────────
-- Both return ALL statuses; UIs filter debt_status client-side so settled
-- history stays visible where needed.
DROP FUNCTION IF EXISTS public.get_my_cash_debts();

CREATE FUNCTION public.get_my_cash_debts()
RETURNS TABLE (
  payment_id            uuid,
  case_id               uuid,
  case_reference        text,
  student_name          text,
  amount_owed_to_admin  numeric,
  debt_status           text,
  collected_at          timestamptz,
  settled_at            timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT payment_id, case_id, case_reference, student_name,
         amount_owed_to_admin, debt_status, collected_at, settled_at
  FROM   public.v_cash_debts
  WHERE  team_member_id = auth.uid()
  ORDER  BY collected_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_my_cash_debts() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_cash_debts() TO authenticated;

DROP FUNCTION IF EXISTS public.get_member_cash_debts(uuid);

CREATE FUNCTION public.get_member_cash_debts(p_member_id uuid)
RETURNS TABLE (
  payment_id            uuid,
  case_id               uuid,
  case_reference        text,
  student_name          text,
  amount_owed_to_admin  numeric,
  debt_status           text,
  collected_at          timestamptz,
  settled_at            timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT cd.payment_id, cd.case_id, cd.case_reference, cd.student_name,
         cd.amount_owed_to_admin, cd.debt_status, cd.collected_at, cd.settled_at
  FROM   public.v_cash_debts cd
  WHERE  cd.team_member_id = p_member_id
  ORDER  BY cd.collected_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_member_cash_debts(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_member_cash_debts(uuid) TO authenticated;

-- ── 5. Admin Command Center: every unsettled cash payment, oldest first ───
CREATE OR REPLACE FUNCTION public.get_admin_cash_collections()
RETURNS TABLE (
  payment_id        uuid,
  case_id           uuid,
  case_reference    text,
  student_name      text,
  team_member_id    uuid,
  team_member_name  text,
  amount            numeric,
  collected_at      timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT cd.payment_id, cd.case_id, cd.case_reference, cd.student_name,
         cd.team_member_id, pr.full_name AS team_member_name,
         cd.amount_owed_to_admin AS amount, cd.collected_at
  FROM   public.v_cash_debts cd
  LEFT JOIN public.profiles pr ON pr.id = cd.team_member_id
  WHERE  cd.debt_status = 'pending'
  ORDER  BY cd.collected_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_cash_collections() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_cash_collections() TO authenticated;

-- ── 6. settle_cash_collection — admin marks cash as handed over ───────────
-- Idempotent: settling an already-settled case is a no-op that reports
-- already_settled instead of failing. Settlement is written on the SAME
-- case_payments row, so every reader (admin queue, member drawer, team KPI,
-- spreadsheet export) updates from one write. A case_timeline event keeps
-- the settlement history auditable. Team members cannot call this: the
-- has_role('admin') gate is the enforcement.
DROP FUNCTION IF EXISTS public.settle_cash_collection(uuid);

CREATE FUNCTION public.settle_cash_collection(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_payment RECORD;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  -- Prefer the unsettled row when one exists (idempotent re-settle).
  SELECT id, amount, cash_settled_at INTO v_payment
    FROM public.case_payments
   WHERE case_id = p_case_id
     AND payment_type = 'agency_service'
     AND status = 'confirmed'
     AND payment_method = 'cash'
   ORDER BY (cash_settled_at IS NULL) DESC, created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No confirmed cash payment found for this case';
  END IF;

  IF v_payment.cash_settled_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'case_id', p_case_id,
      'payment_id', v_payment.id,
      'amount', v_payment.amount,
      'settled', false,
      'already_settled', true,
      'settled_at', v_payment.cash_settled_at
    );
  END IF;

  UPDATE public.case_payments
     SET cash_settled_at = now()
   WHERE id = v_payment.id;

  PERFORM public.log_case_event(
    p_case_id,
    'cash_settled',
    jsonb_build_object('payment_id', v_payment.id, 'amount', v_payment.amount, 'currency', 'ILS'),
    true
  );

  RETURN jsonb_build_object(
    'case_id', p_case_id,
    'payment_id', v_payment.id,
    'amount', v_payment.amount,
    'settled', true,
    'already_settled', false,
    'settled_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_cash_collection(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.settle_cash_collection(uuid) TO authenticated;
