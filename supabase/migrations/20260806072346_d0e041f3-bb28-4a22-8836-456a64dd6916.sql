REVOKE ALL ON FUNCTION public.restrict_payments_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restrict_services_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restrict_referrals_discount() FROM PUBLIC, anon, authenticated;