-- Monthly tax report: income must come from the authoritative payment source.
--
-- Previously `gross` was summed from case_submissions.service_fee where
-- enrollment_paid_at is set. Those submission columns are legacy mirrors that
-- the current finance flow no longer maintains (admin-mark-paid documents them
-- as "NOT the authoritative enrollment/payment source"), so the report could
-- show zero/outdated gross for cases that were confirmed and paid through the
-- finance tab.
--
-- Income now comes from confirmed agency-service payments in case_payments
-- (written by confirm_agency_service_payment / submit+confirm_case_payment),
-- keyed by confirmed_at. Expense (commissions paid) is unchanged: paid
-- payout_requests. Output columns and VAT math are identical to before.

CREATE OR REPLACE FUNCTION public.get_monthly_tax_report()
RETURNS TABLE(
  month text,
  gross_collected numeric,
  vat_amount numeric,
  net_before_vat numeric,
  commissions_paid numeric,
  net_margin numeric,
  transactions_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate numeric := 0.18;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT COALESCE(ps.vat_rate, 0.18) INTO v_rate FROM public.platform_settings ps LIMIT 1;
  IF v_rate IS NULL THEN v_rate := 0.18; END IF;

  RETURN QUERY
  WITH income AS (
    SELECT to_char((cp.confirmed_at AT TIME ZONE 'Asia/Jerusalem'), 'YYYY-MM') AS m,
           COALESCE(SUM(cp.amount), 0)::numeric AS gross,
           COUNT(*)::bigint AS cnt
    FROM public.case_payments cp
    WHERE cp.payment_type = 'agency_service'
      AND cp.status = 'confirmed'
      AND cp.confirmed_at IS NOT NULL
    GROUP BY 1
  ),
  expense AS (
    SELECT to_char((pr.paid_at AT TIME ZONE 'Asia/Jerusalem'), 'YYYY-MM') AS m,
           COALESCE(SUM(pr.amount), 0)::numeric AS paid_out
    FROM public.payout_requests pr
    WHERE pr.status = 'paid' AND pr.paid_at IS NOT NULL
    GROUP BY 1
  ),
  months AS (
    SELECT m FROM income
    UNION
    SELECT m FROM expense
  )
  SELECT mo.m,
         COALESCE(i.gross, 0),
         ROUND(COALESCE(i.gross, 0) * v_rate / (1 + v_rate), 2),
         ROUND(COALESCE(i.gross, 0) - (COALESCE(i.gross, 0) * v_rate / (1 + v_rate)), 2),
         COALESCE(e.paid_out, 0),
         ROUND(COALESCE(i.gross, 0) - (COALESCE(i.gross, 0) * v_rate / (1 + v_rate)) - COALESCE(e.paid_out, 0), 2),
         COALESCE(i.cnt, 0)
  FROM months mo
  LEFT JOIN income i ON i.m = mo.m
  LEFT JOIN expense e ON e.m = mo.m
  WHERE mo.m IS NOT NULL
  ORDER BY mo.m DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_monthly_tax_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_monthly_tax_report() TO authenticated, service_role;
