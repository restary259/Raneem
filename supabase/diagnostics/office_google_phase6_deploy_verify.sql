-- ============================================================================
-- PHASE 6 DEPLOY VERIFICATION — Google Business Profile Management
-- ============================================================================
-- READ-ONLY. Run this in the Supabase SQL editor (or psql) AFTER applying:
--
--   1. supabase/migrations/20261001160000_office_google_permission_foundation.sql
--   2. supabase/migrations/20261001170000_office_google_location_mapping.sql
--   3. supabase/migrations/20261001180000_office_google_delegation.sql
--   4. supabase/migrations/20261001190000_office_google_reviews.sql
--   5. supabase/migrations/20261001200000_office_google_profile_management.sql
--
-- Asserts the Phase 6 profile layer landed and the security posture holds:
--   * the editable/versioned profile columns, change-request table, receipts
--   * the authorizer knows the Phase 6 actions and keeps operators out of the
--     high-risk direct-execution actions
--   * validation, high-risk classification and the content hash exist
--   * every write RPC is SECURITY DEFINER with a pinned search_path
--   * anon holds no EXECUTE and no browser role holds a write grant
--
-- Nothing here writes data. It runs in a transaction and ROLLBACKs.
--
-- Output: ONE result set. Every row must read ok = true and summary must read
-- ALL CHECKS PASSED. A FAIL row names the missing/misconfigured object.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE _p6_deploy (id serial, kind text, name text, ok boolean, detail text) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp._chk(p_kind text, p_name text, p_ok boolean, p_detail text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO _p6_deploy(kind, name, ok, detail) VALUES (p_kind, p_name, COALESCE(p_ok, false), p_detail);
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
  PERFORM pg_temp._chk('schema', 'google_profile_change_requests exists',
    to_regclass('public.google_profile_change_requests') IS NOT NULL);
  PERFORM pg_temp._chk('schema', 'google_profile_update_receipts exists',
    to_regclass('public.google_profile_update_receipts') IS NOT NULL);
  PERFORM pg_temp._chk('schema', 'change requests RLS enabled',
    (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.google_profile_change_requests')));
  PERFORM pg_temp._chk('schema', 'receipts RLS enabled',
    (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.google_profile_update_receipts')));

  PERFORM pg_temp._chk('schema', 'editable/versioned profile columns present',
    (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'office_google_profiles'
       AND column_name IN ('business_name','business_description','primary_category',
         'additional_categories','phone_primary','phone_additional','website_url',
         'address_line_1','address_line_2','postal_code','city','region','country',
         'latitude','longitude','regular_hours','special_hours','attributes',
         'google_state','profile_version','profile_updated_at','profile_synced_hash',
         'profile_last_synced_at','profile_last_successful_sync_at',
         'profile_sync_error_code','profile_sync_error_message','profile_sync_locked_at')) = 27);

  PERFORM pg_temp._chk('schema', 'one pending change request per office+field',
    EXISTS (SELECT 1 FROM pg_indexes
            WHERE tablename = 'google_profile_change_requests'
              AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%PENDING%'));

  PERFORM pg_temp._chk('schema', 'receipts unique on (office_id, idempotency_key)',
    EXISTS (SELECT 1 FROM pg_constraint
            WHERE conrelid = to_regclass('public.google_profile_update_receipts')
              AND contype = 'u'
              AND pg_get_constraintdef(oid) LIKE '%office_id%idempotency_key%'));

  PERFORM pg_temp._chk('trigger', 'change request immutability trigger installed',
    EXISTS (SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_validate_google_change_request' AND NOT tgisinternal));

  --------------------------------------------------------------------------
  -- 2. Functions exist with the exact signatures the app calls
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'get_office_google_profile(uuid)',
    'acquire_google_profile_sync_lock(uuid,integer)',
    'release_google_profile_sync_lock(uuid)',
    'admin_sync_google_profile(uuid,jsonb,boolean,uuid)',
    'admin_mark_google_profile_sync_error(uuid,text,text,uuid)',
    'admin_apply_google_profile_update(uuid,jsonb,integer,text,integer,uuid)',
    'google_actor_can(uuid,uuid,text)',
    'google_actor_role(uuid,uuid)',
    'google_user_is_admin(uuid)',
    'google_profile_field_error(text,jsonb)',
    'google_profile_high_risk_fields()',
    'google_profile_content(text,text,text,jsonb,text,jsonb,text,text,text,text,text,text,text,numeric,numeric,jsonb,jsonb,jsonb)',
    'google_profile_hash(jsonb)',
    'submit_google_profile_change_request(uuid,text,jsonb,text)',
    'list_google_profile_change_requests(uuid,text)',
    'decide_google_profile_change_request(uuid,uuid,text,text)',
    'admin_finalize_google_change_request(uuid,uuid,boolean,text,text,uuid)',
    'validate_google_change_request()'
  ]) AS sig
  LOOP
    PERFORM pg_temp._chk('function', r.sig, pg_temp._fn_oid(r.sig) IS NOT NULL);
  END LOOP;

  --------------------------------------------------------------------------
  -- 3. Authorizer is the Phase 6 definition
  --------------------------------------------------------------------------
  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'authorize_google_office_action' LIMIT 1;
  PERFORM pg_temp._chk('authorizer', 'knows GOOGLE_SYNC_PROFILE',
    v_src LIKE '%GOOGLE_SYNC_PROFILE%');
  PERFORM pg_temp._chk('authorizer', 'knows GOOGLE_REQUEST_HIGH_RISK',
    v_src LIKE '%GOOGLE_REQUEST_HIGH_RISK%');
  PERFORM pg_temp._chk('authorizer', 'knows GOOGLE_UPDATE_HOURS',
    v_src LIKE '%GOOGLE_UPDATE_HOURS%');
  PERFORM pg_temp._chk('authorizer', 'knows GOOGLE_UPDATE_ATTRIBUTES',
    v_src LIKE '%GOOGLE_UPDATE_ATTRIBUTES%');
  PERFORM pg_temp._chk('authorizer', 'knows the admin-only high-risk actions',
    v_src LIKE '%GOOGLE_UPDATE_CATEGORY%'
    AND v_src LIKE '%GOOGLE_UPDATE_ADDRESS%'
    AND v_src LIKE '%GOOGLE_APPROVE_CHANGE_REQUEST%');
  -- Still knows the earlier phases' actions.
  PERFORM pg_temp._chk('authorizer', 'still knows GOOGLE_SYNC_REVIEWS',
    v_src LIKE '%GOOGLE_SYNC_REVIEWS%');
  PERFORM pg_temp._chk('authorizer', 'still knows GOOGLE_CHANGE_PRIMARY',
    v_src LIKE '%GOOGLE_CHANGE_PRIMARY%');

  --------------------------------------------------------------------------
  -- 4. Security-critical behaviour is present in the definitions
  --------------------------------------------------------------------------
  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'admin_apply_google_profile_update' LIMIT 1;
  PERFORM pg_temp._chk('update', 'high-risk is derived from the fields, not the caller',
    v_src LIKE '%google_profile_high_risk_fields%');
  PERFORM pg_temp._chk('update', 'version conflict is enforced',
    v_src LIKE '%expected_version%' AND v_src LIKE '%conflict%');
  PERFORM pg_temp._chk('update', 'idempotency is enforced',
    v_src LIKE '%idempotency_key%' AND v_src LIKE '%idempotency_conflict%');
  PERFORM pg_temp._chk('update', 'every field is validated before write',
    v_src LIKE '%google_profile_field_error%');
  PERFORM pg_temp._chk('update', 'field-level audit is written',
    v_src LIKE '%GOOGLE_PROFILE_UPDATED%');

  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'admin_sync_google_profile' LIMIT 1;
  PERFORM pg_temp._chk('sync', 'external change is detected, not overwritten',
    v_src LIKE '%external_change%');
  PERFORM pg_temp._chk('sync', 'force accepts Google''s version',
    v_src LIKE '%p_force%');
  PERFORM pg_temp._chk('sync', 'is service-role only',
    v_src LIKE '%IS DISTINCT FROM ''service_role''%');
  PERFORM pg_temp._chk('sync', 'attributes the actor explicitly',
    v_src LIKE '%p_actor_user_id%');

  -- Server-only persistence RPCs must refuse a plain browser session.
  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'admin_apply_google_profile_update' LIMIT 1;
  PERFORM pg_temp._chk('update', 'is service-role only',
    v_src LIKE '%IS DISTINCT FROM ''service_role''%');
  PERFORM pg_temp._chk('update', 'attributes the actor explicitly',
    v_src LIKE '%p_actor_user_id%');
  PERFORM pg_temp._chk('update', 'authorizes the real actor, not auth.uid()',
    v_src LIKE '%google_actor_can%');

  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'decide_google_profile_change_request' LIMIT 1;
  PERFORM pg_temp._chk('request', 'separation of duties is enforced',
    v_src LIKE '%requested_by = v_actor%' OR v_src LIKE '%requested_by%v_actor%');

  SELECT p.prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'google_profile_field_error' LIMIT 1;
  PERFORM pg_temp._chk('validate', 'website validation rejects non-https',
    v_src LIKE '%invalid_url%' AND v_src LIKE '%https://%');
  PERFORM pg_temp._chk('validate', 'phone validation exists',
    v_src LIKE '%invalid_phone%');
  PERFORM pg_temp._chk('validate', 'byte-length limits are used',
    v_src LIKE '%octet_length%');

  --------------------------------------------------------------------------
  -- 5. SECURITY DEFINER + pinned search_path (write/read RPCs with table access)
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'get_office_google_profile','acquire_google_profile_sync_lock',
    'release_google_profile_sync_lock','admin_sync_google_profile',
    'admin_mark_google_profile_sync_error','admin_apply_google_profile_update',
    'submit_google_profile_change_request','list_google_profile_change_requests',
    'decide_google_profile_change_request','admin_finalize_google_change_request',
    'validate_google_change_request']) AS fname
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
  -- 6. Grants — browser-facing RPCs yes, server-only RPCs no
  --------------------------------------------------------------------------
  -- Browser roles may reach these: they never accept a caller-supplied Google
  -- snapshot, and every one of them re-checks office membership + operator role.
  FOR r IN SELECT unnest(ARRAY[
    'get_office_google_profile(uuid)',
    'submit_google_profile_change_request(uuid,text,jsonb,text)',
    'list_google_profile_change_requests(uuid,text)',
    'decide_google_profile_change_request(uuid,uuid,text,text)',
    'acquire_google_profile_sync_lock(uuid,integer)',
    'release_google_profile_sync_lock(uuid)'
  ]) AS sig
  LOOP
    PERFORM pg_temp._chk('grant', 'authenticated can EXECUTE ' || r.sig,
      COALESCE(has_function_privilege('authenticated', pg_temp._fn_oid(r.sig), 'EXECUTE'), false));
    PERFORM pg_temp._chk('grant', 'anon CANNOT EXECUTE ' || r.sig,
      NOT COALESCE(has_function_privilege('anon', pg_temp._fn_oid(r.sig), 'EXECUTE'), false));
  END LOOP;

  -- Server-only RPCs: these assert "Google accepted this" or persist a
  -- caller-supplied snapshot, so no browser role may EXECUTE them. Reaching
  -- them requires the service-role connector (or an AAL2 admin session).
  FOR r IN SELECT unnest(ARRAY[
    'admin_sync_google_profile(uuid,jsonb,boolean,uuid)',
    'admin_mark_google_profile_sync_error(uuid,text,text,uuid)',
    'admin_apply_google_profile_update(uuid,jsonb,integer,text,integer,uuid)',
    'admin_finalize_google_change_request(uuid,uuid,boolean,text,text,uuid)'
  ]) AS sig
  LOOP
    PERFORM pg_temp._chk('grant', 'authenticated CANNOT EXECUTE ' || r.sig,
      NOT COALESCE(has_function_privilege('authenticated', pg_temp._fn_oid(r.sig), 'EXECUTE'), false));
    PERFORM pg_temp._chk('grant', 'anon CANNOT EXECUTE ' || r.sig,
      NOT COALESCE(has_function_privilege('anon', pg_temp._fn_oid(r.sig), 'EXECUTE'), false));
    PERFORM pg_temp._chk('grant', 'service_role can EXECUTE ' || r.sig,
      COALESCE(has_function_privilege('service_role', pg_temp._fn_oid(r.sig), 'EXECUTE'), false));
  END LOOP;

  PERFORM pg_temp._chk('grant', 'authenticated CANNOT EXECUTE google_user_is_admin',
    COALESCE(pg_temp._fn_oid('google_user_is_admin(uuid)'), 0::oid) = 0::oid
    OR NOT COALESCE(has_function_privilege('authenticated',
      pg_temp._fn_oid('google_user_is_admin(uuid)'), 'EXECUTE'), false));

  PERFORM pg_temp._chk('grant', 'authenticated CANNOT EXECUTE validate_google_change_request',
    COALESCE(pg_temp._fn_oid('validate_google_change_request()'), 0::oid) = 0::oid
    OR NOT COALESCE(has_function_privilege('authenticated',
      pg_temp._fn_oid('validate_google_change_request()'), 'EXECUTE'), false));

  --------------------------------------------------------------------------
  -- 6b. No stale overload survives an upgrade
  --------------------------------------------------------------------------
  -- A prior revision of migration 20261001200000 used shorter signatures that
  -- were GRANTed to `authenticated`. `CREATE OR REPLACE` would leave them in
  -- place as extra overloads, re-opening the hole. Assert one definition per
  -- name, and that no browser role can reach ANY overload of the server-only
  -- RPCs (checked by name, so a re-introduced overload fails the deploy).
  FOR r IN SELECT unnest(ARRAY[
    'admin_sync_google_profile','admin_mark_google_profile_sync_error',
    'admin_apply_google_profile_update','admin_finalize_google_change_request',
    'google_profile_content','list_google_profile_change_requests'
  ]) AS fname
  LOOP
    PERFORM pg_temp._chk('overload', r.fname || ' has exactly one definition',
      (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = r.fname) = 1);
  END LOOP;

  FOR r IN SELECT unnest(ARRAY[
    'admin_sync_google_profile','admin_mark_google_profile_sync_error',
    'admin_apply_google_profile_update','admin_finalize_google_change_request'
  ]) AS fname
  LOOP
    PERFORM pg_temp._chk('overload', 'no overload of ' || r.fname || ' is EXECUTEable by authenticated',
      NOT EXISTS (
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
  -- 7. Table privileges — reads only for browser roles
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('grant', 'authenticated can SELECT change requests',
    has_table_privilege('authenticated', 'public.google_profile_change_requests', 'SELECT'));
  PERFORM pg_temp._chk('grant', 'authenticated CANNOT INSERT change requests',
    NOT has_table_privilege('authenticated', 'public.google_profile_change_requests', 'INSERT'));
  PERFORM pg_temp._chk('grant', 'authenticated CANNOT UPDATE change requests',
    NOT has_table_privilege('authenticated', 'public.google_profile_change_requests', 'UPDATE'));
  PERFORM pg_temp._chk('grant', 'authenticated CANNOT DELETE change requests',
    NOT has_table_privilege('authenticated', 'public.google_profile_change_requests', 'DELETE'));
  PERFORM pg_temp._chk('grant', 'anon CANNOT SELECT change requests',
    NOT has_table_privilege('anon', 'public.google_profile_change_requests', 'SELECT'));
  PERFORM pg_temp._chk('grant', 'authenticated CANNOT INSERT receipts',
    NOT has_table_privilege('authenticated', 'public.google_profile_update_receipts', 'INSERT'));

  --------------------------------------------------------------------------
  -- 8. Live behaviour (non-destructive)
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('behavior', 'field validation rejects a bad phone',
    public.google_profile_field_error('phone_primary', to_jsonb('abc123'::text)) = 'invalid_phone');
  PERFORM pg_temp._chk('behavior', 'field validation rejects a javascript url',
    public.google_profile_field_error('website_url', to_jsonb('javascript:alert(1)'::text)) = 'invalid_url');
  PERFORM pg_temp._chk('behavior', 'field validation accepts a good phone',
    public.google_profile_field_error('phone_primary', to_jsonb('+49 30 123456'::text)) IS NULL);
  PERFORM pg_temp._chk('behavior', 'high-risk set excludes contact fields',
    public.google_profile_high_risk_fields() @> ARRAY['primary_category','address_line_1']
    AND NOT public.google_profile_high_risk_fields() @> ARRAY['phone_primary','website_url','regular_hours']);
  PERFORM pg_temp._chk('behavior', 'authorize() denies a null user for SYNC_PROFILE',
    public.authorize_google_office_action(NULL, gen_random_uuid(), 'GOOGLE_SYNC_PROFILE') = false);
  PERFORM pg_temp._chk('behavior', 'authorize() denies an unknown action',
    public.authorize_google_office_action(auth.uid(), gen_random_uuid(), 'GOOGLE_NOPE') = false);
END
$verify$;

-- ============================================================================
-- REPORT — exactly one result set
-- ============================================================================
SELECT kind, name, ok, detail FROM _p6_deploy WHERE NOT ok ORDER BY kind, name;

SELECT
  count(*) FILTER (WHERE ok)     AS passed,
  count(*)                       AS total,
  count(*) FILTER (WHERE NOT ok) AS failed,
  CASE WHEN count(*) FILTER (WHERE NOT ok) = 0
       THEN 'ALL CHECKS PASSED' ELSE 'FAILURES ABOVE — do not proceed' END AS summary
FROM _p6_deploy;

ROLLBACK;
