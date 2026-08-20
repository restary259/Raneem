-- ════════════════════════════════════════════════════════════════════════
-- Fast email→UUID lookup in auth.users for edge functions.
--
-- resolveIdentity() (supabase/functions/_shared/identity.ts) previously fell
-- back to a full listUsers() paginated scan (up to 10,000 users, 10 pages)
-- when no profile row exists. That scan can time out or miss a newly-created
-- user, causing accept-invitation / create-team-member / agent-create-account
-- to attempt createUser() on an already-registered email → "Database error
-- checking email".
--
-- This SECURITY DEFINER RPC reads auth.users (outside the API-exposed public
-- schema) and returns the UUID for a given email via the auth.users email
-- index. SECURITY DEFINER is required because auth.users is not readable by
-- service_role directly through PostgREST.
--
-- GRANT: service_role only — edge functions use the service-role key. No
-- authenticated or anon access, so this cannot become an email-enumeration
-- oracle for clients.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT id
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_email(text) TO service_role;
