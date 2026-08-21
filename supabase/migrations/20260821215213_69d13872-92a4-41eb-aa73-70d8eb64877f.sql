REVOKE ALL ON FUNCTION public.clear_must_change_password() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_must_change_password() TO service_role;