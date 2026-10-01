-- ============================================================================
-- PHASE 4 DEPLOY VERIFICATION — Primary + Side Manager Delegation
-- ============================================================================
-- READ-ONLY. Run this in the Supabase SQL editor (or psql) AFTER applying:
--
--   1. supabase/migrations/20261001160000_office_google_permission_foundation.sql
--   2. supabase/migrations/20261001170000_office_google_location_mapping.sql
--   3. supabase/migrations/20261001180000_office_google_delegation.sql
--
-- Asserts the Phase 4 delegation layer landed and the security posture holds:
--   * the authorizer knows the Phase 4 actions and treats them correctly
--   * remove_google_operator authorizes SIDE_MANAGER removal with the dedicated
--     GOOGLE_REMOVE_SIDE_MANAGER action (not the assignment action)
--   * operator changes notify the affected member
--   * a deferrable transfer guard protects against orphaned offices
--   * list_my_google_offices is SECURITY DEFINER, pinned, authenticated-only
--   * anonymous cannot execute any operator RPC
--
-- Nothing here writes data. It runs in a transaction and ROLLBACKs.
--
-- Output: ONE result set. Every row must read ok = true and summary must read
-- ALL CHECKS PASSED. A FAIL row names the missing/misconfigured object.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE _p4_deploy (id serial, kind text, name text, ok boolean, detail text) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp._chk(p_kind text, p_name text, p_ok boolean, p_detail text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO _p4_deploy(kind, name, ok, detail) VALUES (p_kind, p_name, COALESCE(p_ok, false), p_detail);
$$;

CREATE OR REPLACE FUNCTION pg_temp._fn_oid(p_sig text)
RETURNS oid LANGUAGE sql STABLE AS $$ SELECT to_regprocedure('public.' || p_sig); $$;

DO $verify$
DECLARE
  r record;
  v_src text;
BEGIN
  --------------------------------------------------------------------------
  -- 1. Functions exist with the exact signatures the app calls
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'authorize_google_office_action(uuid,uuid,text)',
    'admin_assign_google_primary(uuid,uuid)',
    'assign_google_side_manager(uuid,uuid)',
    'remove_google_operator(uuid,text)',
    'list_my_google_offices()',
    'list_office_google_operator_candidates(uuid)',
    'get_office_google_mapping(uuid)',
    'notify_google_operator_event()',
    'guard_google_operator_transfer()',
    'notification_category_for_source(text)'
  ]) AS sig
  LOOP
    PERFORM pg_temp._chk('function', r.sig, pg_temp._fn_oid(r.sig) IS NOT NULL);
  END LOOP;

  -- get_office_google_mapping exposes the operator-active flags the UI needs.
  PERFORM pg_temp._chk('column', 'get_office_google_mapping returns primary_is_active',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public' AND p.proname='get_office_google_mapping'
              AND pg_get_function_result(p.oid) LIKE '%primary_is_active%'));
  PERFORM pg_temp._chk('column', 'get_office_google_mapping returns side_manager_is_active',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public' AND p.proname='get_office_google_mapping'
              AND pg_get_function_result(p.oid) LIKE '%side_manager_is_active%'));

  --------------------------------------------------------------------------
  -- 2. Authorizer is the Phase 4 definition
  --------------------------------------------------------------------------
  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='authorize_google_office_action' LIMIT 1;
  PERFORM pg_temp._chk('authorizer', 'knows GOOGLE_MANAGE_SUPPORTED_CONTENT',
    v_src LIKE '%GOOGLE_MANAGE_SUPPORTED_CONTENT%');
  PERFORM pg_temp._chk('authorizer', 'knows GOOGLE_REMOVE_SIDE_MANAGER',
    v_src LIKE '%GOOGLE_REMOVE_SIDE_MANAGER%');
  PERFORM pg_temp._chk('authorizer', 'delegation gated on PRIMARY',
    v_src LIKE '%GOOGLE_ASSIGN_SIDE_MANAGER%' AND v_src LIKE '%PRIMARY%');
  PERFORM pg_temp._chk('authorizer', 'admin-only connection controls present',
    v_src LIKE '%GOOGLE_CONNECT%' AND v_src LIKE '%GOOGLE_DISCONNECT%');

  -- remove_google_operator must use the dedicated removal action.
  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='remove_google_operator' LIMIT 1;
  PERFORM pg_temp._chk('authorizer', 'remove_google_operator uses GOOGLE_REMOVE_SIDE_MANAGER',
    v_src LIKE '%GOOGLE_REMOVE_SIDE_MANAGER%');

  --------------------------------------------------------------------------
  -- 3. Triggers
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('trigger', 'notify_google_operator_event installed',
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_notify_google_operator_event' AND NOT tgisinternal));
  PERFORM pg_temp._chk('trigger', 'transfer guard installed',
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_guard_google_operator_transfer' AND NOT tgisinternal));
  PERFORM pg_temp._chk('trigger', 'transfer guard is deferrable initially deferred',
    EXISTS (SELECT 1 FROM pg_trigger
            WHERE tgname='trg_guard_google_operator_transfer'
              AND tgdeferrable AND tginitdeferred));

  --------------------------------------------------------------------------
  -- 4. Notification wiring
  --------------------------------------------------------------------------
  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='notification_category_for_source' LIMIT 1;
  PERFORM pg_temp._chk('notify', 'google_business source is mapped',
    v_src LIKE '%google_business%');

  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='notify_google_operator_event' LIMIT 1;
  PERFORM pg_temp._chk('notify', 'operator trigger emits notifications',
    v_src LIKE '%emit_notification%');

  --------------------------------------------------------------------------
  -- 5. SECURITY DEFINER + pinned search_path
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'authorize_google_office_action','remove_google_operator',
    'list_my_google_offices','notify_google_operator_event',
    'guard_google_operator_transfer']) AS fname
  LOOP
    PERFORM pg_temp._chk('security', r.fname || ' is SECURITY DEFINER',
      (SELECT p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname=r.fname LIMIT 1));
    PERFORM pg_temp._chk('security', r.fname || ' pins search_path',
      (SELECT COALESCE(array_to_string(p.proconfig, ','), '') LIKE '%search_path=%'
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname=r.fname LIMIT 1));
  END LOOP;

  --------------------------------------------------------------------------
  -- 6. Grants — authenticated yes, anon no
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'remove_google_operator(uuid,text)',
    'assign_google_side_manager(uuid,uuid)',
    'admin_assign_google_primary(uuid,uuid)',
    'list_my_google_offices()',
    'authorize_google_office_action(uuid,uuid,text)',
    'list_office_google_operator_candidates(uuid)',
    'get_office_google_mapping(uuid)'
  ]) AS sig
  LOOP
    PERFORM pg_temp._chk('grant', 'authenticated can EXECUTE ' || r.sig,
      COALESCE(has_function_privilege('authenticated', pg_temp._fn_oid(r.sig), 'EXECUTE'), false));
    PERFORM pg_temp._chk('grant', 'anon CANNOT EXECUTE ' || r.sig,
      NOT COALESCE(has_function_privilege('anon', pg_temp._fn_oid(r.sig), 'EXECUTE'), false));
  END LOOP;

  --------------------------------------------------------------------------
  -- 7. Live permission gate (non-destructive)
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('behavior', 'authorize() denies a null user',
    public.authorize_google_office_action(NULL, gen_random_uuid(), 'GOOGLE_VIEW') = false);
  PERFORM pg_temp._chk('behavior', 'authorize() denies a null office',
    public.authorize_google_office_action(auth.uid(), NULL, 'GOOGLE_VIEW') = false);
  PERFORM pg_temp._chk('behavior', 'authorize() denies an unknown action',
    public.authorize_google_office_action(auth.uid(), gen_random_uuid(), 'GOOGLE_NOPE') = false);
  PERFORM pg_temp._chk('behavior', 'authorize() denies a forged user id',
    public.authorize_google_office_action(gen_random_uuid(), gen_random_uuid(), 'GOOGLE_VIEW') = false);
END
$verify$;

-- ============================================================================
-- REPORT — exactly one result set
-- ============================================================================
SELECT kind, name, ok, detail FROM _p4_deploy WHERE NOT ok ORDER BY kind, name;

SELECT
  count(*) FILTER (WHERE ok)     AS passed,
  count(*)                       AS total,
  count(*) FILTER (WHERE NOT ok) AS failed,
  CASE WHEN count(*) FILTER (WHERE NOT ok) = 0
       THEN 'ALL CHECKS PASSED' ELSE 'FAILURES ABOVE — do not proceed' END AS summary
FROM _p4_deploy;

ROLLBACK;
