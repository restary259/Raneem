ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 0.18;

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
    SELECT to_char((cs.enrollment_paid_at AT TIME ZONE 'Asia/Jerusalem'), 'YYYY-MM') AS m,
           COALESCE(SUM(cs.service_fee), 0)::numeric AS gross,
           COUNT(*)::bigint AS cnt
    FROM public.case_submissions cs
    WHERE cs.enrollment_paid_at IS NOT NULL
      AND cs.deleted_at IS NULL
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
GRANT EXECUTE ON FUNCTION public.get_monthly_tax_report() TO authenticated;