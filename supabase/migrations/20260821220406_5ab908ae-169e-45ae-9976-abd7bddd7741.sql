CREATE OR REPLACE FUNCTION public.assert_password_change_security_contract()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_trigger_exists boolean;
BEGIN
  IF has_function_privilege('authenticated', 'public.clear_must_change_password()', 'EXECUTE') THEN
    RAISE EXCEPTION 'PASSWORD_SECURITY_CONTRACT: authenticated must not execute clear_must_change_password';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles'
      AND t.tgname = 'restrict_profiles_write'
      AND p.proname = 'restrict_profiles_write'
      AND NOT t.tgisinternal
  ) INTO v_trigger_exists;

  IF NOT v_trigger_exists THEN
    RAISE EXCEPTION 'PASSWORD_SECURITY_CONTRACT: restrict_profiles_write trigger is missing';
  END IF;

  IF position(
    'NEW.must_change_password IS DISTINCT FROM OLD.must_change_password'
    IN pg_get_functiondef('public.restrict_profiles_write()'::regprocedure)
  ) = 0 THEN
    RAISE EXCEPTION 'PASSWORD_SECURITY_CONTRACT: must_change_password trigger guard is missing';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_password_change_security_contract() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_password_change_security_contract() TO service_role;

SELECT public.assert_password_change_security_contract();