ALTER VIEW public.v_cash_debts SET (security_invoker = true);
REVOKE ALL ON public.v_cash_debts FROM anon, authenticated;
GRANT SELECT ON public.v_cash_debts TO service_role;