ALTER FUNCTION public.save_case_intel_intake(uuid, jsonb) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.save_case_intel_intake(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_case_intel_intake(uuid, jsonb) TO authenticated, service_role;