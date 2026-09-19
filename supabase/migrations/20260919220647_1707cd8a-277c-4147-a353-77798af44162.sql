REVOKE ALL ON FUNCTION public.is_whatsapp_staff(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_whatsapp_staff(uuid) TO service_role;