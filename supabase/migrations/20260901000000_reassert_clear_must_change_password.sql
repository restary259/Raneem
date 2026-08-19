-- ============================================================================
-- Guard rail: re-assert public.clear_must_change_password().
--
-- restrict_profiles_write() (latest definition in
-- 20260827000000_apply_form_enabled_flag.sql) rejects any NON-admin direct
-- write to profiles.must_change_password. The sanctioned client path is this
-- SECURITY DEFINER RPC, which bypasses the trigger and only touches the
-- caller's own row via auth.uid() — so it works for admins and non-admins.
--
-- This file intentionally repeats the definition from
-- 20260809165936_ebdf055c-e405-4fd2-afce-9a1ba3f88216.sql verbatim: as the
-- latest-timestamped migration touching the function, it guarantees the RPC
-- still exists even if an older migration is re-run out of order and drops it
-- while the trigger stays strict.
--
-- Deliberate scope: only the RPC is re-asserted here, not
-- restrict_profiles_write(). An out-of-order re-run could still overwrite the
-- trigger, but duplicating its full ~120-line body would create a two-copies
-- drift hazard; the trigger's latest definition stays owned by
-- 20260827000000_apply_form_enabled_flag.sql.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.clear_must_change_password()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.profiles
  SET must_change_password = false
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.clear_must_change_password() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_must_change_password() TO authenticated;
