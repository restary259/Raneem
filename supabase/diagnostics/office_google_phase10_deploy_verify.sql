-- ============================================================================
-- PHASE 10 DEPLOY VERIFICATION — Security, E2E, production hardening
-- ============================================================================
-- READ-ONLY. Run this in the Supabase SQL editor (or psql) AFTER applying:
--
--   1..7  the Phase 1-9 Office Google migrations
--   8.    supabase/migrations/20261002180000_office_google_production_hardening.sql
--
-- Asserts the Phase 10 production controls landed and the earlier security
-- posture was not regressed by the redefinitions:
--   * the settings/switch tables, their RLS and their write-lockdown
--   * the kill-switch resolvers and the authorizer gate
--   * stale-job recovery + its service-role-only grant
--   * the integrity/readiness audit functions
--   * append-only activity table
--   * the redefined Phase 9 functions still carry their contracts
--
-- Nothing here writes data. It runs in a transaction and ROLLBACKs.
--
-- Output: ONE result set. Every row must read ok = true and summary must read
-- ALL CHECKS PASSED. A FAIL row names the missing/misconfigured object.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE _p10_deploy (id serial, kind text, name text, ok boolean, detail text) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp._chk(p_kind text, p_name text, p_ok boolean, p_detail text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO _p10_deploy(kind, name, ok, detail) VALUES (p_kind, p_name, COALESCE(p_ok, false), p_detail);
$$;

DO $verify$
DECLARE
  r record;
BEGIN
  --------------------------------------------------------------------------
  -- 1. Kill-switch tables: exist, RLS on, browser write-locked
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'google_business_settings',
    'office_google_settings']) AS t
  LOOP
    PERFORM pg_temp._chk('table', 'exists: ' || r.t, to_regclass('public.' || r.t) IS NOT NULL);
    PERFORM pg_temp._chk('rls', 'RLS enabled: ' || r.t,
      COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.' || r.t)), false));
    PERFORM pg_temp._chk('grant', 'anon CANNOT SELECT ' || r.t,
      NOT has_table_privilege('anon', 'public.' || r.t, 'SELECT'));
    PERFORM pg_temp._chk('grant', 'authenticated CANNOT INSERT ' || r.t,
      NOT has_table_privilege('authenticated', 'public.' || r.t, 'INSERT'));
    PERFORM pg_temp._chk('grant', 'authenticated CANNOT UPDATE ' || r.t,
      NOT has_table_privilege('authenticated', 'public.' || r.t, 'UPDATE'));
    PERFORM pg_temp._chk('grant', 'authenticated CANNOT DELETE ' || r.t,
      NOT has_table_privilege('authenticated', 'public.' || r.t, 'DELETE'));
  END LOOP;

  -- The single global row must exist so the getter is deterministic.
  PERFORM pg_temp._chk('data', 'one global settings row exists',
    (SELECT count(*) FROM public.google_business_settings WHERE google_connection_id IS NULL) = 1);
  PERFORM pg_temp._chk('constraint', 'settings is unique per connection',
    EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='google_business_settings'
      AND indexdef ILIKE '%unique%' AND indexdef ILIKE '%google_connection_id%'));
  PERFORM pg_temp._chk('constraint', 'office settings is unique per office',
    EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='office_google_settings'
      AND indexdef ILIKE '%unique%' AND indexdef ILIKE '%office_id%'));

  --------------------------------------------------------------------------
  -- 2. Functions: exist, SECURITY DEFINER, pinned search_path
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'get_google_business_settings','google_business_operation_allowed',
    'google_business_action_kind','admin_get_google_business_settings',
    'admin_set_google_business_settings','recover_stale_google_sync_jobs',
    'cron_recover_stale_google_sync_jobs','audit_google_business_integrity',
    'audit_office_google_integrity']) AS fname
  LOOP
    PERFORM pg_temp._chk('function', 'exists: ' || r.fname,
      EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = r.fname));

    PERFORM pg_temp._chk('security', r.fname || ' is SECURITY DEFINER (or IMMUTABLE helper) with a pinned search_path',
      EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = r.fname
          AND (p.prosecdef = true OR r.fname = 'google_business_action_kind')
          AND (EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
                       WHERE cfg LIKE 'search_path=%')
               OR r.fname = 'google_business_action_kind')));
  END LOOP;

  --------------------------------------------------------------------------
  -- 3. Kill-switch grants
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('grant', 'get_google_business_settings is executable by authenticated',
    has_function_privilege('authenticated','public.get_google_business_settings(uuid)','EXECUTE'));
  PERFORM pg_temp._chk('grant', 'operation gate is executable by authenticated',
    has_function_privilege('authenticated','public.google_business_operation_allowed(uuid,text)','EXECUTE'));
  PERFORM pg_temp._chk('grant', 'admin settings writer revoked from anon',
    NOT has_function_privilege('anon',
      'public.admin_set_google_business_settings(boolean,boolean,boolean,uuid,boolean,boolean,boolean,text)','EXECUTE'));
  PERFORM pg_temp._chk('grant', 'stale recovery revoked from authenticated',
    NOT has_function_privilege('authenticated','public.recover_stale_google_sync_jobs(interval)','EXECUTE'));
  PERFORM pg_temp._chk('grant', 'stale recovery is executable by service_role',
    has_function_privilege('service_role','public.recover_stale_google_sync_jobs(interval)','EXECUTE'));
  PERFORM pg_temp._chk('grant', 'integrity audit revoked from anon',
    NOT has_function_privilege('anon','public.audit_google_business_integrity()','EXECUTE'));

  --------------------------------------------------------------------------
  -- 4. Redefined Phase 9 contracts survived
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('contract', 'authorize_google_office_action is still SECURITY DEFINER',
    (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.authorize_google_office_action(uuid,uuid,text)')));
  PERFORM pg_temp._chk('contract', 'claim_google_business_sync_job still returns trigger_event_type',
    EXISTS (
      SELECT 1 FROM pg_proc p
      WHERE p.oid = to_regprocedure('public.claim_google_business_sync_job(uuid,text[])')
        AND pg_get_function_result(p.oid) ILIKE '%trigger_event_type%'));
  PERFORM pg_temp._chk('contract', 'claim_google_business_sync_job is service-role only',
    NOT has_function_privilege('authenticated','public.claim_google_business_sync_job(uuid,text[])','EXECUTE'));
  PERFORM pg_temp._chk('contract', 'route_google_business_event is service-role only',
    NOT has_function_privilege('authenticated','public.route_google_business_event(uuid)','EXECUTE'));
  PERFORM pg_temp._chk('contract', 'finish_google_business_sync_job reports finalization state',
    EXISTS (
      SELECT 1 FROM pg_proc p
      WHERE p.oid = to_regprocedure('public.finish_google_business_sync_job(uuid,text,text,integer,text,text)')
        AND pg_get_function_result(p.oid) ILIKE '%will_retry%'));

  --------------------------------------------------------------------------
  -- 5. Append-only audit + service-role worker surface
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('appendonly', 'authenticated cannot UPDATE google_business_activity',
    NOT has_table_privilege('authenticated','public.google_business_activity','UPDATE'));
  PERFORM pg_temp._chk('appendonly', 'authenticated cannot DELETE google_business_activity',
    NOT has_table_privilege('authenticated','public.google_business_activity','DELETE'));
  PERFORM pg_temp._chk('appendonly', 'authenticated cannot INSERT google_business_activity',
    NOT has_table_privilege('authenticated','public.google_business_activity','INSERT'));

  --------------------------------------------------------------------------
  -- 6. Stale-job recovery cron wrapper (the schedule itself is armed by the
  --    migration; the offline harness has a stub cron schema, so we assert the
  --    wrapper the schedule calls).
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('cron', 'stale-job recovery cron wrapper exists',
    to_regprocedure('public.cron_recover_stale_google_sync_jobs()') IS NOT NULL);
  PERFORM pg_temp._chk('cron', 'stale-job recovery cron wrapper is not browser-callable',
    NOT has_function_privilege('authenticated','public.cron_recover_stale_google_sync_jobs()','EXECUTE'));
END
$verify$;

-- ============================================================================
-- REPORT — exactly one result set
-- ============================================================================
SELECT kind, name, ok, detail FROM _p10_deploy WHERE NOT ok ORDER BY kind, name;

SELECT
  count(*) FILTER (WHERE ok)     AS passed,
  count(*)                       AS total,
  count(*) FILTER (WHERE NOT ok) AS failed,
  CASE WHEN count(*) FILTER (WHERE NOT ok) = 0
       THEN 'ALL CHECKS PASSED' ELSE 'FAILURES ABOVE — do not proceed' END AS summary
FROM _p10_deploy;

ROLLBACK;
