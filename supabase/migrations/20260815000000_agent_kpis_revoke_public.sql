-- Revoke default PUBLIC execute on get_my_agent_kpis.
-- PostgreSQL grants EXECUTE to PUBLIC by default; the original migration
-- only revoked from anon, leaving the PUBLIC privilege in place.
-- This migration closes that gap regardless of whether the original
-- 20260814230457 migration has already been applied.

REVOKE ALL ON FUNCTION public.get_my_agent_kpis() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_agent_kpis() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_agent_kpis() TO authenticated;
