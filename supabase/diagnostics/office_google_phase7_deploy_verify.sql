-- ============================================================================
-- PHASE 7 DEPLOY VERIFICATION — Google Business Photos + Google Posts
-- ============================================================================
-- READ-ONLY. Run this in the Supabase SQL editor (or psql) AFTER applying:
--
--   1. supabase/migrations/20261001160000_office_google_permission_foundation.sql
--   2. supabase/migrations/20261001170000_office_google_location_mapping.sql
--   3. supabase/migrations/20261001180000_office_google_delegation.sql
--   4. supabase/migrations/20261001190000_office_google_reviews.sql
--   5. supabase/migrations/20261001200000_office_google_profile_management.sql
--   6. supabase/migrations/20261002120000_office_google_media_posts.sql
--
-- Asserts the Phase 7 media + Local Post layer landed and the security posture
-- holds:
--   * the media/post/receipt tables, uniqueness and freshness columns
--   * business vs customer media separation (media_origin)
--   * DARB category vs Google category are distinct columns
--   * the authorizer knows the Phase 7 actions and keeps operators out of
--     customer-media moderation
--   * every write RPC is SECURITY DEFINER with a pinned search_path
--   * anon holds no EXECUTE and no browser role holds a write grant on caches
--   * the private staging bucket exists and its object policies are scoped
--
-- Nothing here writes data. It runs in a transaction and ROLLBACKs.
--
-- Output: ONE result set. Every row must read ok = true and summary must read
-- ALL CHECKS PASSED. A FAIL row names the missing/misconfigured object.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE _p7_deploy (id serial, kind text, name text, ok boolean, detail text) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp._chk(p_kind text, p_name text, p_ok boolean, p_detail text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO _p7_deploy(kind, name, ok, detail) VALUES (p_kind, p_name, COALESCE(p_ok, false), p_detail);
$$;

CREATE OR REPLACE FUNCTION pg_temp._fn_oid(p_sig text)
RETURNS oid LANGUAGE sql STABLE AS $$ SELECT to_regprocedure('public.' || p_sig); $$;

DO $verify$
DECLARE
  r record;
  v_src text;
BEGIN
  --------------------------------------------------------------------------
  -- 1. Schema
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('schema', 'google_business_media exists',
    to_regclass('public.google_business_media') IS NOT NULL);
  PERFORM pg_temp._chk('schema', 'google_business_posts exists',
    to_regclass('public.google_business_posts') IS NOT NULL);
  PERFORM pg_temp._chk('schema', 'google_media_upload_receipts exists',
    to_regclass('public.google_media_upload_receipts') IS NOT NULL);
  PERFORM pg_temp._chk('schema', 'google_post_operation_receipts exists',
    to_regclass('public.google_post_operation_receipts') IS NOT NULL);

  PERFORM pg_temp._chk('schema', 'media RLS enabled',
    (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.google_business_media')));
  PERFORM pg_temp._chk('schema', 'posts RLS enabled',
    (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.google_business_posts')));
  PERFORM pg_temp._chk('schema', 'media upload receipts RLS enabled',
    (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.google_media_upload_receipts')));
  PERFORM pg_temp._chk('schema', 'post operation receipts RLS enabled',
    (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.google_post_operation_receipts')));

  -- Media columns
  PERFORM pg_temp._chk('column', 'media.media_origin exists',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='google_business_media' AND column_name='media_origin'));
  PERFORM pg_temp._chk('column', 'media.media_category exists',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='google_business_media' AND column_name='media_category'));
  PERFORM pg_temp._chk('column', 'media.darb_category exists',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='google_business_media' AND column_name='darb_category'));
  PERFORM pg_temp._chk('column', 'media.media_state exists',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='google_business_media' AND column_name='media_state'));

  -- Posts columns
  PERFORM pg_temp._chk('column', 'posts.topic_type exists',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='google_business_posts' AND column_name='topic_type'));
  PERFORM pg_temp._chk('column', 'posts.status exists',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='google_business_posts' AND column_name='status'));
  PERFORM pg_temp._chk('column', 'posts.version exists',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='google_business_posts' AND column_name='version'));
  PERFORM pg_temp._chk('column', 'posts.publish_locked_at exists',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='google_business_posts' AND column_name='publish_locked_at'));

  -- Freshness columns on the office mapping
  PERFORM pg_temp._chk('column', 'mapping.media_last_successful_sync_at exists',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='office_google_profiles' AND column_name='media_last_successful_sync_at'));
  PERFORM pg_temp._chk('column', 'mapping.posts_last_successful_sync_at exists',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='office_google_profiles' AND column_name='posts_last_successful_sync_at'));

  --------------------------------------------------------------------------
  -- 2. Uniqueness — a re-sync can never duplicate a row
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('index', 'media unique (location, media id)',
    EXISTS (SELECT 1 FROM pg_indexes
            WHERE schemaname='public' AND tablename='google_business_media'
              AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%google_media_id%'));
  PERFORM pg_temp._chk('index', 'posts unique (location, post id)',
    EXISTS (SELECT 1 FROM pg_indexes
            WHERE schemaname='public' AND tablename='google_business_posts'
              AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%google_post_id%'));

  --------------------------------------------------------------------------
  -- 3. Functions — SECURITY DEFINER + pinned search_path
  --------------------------------------------------------------------------
  FOR r IN
    SELECT unnest(ARRAY[
      'authorize_google_office_action(uuid,uuid,text)',
      'list_office_google_media(uuid,text,text,text,integer,integer)',
      'get_office_google_media_summary(uuid)',
      'resolve_google_media_office(uuid,uuid)',
      'begin_google_media_upload(uuid,text,text)',
      'record_google_media_upload(uuid,text,jsonb)',
      'fail_google_media_upload(uuid,text,text,text)',
      'admin_sync_google_media(uuid,jsonb)',
      'admin_mark_google_media_deleted(uuid,uuid,integer)',
      'list_office_google_posts(uuid,text,text,text,integer,integer)',
      'get_office_google_posts_summary(uuid)',
      'resolve_google_post_office(uuid,uuid)',
      'resolve_google_post_media_urls(uuid,uuid[])',
      'create_google_post_draft(uuid,jsonb)',
      'update_google_post_draft(uuid,uuid,jsonb,integer)',
      'acquire_google_post_publish_lock(uuid,uuid,text,integer)',
      'release_google_post_publish_lock(uuid,uuid)',
      'check_google_post_operation(uuid,text,text)',
      'admin_apply_google_post_publish(uuid,uuid,text,text,text,text,text,text[],text,timestamptz)',
      'admin_mark_google_post_publish_failed(uuid,uuid,text,text)',
      'acquire_google_post_delete_lock(uuid,uuid,integer)',
      'release_google_post_delete_lock(uuid,uuid)',
      'admin_mark_google_post_deleted(uuid,uuid,text,integer)',
      'admin_sync_google_posts(uuid,jsonb)',
      'admin_mark_google_posts_sync_error(uuid,text,text)'
    ]) AS sig
  LOOP
    PERFORM pg_temp._chk('function', 'public.' || r.sig || ' exists',
      pg_temp._fn_oid(r.sig) IS NOT NULL);

    IF pg_temp._fn_oid(r.sig) IS NOT NULL THEN
      SELECT p.prosrc INTO v_src FROM pg_proc p WHERE p.oid = pg_temp._fn_oid(r.sig);
      PERFORM pg_temp._chk('security', 'public.' || r.sig || ' is SECURITY DEFINER',
        (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = pg_temp._fn_oid(r.sig)));
      PERFORM pg_temp._chk('security', 'public.' || r.sig || ' pins search_path',
        (SELECT p.proconfig::text FROM pg_proc p WHERE p.oid = pg_temp._fn_oid(r.sig)) ILIKE '%search_path=public%');
      PERFORM pg_temp._chk('security', 'public.' || r.sig || ' rejects anon',
        NOT has_function_privilege('anon', pg_temp._fn_oid(r.sig), 'EXECUTE'));
    END IF;
  END LOOP;

  --------------------------------------------------------------------------
  -- 4. Authorizer knows the Phase 7 actions
  --------------------------------------------------------------------------
  FOR r IN
    SELECT unnest(ARRAY[
      'GOOGLE_MANAGE_MEDIA','GOOGLE_MANAGE_POSTS',
      'GOOGLE_SYNC_MEDIA','GOOGLE_SYNC_POSTS','GOOGLE_MANAGE_CUSTOMER_MEDIA'
    ]) AS action
  LOOP
    PERFORM pg_temp._chk('authorizer', 'google_actor_can understands ' || r.action,
      EXISTS (
        SELECT 1 FROM pg_proc p
        WHERE p.oid = pg_temp._fn_oid('google_actor_can(uuid,uuid,text)')
          AND p.prosrc ILIKE '%' || r.action || '%'
      ));
  END LOOP;

  -- Customer-media moderation must never be operator-reachable.
  PERFORM pg_temp._chk('authorizer', 'customer-media moderation is not operator-held',
    EXISTS (
      SELECT 1 FROM pg_proc p
      WHERE p.oid = pg_temp._fn_oid('google_actor_can(uuid,uuid,text)')
        AND p.prosrc ILIKE '%GOOGLE_MANAGE_CUSTOMER_MEDIA%'
        AND p.prosrc ILIKE '%RETURN false%'
    ));

  --------------------------------------------------------------------------
  -- 5. Grants — caches are read-only to browser roles
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('grant', 'authenticated may SELECT media',
    has_table_privilege('authenticated', 'public.google_business_media', 'SELECT'));
  PERFORM pg_temp._chk('grant', 'authenticated may SELECT posts',
    has_table_privilege('authenticated', 'public.google_business_posts', 'SELECT'));
  PERFORM pg_temp._chk('grant', 'authenticated cannot INSERT media',
    NOT has_table_privilege('authenticated', 'public.google_business_media', 'INSERT'));
  PERFORM pg_temp._chk('grant', 'authenticated cannot UPDATE media',
    NOT has_table_privilege('authenticated', 'public.google_business_media', 'UPDATE'));
  PERFORM pg_temp._chk('grant', 'authenticated cannot DELETE media',
    NOT has_table_privilege('authenticated', 'public.google_business_media', 'DELETE'));
  PERFORM pg_temp._chk('grant', 'authenticated cannot INSERT posts',
    NOT has_table_privilege('authenticated', 'public.google_business_posts', 'INSERT'));
  PERFORM pg_temp._chk('grant', 'authenticated cannot DELETE posts',
    NOT has_table_privilege('authenticated', 'public.google_business_posts', 'DELETE'));
  PERFORM pg_temp._chk('grant', 'anon cannot SELECT media',
    NOT has_table_privilege('anon', 'public.google_business_media', 'SELECT'));
  PERFORM pg_temp._chk('grant', 'anon cannot SELECT posts',
    NOT has_table_privilege('anon', 'public.google_business_posts', 'SELECT'));
  PERFORM pg_temp._chk('grant', 'authenticated cannot read media receipts',
    NOT has_table_privilege('authenticated', 'public.google_media_upload_receipts', 'SELECT'));
  PERFORM pg_temp._chk('grant', 'authenticated cannot read post receipts',
    NOT has_table_privilege('authenticated', 'public.google_post_operation_receipts', 'SELECT'));

  --------------------------------------------------------------------------
  -- 6. Storage — private staging bucket
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('storage', 'google-business bucket exists',
    EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'google-business'));
  PERFORM pg_temp._chk('storage', 'google-business bucket is private',
    EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'google-business' AND public = false));
  PERFORM pg_temp._chk('storage', 'google-business object policies exist',
    (SELECT count(*) FROM pg_policies
     WHERE schemaname='storage' AND tablename='objects'
       AND policyname ILIKE '%google-business%') >= 3);

  --------------------------------------------------------------------------
  -- 7. Triggers — location/office consistency
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('trigger', 'validate_google_media trigger exists',
    EXISTS (SELECT 1 FROM pg_trigger
            WHERE tgrelid = to_regclass('public.google_business_media') AND NOT tgisinternal));
  PERFORM pg_temp._chk('trigger', 'validate_google_post trigger exists',
    EXISTS (SELECT 1 FROM pg_trigger
            WHERE tgrelid = to_regclass('public.google_business_posts') AND NOT tgisinternal));
END
$verify$;

SELECT kind, name, ok, detail FROM _p7_deploy ORDER BY id;

SELECT
  CASE WHEN count(*) FILTER (WHERE NOT ok) = 0
       THEN 'ALL CHECKS PASSED'
       ELSE count(*) FILTER (WHERE NOT ok) || ' CHECK(S) FAILED' END AS summary,
  count(*) AS total,
  count(*) FILTER (WHERE ok) AS passed,
  count(*) FILTER (WHERE NOT ok) AS failed
FROM _p7_deploy;

ROLLBACK;
