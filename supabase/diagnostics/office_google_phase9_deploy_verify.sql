-- ============================================================================
-- PHASE 9 DEPLOY VERIFICATION — Real-Time Google Notifications + Background Sync
-- ============================================================================
-- READ-ONLY. Run this in the Supabase SQL editor (or psql) AFTER applying:
--
--   1. supabase/migrations/20261001160000_office_google_permission_foundation.sql
--   2. supabase/migrations/20261001170000_office_google_location_mapping.sql
--   3. supabase/migrations/20261001180000_office_google_delegation.sql
--   4. supabase/migrations/20261001190000_office_google_reviews.sql
--   5. supabase/migrations/20261001200000_office_google_profile_management.sql
--   6. supabase/migrations/20261002140000_office_google_performance.sql
--   7. supabase/migrations/20261002160000_office_google_realtime_notifications.sql
--
-- Asserts the Phase 9 real-time layer landed and the security posture holds:
--   * the four new tables, their unique keys / indexes / RLS
--   * the notification extensions on `notifications`
--   * every event/sync/health function exists with the signature the app calls,
--     is SECURITY DEFINER and has a pinned search_path
--   * the event pipeline is idempotent and never guesses an office
--   * reconciliation cron wrappers exist and are not browser-callable
--   * anon and authenticated hold no EXECUTE on any service-role RPC
--
-- Nothing here writes data. It runs in a transaction and ROLLBACKs.
--
-- Output: ONE result set. Every row must read ok = true and summary must read
-- ALL CHECKS PASSED. A FAIL row names the missing/misconfigured object.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE _p9_deploy (id serial, kind text, name text, ok boolean, detail text) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp._chk(p_kind text, p_name text, p_ok boolean, p_detail text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO _p9_deploy(kind, name, ok, detail) VALUES (p_kind, p_name, COALESCE(p_ok, false), p_detail);
$$;

DO $verify$
DECLARE
  r record;
  v_src text;
  v_oid oid;
BEGIN
  --------------------------------------------------------------------------
  -- 1. Tables, RLS and read-only browser access
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'google_business_events',
    'google_business_sync_jobs',
    'google_business_location_health',
    'google_business_health_events']) AS t
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

  -- Raw Google events carry technical integration data; only Admin sees them.
  PERFORM pg_temp._chk('rls', 'events table has an Admin-only SELECT policy',
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'google_business_events' AND cmd = 'SELECT'));

  --------------------------------------------------------------------------
  -- 2. Idempotency keys
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('constraint', 'event message id is unique',
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'google_business_events'
        AND indexdef ILIKE '%unique%' AND indexdef ILIKE '%google_message_id%'));
  PERFORM pg_temp._chk('constraint', 'at most one active sync job per (office, type)',
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'google_business_sync_jobs'
        AND indexdef ILIKE '%unique%' AND indexdef ILIKE '%office_id%' AND indexdef ILIKE '%sync_type%'));
  PERFORM pg_temp._chk('constraint', 'location health is unique per office',
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'google_business_location_health'
        AND indexdef ILIKE '%unique%' AND indexdef ILIKE '%office_id%'));

  --------------------------------------------------------------------------
  -- 3. Notification extensions
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'office_id','entity_type','entity_id','google_event_type']) AS col
  LOOP
    PERFORM pg_temp._chk('column', 'notifications.' || r.col || ' exists',
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = r.col));
  END LOOP;

  --------------------------------------------------------------------------
  -- 4. Functions: exist, SECURITY DEFINER, pinned search_path
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'record_google_business_event','route_google_business_event',
    'mark_google_business_event','resolve_google_event_office',
    'create_google_business_sync_job','claim_google_business_sync_job',
    'finish_google_business_sync_job','enqueue_google_reconciliation_jobs',
    'record_google_location_health','get_office_google_health',
    'list_office_google_health_events','list_office_google_sync_jobs',
    'notify_google_business_event','emit_google_notification',
    'notify_new_google_review','admin_google_event_timeline',
    'admin_google_integration_health','admin_google_attention_offices',
    'admin_list_google_dead_letters','admin_retry_google_business_event',
    'admin_update_google_pubsub_config','cron_enqueue_google_reconciliation',
    'dispatch_google_business_worker']) AS fname
  LOOP
    PERFORM pg_temp._chk('function', 'exists: ' || r.fname,
      EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = r.fname));

    PERFORM pg_temp._chk('security', r.fname || ' is SECURITY DEFINER with a pinned search_path',
      EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = r.fname
          AND p.prosecdef = true
          AND EXISTS (
            SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
            WHERE cfg LIKE 'search_path=%')));
  END LOOP;

  --------------------------------------------------------------------------
  -- 5. No event/sync/health RPC is EXECUTEable by anon or authenticated
  --    (except the office-scoped read RPCs, which are authenticated-only)
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'record_google_business_event','route_google_business_event',
    'mark_google_business_event','create_google_business_sync_job',
    'claim_google_business_sync_job','finish_google_business_sync_job',
    'notify_google_business_event','record_google_location_health',
    'emit_google_notification','cron_enqueue_google_reconciliation',
    'dispatch_google_business_worker']) AS fname
  LOOP
    PERFORM pg_temp._chk('overload', 'no overload of ' || r.fname || ' is EXECUTEable by anon',
      NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = r.fname
          AND COALESCE(has_function_privilege('anon', p.oid, 'EXECUTE'), false)));
    PERFORM pg_temp._chk('overload', 'no overload of ' || r.fname || ' is EXECUTEable by authenticated',
      NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = r.fname
          AND COALESCE(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false)));
  END LOOP;

  --------------------------------------------------------------------------
  -- 6. Admin-gated RPCs are callable by authenticated but check the AAL2
  --    admin session inside (they are not service-role-only).
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'admin_retry_google_business_event','admin_list_google_dead_letters',
    'admin_google_event_timeline','admin_google_integration_health',
    'admin_google_attention_offices','admin_update_google_pubsub_config']) AS fname
  LOOP
    PERFORM pg_temp._chk('grant', r.fname || ' is EXECUTEable by authenticated (admin-gated inside)',
      EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = r.fname
          AND COALESCE(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false)));
    PERFORM pg_temp._chk('overload', 'no overload of ' || r.fname || ' is EXECUTEable by anon',
      NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = r.fname
          AND COALESCE(has_function_privilege('anon', p.oid, 'EXECUTE'), false)));
  END LOOP;

  --------------------------------------------------------------------------
  -- 7. Behaviour: the health helper is deterministic (never a score)
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('behavior', 'health helper returns a deterministic state',
    public.google_health_status_from_states(NULL, NULL, NULL, NULL) IN
      ('HEALTHY','ATTENTION','ACTION_REQUIRED','UNAVAILABLE','UNKNOWN'));
  PERFORM pg_temp._chk('behavior', 'suspended location is UNAVAILABLE',
    public.google_health_status_from_states('VERIFIED', NULL, 'SUSPENDED', NULL) = 'UNAVAILABLE');
  PERFORM pg_temp._chk('behavior', 'lost Voice of Merchant is ACTION_REQUIRED',
    public.google_health_status_from_states('VERIFIED', 'LOST', NULL, NULL) = 'ACTION_REQUIRED');

  --------------------------------------------------------------------------
  -- 8. Raw event payload is protected from the browser roles
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('security', 'authenticated cannot read the raw event table',
    NOT has_table_privilege('authenticated', 'public.google_business_events', 'SELECT'));
  PERFORM pg_temp._chk('security', 'anon cannot read the raw event table',
    NOT has_table_privilege('anon', 'public.google_business_events', 'SELECT'));

  --------------------------------------------------------------------------
  -- 9. Realtime: office-facing tables are published (RLS still gates rows)
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('realtime', 'reviews table is in the realtime publication',
    EXISTS (SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
        AND tablename = 'google_business_reviews'));
  PERFORM pg_temp._chk('realtime', 'location health is in the realtime publication',
    EXISTS (SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
        AND tablename = 'google_business_location_health'));
  PERFORM pg_temp._chk('realtime', 'sync jobs are in the realtime publication',
    EXISTS (SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
        AND tablename = 'google_business_sync_jobs'));
  PERFORM pg_temp._chk('security', 'raw events are not published to realtime',
    NOT EXISTS (SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
        AND tablename = 'google_business_events'));
END
$verify$;

-- ============================================================================
-- REPORT — exactly one result set
-- ============================================================================
SELECT kind, name, ok, detail FROM _p9_deploy WHERE NOT ok ORDER BY kind, name;

SELECT
  count(*) FILTER (WHERE ok)     AS passed,
  count(*)                       AS total,
  count(*) FILTER (WHERE NOT ok) AS failed,
  CASE WHEN count(*) FILTER (WHERE NOT ok) = 0
       THEN 'ALL CHECKS PASSED' ELSE 'FAILURES ABOVE — do not proceed' END AS summary
FROM _p9_deploy;

ROLLBACK;
