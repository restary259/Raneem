-- Internal helpers must not be callable by anonymous (not signed-in) visitors.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_my_pending_applications() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_pending_applications() TO authenticated, service_role;

-- Trigger-only routine: never called directly by a client.
REVOKE EXECUTE ON FUNCTION public.reconcile_staff_invitations() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_staff_invitations() TO service_role;
