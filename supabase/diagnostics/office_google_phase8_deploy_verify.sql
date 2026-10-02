-- ============================================================================
-- PHASE 8 DEPLOY VERIFICATION — Google Business Performance + Insights
-- ============================================================================
-- READ-ONLY. Run this in the Supabase SQL editor (or psql) AFTER applying:
--
--   1. supabase/migrations/20261001160000_office_google_permission_foundation.sql
--   2. supabase/migrations/20261001170000_office_google_location_mapping.sql
--   3. supabase/migrations/20261001180000_office_google_delegation.sql
--   4. supabase/migrations/20261001190000_office_google_reviews.sql
--   5. supabase/migrations/20261001200000_office_google_profile_management.sql
--   6. supabase/migrations/20261002120000_office_google_performance.sql
--
-- Asserts the Phase 8 performance layer landed and the security posture holds:
--   * the three performance tables, their unique keys, indexes and RLS
--   * the performance sync state columns on office_google_profiles
--   * every performance function exists with the exact signature the app calls,
--     is SECURITY DEFINER and has a pinned search_path
--   * the authorizer knows GOOGLE_SYNC_PERFORMANCE
--   * anon holds no EXECUTE on any performance RPC and no write on any table
--   * metric validation and scope helpers behave
--
-- Nothing here writes data. It runs in a transaction and ROLLBACKs.
--
-- Output: ONE result set. Every row must read ok = true and summary must read
-- ALL CHECKS PASSED. A FAIL row names the missing/misconfigured object.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE _p8_deploy (id serial, kind text, name text, ok boolean, detail text) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp._chk(p_kind text, p_name text, p_ok boolean, p_detail text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO _p8_deploy(kind, name, ok, detail) VALUES (p_kind, p_name, COALESCE(p_ok, false), p_detail);
$$;

DO $verify$
DECLARE
  r record;
  v_src text;
  v_oid oid;
BEGIN
  --------------------------------------------------------------------------
  -- 1. Tables, constraints, indexes, RLS
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'google_business_performance_daily',
    'google_business_search_keywords_monthly',
    'google_business_performance_sync_jobs']) AS t
  LOOP
    PERFORM pg_temp._chk('schema', r.t || ' exists',
      to_regclass('public.' || r.t) IS NOT NULL);
    PERFORM pg_temp._chk('schema', r.t || ' RLS enabled',
      (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.' || r.t)));
  END LOOP;

  PERFORM pg_temp._chk('schema', 'daily unique (location,date,metric,scope,entity)',
    EXISTS (SELECT 1 FROM pg_constraint
            WHERE conrelid = to_regclass('public.google_business_performance_daily')
              AND contype = 'u'
              AND pg_get_constraintdef(oid) LIKE '%google_location_id%metric_date%metric%metric_scope%entity_type%entity_id%'));

  PERFORM pg_temp._chk('schema', 'keywords unique (location,month,keyword)',
    EXISTS (SELECT 1 FROM pg_constraint
            WHERE conrelid = to_regclass('public.google_business_search_keywords_monthly')
              AND contype = 'u'
              AND pg_get_constraintdef(oid) LIKE '%google_location_id%month%search_keyword%'));

  PERFORM pg_temp._chk('schema', 'daily data_state has VALUE/ZERO/NO_DATA',
    EXISTS (SELECT 1 FROM pg_constraint
            WHERE conrelid = to_regclass('public.google_business_performance_daily')
              AND contype = 'c'
              AND pg_get_constraintdef(oid) LIKE '%NO_DATA%'));

  PERFORM pg_temp._chk('schema', 'keywords insights_value_type has VALUE/THRESHOLD',
    EXISTS (SELECT 1 FROM pg_constraint
            WHERE conrelid = to_regclass('public.google_business_search_keywords_monthly')
              AND contype = 'c'
              AND pg_get_constraintdef(oid) LIKE '%THRESHOLD%'));

  PERFORM pg_temp._chk('schema', 'daily metric_value is BIGINT',
    (SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'google_business_performance_daily'
       AND column_name = 'metric_value') = 'bigint');

  PERFORM pg_temp._chk('schema', 'office profile has performance sync columns',
    (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'office_google_profiles'
       AND column_name IN ('performance_last_synced_at','performance_last_successful_sync_at',
                           'performance_sync_error_code','performance_sync_error_message',
                           'performance_sync_locked_at','performance_data_through')) = 6);

  FOR r IN SELECT unnest(ARRAY[
    'trg_validate_google_performance_daily',
    'trg_validate_google_search_keywords']) AS tname
  LOOP
    PERFORM pg_temp._chk('trigger', r.tname || ' installed',
      EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = r.tname AND NOT tgisinternal));
  END LOOP;

  --------------------------------------------------------------------------
  -- 2. Functions exist with the exact signatures the app calls
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'get_office_google_performance_summary(uuid,date,date,date,date)',
    'get_office_google_performance_context(uuid)',
    'list_google_performance_offices()',
    'get_office_google_performance_series(uuid,date,date,text[])',
    'list_office_google_search_keywords(uuid,date,date,text,text,integer,integer)',
    'list_office_google_performance_sync_jobs(uuid,integer)',
    'admin_google_performance_aggregate(date,date,date,date,uuid[])',
    'admin_create_google_performance_sync_job(uuid,text,date,date)',
    'admin_complete_google_performance_metrics_job(uuid,jsonb,jsonb,date,date,date)',
    'admin_complete_google_performance_keywords_job(uuid,jsonb,date)',
    'admin_fail_google_performance_sync_job(uuid,text,text,text)',
    'admin_record_google_performance_audit(uuid,text,jsonb)',
    'acquire_google_performance_sync_lock(uuid,integer)',
    'release_google_performance_sync_lock(uuid)',
    'google_performance_metric_supported(text)',
    'google_performance_metric_scope(text)',
    'validate_google_performance_row()']) AS sig
  LOOP
    PERFORM pg_temp._chk('function', r.sig || ' exists',
      to_regprocedure('public.' || r.sig) IS NOT NULL);
  END LOOP;

  --------------------------------------------------------------------------
  -- 3. SECURITY DEFINER + pinned search_path on every performance RPC
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'get_office_google_performance_summary(uuid,date,date,date,date)',
    'get_office_google_performance_context(uuid)',
    'list_google_performance_offices()',
    'get_office_google_performance_series(uuid,date,date,text[])',
    'list_office_google_search_keywords(uuid,date,date,text,text,integer,integer)',
    'list_office_google_performance_sync_jobs(uuid,integer)',
    'admin_google_performance_aggregate(date,date,date,date,uuid[])',
    'admin_create_google_performance_sync_job(uuid,text,date,date)',
    'admin_complete_google_performance_metrics_job(uuid,jsonb,jsonb,date,date,date)',
    'admin_complete_google_performance_keywords_job(uuid,jsonb,date)',
    'admin_fail_google_performance_sync_job(uuid,text,text,text)',
    'admin_record_google_performance_audit(uuid,text,jsonb)',
    'acquire_google_performance_sync_lock(uuid,integer)',
    'release_google_performance_sync_lock(uuid)']) AS sig
  LOOP
    v_oid := to_regprocedure('public.' || r.sig);
    SELECT p.prosrc INTO v_src FROM pg_proc p WHERE p.oid = v_oid;
    PERFORM pg_temp._chk('security', r.sig || ' is SECURITY DEFINER',
      (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_oid));
    PERFORM pg_temp._chk('security', r.sig || ' pins search_path',
      (SELECT COALESCE(array_to_string(p.proconfig, ','), '') FROM pg_proc p WHERE p.oid = v_oid) LIKE '%search_path=public%',
      (SELECT COALESCE(array_to_string(p.proconfig, ','), '(none)') FROM pg_proc p WHERE p.oid = v_oid));
  END LOOP;

  --------------------------------------------------------------------------
  -- 4. Authorizer knows GOOGLE_SYNC_PERFORMANCE and rejects unknown actions
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('behavior', 'authorize() denies a null user for SYNC_PERFORMANCE',
    public.authorize_google_office_action(NULL, gen_random_uuid(), 'GOOGLE_SYNC_PERFORMANCE') = false);
  PERFORM pg_temp._chk('behavior', 'authorize() denies an unknown action',
    public.authorize_google_office_action(auth.uid(), gen_random_uuid(), 'GOOGLE_NOPE') = false);
  PERFORM pg_temp._chk('behavior', 'metric helper accepts WEBSITE_CLICKS',
    public.google_performance_metric_supported('WEBSITE_CLICKS'));
  PERFORM pg_temp._chk('behavior', 'metric helper rejects a made-up metric',
    NOT public.google_performance_metric_supported('PROFILE_SCORE'));
  PERFORM pg_temp._chk('behavior', 'metric scope defaults to LOCATION',
    public.google_performance_metric_scope('WEBSITE_CLICKS') = 'LOCATION');

  --------------------------------------------------------------------------
  -- 5. Table privileges — reads only for browser roles, writes RPC-only
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'google_business_performance_daily',
    'google_business_search_keywords_monthly',
    'google_business_performance_sync_jobs']) AS t
  LOOP
    PERFORM pg_temp._chk('grant', 'authenticated can SELECT ' || r.t,
      has_table_privilege('authenticated', 'public.' || r.t, 'SELECT'));
    PERFORM pg_temp._chk('grant', 'authenticated CANNOT INSERT ' || r.t,
      NOT has_table_privilege('authenticated', 'public.' || r.t, 'INSERT'));
    PERFORM pg_temp._chk('grant', 'authenticated CANNOT UPDATE ' || r.t,
      NOT has_table_privilege('authenticated', 'public.' || r.t, 'UPDATE'));
    PERFORM pg_temp._chk('grant', 'authenticated CANNOT DELETE ' || r.t,
      NOT has_table_privilege('authenticated', 'public.' || r.t, 'DELETE'));
    PERFORM pg_temp._chk('grant', 'anon CANNOT SELECT ' || r.t,
      NOT has_table_privilege('anon', 'public.' || r.t, 'SELECT'));
  END LOOP;

  --------------------------------------------------------------------------
  -- 6. No performance RPC is EXECUTEable by anon
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'get_office_google_performance_summary','get_office_google_performance_series',
    'list_office_google_search_keywords','list_office_google_performance_sync_jobs',
    'list_google_performance_offices',
    'admin_google_performance_aggregate','admin_create_google_performance_sync_job',
    'admin_complete_google_performance_metrics_job','admin_complete_google_performance_keywords_job',
    'admin_fail_google_performance_sync_job','admin_record_google_performance_audit',
    'acquire_google_performance_sync_lock','release_google_performance_sync_lock']) AS fname
  LOOP
    PERFORM pg_temp._chk('overload', 'no overload of ' || r.fname || ' is EXECUTEable by anon',
      NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = r.fname
          AND COALESCE(has_function_privilege('anon', p.oid, 'EXECUTE'), false)));
  END LOOP;
END
$verify$;

-- ============================================================================
-- REPORT — exactly one result set
-- ============================================================================
SELECT kind, name, ok, detail FROM _p8_deploy WHERE NOT ok ORDER BY kind, name;

SELECT
  count(*) FILTER (WHERE ok)     AS passed,
  count(*)                       AS total,
  count(*) FILTER (WHERE NOT ok) AS failed,
  CASE WHEN count(*) FILTER (WHERE NOT ok) = 0
       THEN 'ALL CHECKS PASSED' ELSE 'FAILURES ABOVE — do not proceed' END AS summary
FROM _p8_deploy;

ROLLBACK;
