REVOKE ALL ON FUNCTION public.set_case_services(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_adjust_case_service(uuid, numeric, numeric, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_case_services_write() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bump_service_catalog_version() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_case_services(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_case_service(uuid, numeric, numeric, numeric, text) TO authenticated;