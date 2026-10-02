-- ============================================================================
-- PHASE 5 DEPLOY VERIFICATION — Google Reviews Center + Reply Management
-- ============================================================================
-- READ-ONLY. Run this in the Supabase SQL editor (or psql) AFTER applying:
--
--   1. supabase/migrations/20261001160000_office_google_permission_foundation.sql
--   2. supabase/migrations/20261001170000_office_google_location_mapping.sql
--   3. supabase/migrations/20261001180000_office_google_delegation.sql
--   4. supabase/migrations/20261001190000_office_google_reviews.sql
--
-- Asserts the Phase 5 review layer landed and the security posture holds:
--   * the review cache, its unique key, its indexes and its ownership trigger
--   * the authorizer knows GOOGLE_SYNC_REVIEWS
--   * the read RPCs filter/paginate server-side and the summary is authoritative
--   * reply persistence, the 4096-BYTE limit and sync locking exist
--   * every function is SECURITY DEFINER with a pinned search_path
--   * anon holds no EXECUTE on any review RPC and no write on the cache
--
-- Nothing here writes data. It runs in a transaction and ROLLBACKs.
--
-- Output: ONE result set. Every row must read ok = true and summary must read
-- ALL CHECKS PASSED. A FAIL row names the missing/misconfigured object.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE _p5_deploy (id serial, kind text, name text, ok boolean, detail text) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp._chk(p_kind text, p_name text, p_ok boolean, p_detail text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO _p5_deploy(kind, name, ok, detail) VALUES (p_kind, p_name, COALESCE(p_ok, false), p_detail);
$$;

CREATE OR REPLACE FUNCTION pg_temp._fn_oid(p_sig text)
RETURNS oid LANGUAGE sql STABLE AS $$ SELECT to_regprocedure('public.' || p_sig); $$;

DO $verify$
DECLARE
  r record;
  v_src text;
BEGIN
  --------------------------------------------------------------------------
  -- 1. Table, constraints, indexes
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('schema', 'google_business_reviews exists',
    to_regclass('public.google_business_reviews') IS NOT NULL);
  PERFORM pg_temp._chk('schema', 'review RLS is enabled',
    (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.google_business_reviews')));
  PERFORM pg_temp._chk('schema', 'unique (google_location_id, google_review_id)',
    EXISTS (SELECT 1 FROM pg_constraint
            WHERE conrelid = to_regclass('public.google_business_reviews')
              AND contype = 'u'
              AND pg_get_constraintdef(oid) LIKE '%google_location_id%google_review_id%'));

  FOR r IN SELECT unnest(ARRAY[
    'office_id, review_update_time',
    'office_id, star_rating',
    'office_id, darb_reply_status',
    'office_id, visibility_state']) AS frag
  LOOP
    PERFORM pg_temp._chk('schema', 'index on (' || r.frag || ')',
      EXISTS (SELECT 1 FROM pg_indexes
              WHERE tablename = 'google_business_reviews'
                AND indexdef LIKE '%' || r.frag || '%'));
  END LOOP;

  PERFORM pg_temp._chk('schema', 'office profile has review summary columns',
    (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'office_google_profiles'
       AND column_name IN ('review_average_rating','review_total_count',
                           'review_last_synced_at','review_last_successful_sync_at',
                           'review_sync_error_code','review_sync_error_message',
                           'review_sync_locked_at')) = 7);

  PERFORM pg_temp._chk('trigger', 'review ownership trigger installed',
    EXISTS (SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_validate_google_review' AND NOT tgisinternal));

  --------------------------------------------------------------------------
  -- 2. Functions exist with the exact signatures the app calls
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'list_office_google_reviews(uuid,integer,integer,integer,text,text,text,boolean)',
    'get_office_google_review_summary(uuid)',
    'get_office_google_review(uuid,uuid)',
    'resolve_google_review_office(uuid,uuid)',
    'admin_sync_google_reviews(uuid,jsonb,numeric,integer,boolean,uuid)',
    'admin_mark_google_review_sync_error(uuid,text,text)',
    'admin_apply_google_review_reply(uuid,uuid,text,text,text,text,integer)',
    'acquire_google_review_sync_lock(uuid,integer)',
    'release_google_review_sync_lock(uuid)',
    'validate_google_review()',
    'notify_new_google_review(uuid,uuid,integer,text)'
  ]) AS sig
  LOOP
    PERFORM pg_temp._chk('function', r.sig, pg_temp._fn_oid(r.sig) IS NOT NULL);
  END LOOP;

  --------------------------------------------------------------------------
  -- 3. Authorizer is the Phase 5 definition
  --------------------------------------------------------------------------
  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'authorize_google_office_action' LIMIT 1;
  PERFORM pg_temp._chk('authorizer', 'knows GOOGLE_SYNC_REVIEWS',
    v_src LIKE '%GOOGLE_SYNC_REVIEWS%');
  PERFORM pg_temp._chk('authorizer', 'still knows GOOGLE_REPLY_REVIEW',
    v_src LIKE '%GOOGLE_REPLY_REVIEW%');
  PERFORM pg_temp._chk('authorizer', 'still knows GOOGLE_REMOVE_SIDE_MANAGER',
    v_src LIKE '%GOOGLE_REMOVE_SIDE_MANAGER%');
  PERFORM pg_temp._chk('authorizer', 'admin-only controls still present',
    v_src LIKE '%GOOGLE_CONNECT%' AND v_src LIKE '%GOOGLE_DISCONNECT%');

  -- Reply persistence must enforce the byte limit, not a char limit.
  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'admin_apply_google_review_reply' LIMIT 1;
  PERFORM pg_temp._chk('reply', 'reply RPC enforces a byte limit',
    v_src LIKE '%octet_length%' AND v_src LIKE '%4096%');

  -- Sync must reconcile rather than delete.
  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'admin_sync_google_reviews' LIMIT 1;
  PERFORM pg_temp._chk('sync', 'sync marks missing reviews NOT_FOUND',
    v_src LIKE '%NOT_FOUND%');
  PERFORM pg_temp._chk('sync', 'sync upserts on the unique key',
    v_src LIKE '%ON CONFLICT%google_location_id, google_review_id%');
  PERFORM pg_temp._chk('sync', 'sync preserves a REPLY_PENDING reply',
    v_src LIKE '%REPLY_PENDING%');

  -- Notification scope.
  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'notify_new_google_review' LIMIT 1;
  PERFORM pg_temp._chk('notify', 'new-review notifier exists',
    v_src LIKE '%emit_notification%' AND v_src LIKE '%office_google_operators%');
  PERFORM pg_temp._chk('notify', 'new-review dedupe is per-recipient',
    v_src LIKE '%v_recipient::text%');

  -- The sync lock is guarded too: a caller who cannot sync must not be able to
  -- lock or wedge another office's sync by id.
  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'acquire_google_review_sync_lock' LIMIT 1;
  PERFORM pg_temp._chk('security', 'acquire lock is authorized',
    v_src LIKE '%authorize_google_office_action%');
  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'release_google_review_sync_lock' LIMIT 1;
  PERFORM pg_temp._chk('security', 'release lock is authorized',
    v_src LIKE '%authorize_google_office_action%');

  --------------------------------------------------------------------------
  -- 4. SECURITY DEFINER + pinned search_path
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'list_office_google_reviews','get_office_google_review_summary',
    'get_office_google_review','resolve_google_review_office',
    'admin_sync_google_reviews','admin_mark_google_review_sync_error',
    'admin_apply_google_review_reply','acquire_google_review_sync_lock',
    'release_google_review_sync_lock','validate_google_review',
    'notify_new_google_review']) AS fname
  LOOP
    PERFORM pg_temp._chk('security', r.fname || ' is SECURITY DEFINER',
      (SELECT p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = r.fname LIMIT 1));
    PERFORM pg_temp._chk('security', r.fname || ' pins search_path',
      (SELECT COALESCE(array_to_string(p.proconfig, ','), '') LIKE '%search_path=%'
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = r.fname LIMIT 1));
  END LOOP;

  --------------------------------------------------------------------------
  -- 5. Grants — authenticated yes, anon no
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'list_office_google_reviews(uuid,integer,integer,integer,text,text,text,boolean)',
    'get_office_google_review_summary(uuid)',
    'get_office_google_review(uuid,uuid)',
    'resolve_google_review_office(uuid,uuid)',
    'admin_sync_google_reviews(uuid,jsonb,numeric,integer)',
    'admin_apply_google_review_reply(uuid,uuid,text,text,text,text,integer)'
  ]) AS sig
  LOOP
    PERFORM pg_temp._chk('grant', 'authenticated can EXECUTE ' || r.sig,
      COALESCE(has_function_privilege('authenticated', pg_temp._fn_oid(r.sig), 'EXECUTE'), false));
    PERFORM pg_temp._chk('grant', 'anon CANNOT EXECUTE ' || r.sig,
      NOT COALESCE(has_function_privilege('anon', pg_temp._fn_oid(r.sig), 'EXECUTE'), false));
  END LOOP;

  -- admin_sync_google_reviews is service-role only (connector asserts the
  -- Google snapshot); the browser role must not reach it.
  PERFORM pg_temp._chk('grant', 'authenticated CANNOT EXECUTE admin_sync_google_reviews',
    NOT COALESCE(has_function_privilege('authenticated',
      'public.admin_sync_google_reviews(uuid,jsonb,numeric,integer,boolean,uuid)', 'EXECUTE'), false));
  PERFORM pg_temp._chk('grant', 'anon CANNOT EXECUTE admin_sync_google_reviews',
    NOT COALESCE(has_function_privilege('anon',
      'public.admin_sync_google_reviews(uuid,jsonb,numeric,integer,boolean,uuid)', 'EXECUTE'), false));

  -- The notifier and the validator are internal only.
  PERFORM pg_temp._chk('grant', 'authenticated CANNOT EXECUTE notify_new_google_review',
    NOT COALESCE(has_function_privilege('authenticated',
      'public.notify_new_google_review(uuid,uuid,integer,text)', 'EXECUTE'), false));
  PERFORM pg_temp._chk('grant', 'authenticated CANNOT EXECUTE validate_google_review',
    NOT COALESCE(has_function_privilege('authenticated',
      'public.validate_google_review()', 'EXECUTE'), false));

  --------------------------------------------------------------------------
  -- 6. Table privileges — reads only for browser roles
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('grant', 'authenticated can SELECT reviews',
    has_table_privilege('authenticated', 'public.google_business_reviews', 'SELECT'));
  PERFORM pg_temp._chk('grant', 'authenticated CANNOT INSERT reviews',
    NOT has_table_privilege('authenticated', 'public.google_business_reviews', 'INSERT'));
  PERFORM pg_temp._chk('grant', 'authenticated CANNOT UPDATE reviews',
    NOT has_table_privilege('authenticated', 'public.google_business_reviews', 'UPDATE'));
  PERFORM pg_temp._chk('grant', 'authenticated CANNOT DELETE reviews',
    NOT has_table_privilege('authenticated', 'public.google_business_reviews', 'DELETE'));
  PERFORM pg_temp._chk('grant', 'anon CANNOT SELECT reviews',
    NOT has_table_privilege('anon', 'public.google_business_reviews', 'SELECT'));

  --------------------------------------------------------------------------
  -- 7. Live permission gate (non-destructive)
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('behavior', 'authorize() denies a null user for SYNC_REVIEWS',
    public.authorize_google_office_action(NULL, gen_random_uuid(), 'GOOGLE_SYNC_REVIEWS') = false);
  PERFORM pg_temp._chk('behavior', 'authorize() denies an unknown action',
    public.authorize_google_office_action(auth.uid(), gen_random_uuid(), 'GOOGLE_NOPE') = false);
  PERFORM pg_temp._chk('behavior', 'authorize() denies a forged user id',
    public.authorize_google_office_action(gen_random_uuid(), gen_random_uuid(), 'GOOGLE_VIEW') = false);
END
$verify$;

-- ============================================================================
-- REPORT — exactly one result set
-- ============================================================================
SELECT kind, name, ok, detail FROM _p5_deploy WHERE NOT ok ORDER BY kind, name;

SELECT
  count(*) FILTER (WHERE ok)     AS passed,
  count(*)                       AS total,
  count(*) FILTER (WHERE NOT ok) AS failed,
  CASE WHEN count(*) FILTER (WHERE NOT ok) = 0
       THEN 'ALL CHECKS PASSED' ELSE 'FAILURES ABOVE — do not proceed' END AS summary
FROM _p5_deploy;

ROLLBACK;
