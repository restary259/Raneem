REVOKE ALL ON FUNCTION public.whatsapp_drain_pending_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_drain_pending_status() TO service_role;