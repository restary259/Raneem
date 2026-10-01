-- ============================================================================
-- PHASE 3 DEPLOY VERIFICATION — Google Location Discovery + Office Mapping
-- ============================================================================
-- READ-ONLY. Run this in the Supabase SQL editor (or psql) AFTER applying:
--
--   1. supabase/migrations/20261001160000_office_google_permission_foundation.sql
--   2. supabase/migrations/20261001170000_office_google_location_mapping.sql
--
-- It asserts every object the app expects actually landed, and that the
-- security posture is correct:
--   * the location cache has NO browser-role table grant (raw_location_json
--     stays off the client surface; reads go through SECURITY DEFINER RPCs)
--   * the four Phase 1 tables are SELECT-only to authenticated (RLS filters
--     rows; no INSERT/UPDATE/DELETE, so writes are RPC-only)
--   * admin gate is is_admin_session() = admin role AND AAL2
--   * RLS enabled with the expected policies
--   * new RPCs are SECURITY DEFINER with a pinned search_path
--
-- Nothing here writes data. It runs in a transaction and ROLLBACKs, so the
-- only side effect is a temp table that disappears with the session.
--
-- Output: ONE result set. Every row must read `ok = true` and `summary` must
-- read ALL CHECKS PASSED. A FAIL row names the missing/misconfigured object.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE _phase3_checks (id serial, kind text, name text, ok boolean, detail text) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp._chk(p_kind text, p_name text, p_ok boolean, p_detail text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO _phase3_checks(kind, name, ok, detail) VALUES (p_kind, p_name, COALESCE(p_ok, false), p_detail);
$$;

-- Does a function exist for this exact signature? (type-only args, e.g. 'uuid, text')
CREATE OR REPLACE FUNCTION pg_temp._fn_oid(p_sig text)
RETURNS oid LANGUAGE sql STABLE AS $$
  SELECT to_regprocedure('public.' || p_sig);
$$;

-- Does role X hold table privilege P on table T?
CREATE OR REPLACE FUNCTION pg_temp._has_tbl_priv(p_role text, p_table text, p_priv text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_privileges
    WHERE table_schema='public' AND table_name=p_table
      AND grantee=p_role AND privilege_type=p_priv
  );
$$;

DO $verify$
DECLARE
  r record;
  v_prosrc text;
BEGIN
  --------------------------------------------------------------------------
  -- 1. Tables
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'google_business_connections','office_google_profiles','office_google_operators',
    'google_business_activity','google_business_locations']) AS nm
  LOOP
    PERFORM pg_temp._chk('table', r.nm, to_regclass('public.' || r.nm) IS NOT NULL);
  END LOOP;

  --------------------------------------------------------------------------
  -- 2. Columns
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'google_connection_id','google_store_code','google_location_name',
    'google_primary_category','google_address_line_1','google_address_line_2',
    'google_city','google_postal_code','google_country','google_phone',
    'google_website','google_status','google_verification_state',
    'mapping_status','mapped_by','mapped_at']) AS nm
  LOOP
    PERFORM pg_temp._chk('column', 'office_google_profiles.' || r.nm,
      EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='office_google_profiles' AND column_name=r.nm));
  END LOOP;

  FOR r IN SELECT unnest(ARRAY[
    'google_connection_id','google_account_id','google_location_id',
    'google_location_resource_name','store_code','location_name',
    'primary_category','address_json','phone','website_url','place_id',
    'maps_url','verification_state','location_state','raw_location_json',
    'first_seen_at','last_seen_at']) AS nm
  LOOP
    PERFORM pg_temp._chk('column', 'google_business_locations.' || r.nm,
      EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='google_business_locations' AND column_name=r.nm));
  END LOOP;

  --------------------------------------------------------------------------
  -- 3. Constraints / indexes / triggers
  --------------------------------------------------------------------------
  FOR r IN SELECT * FROM (VALUES
    ('office_google_profiles UNIQUE(office_id)',         'office_google_profiles_office_id_key'),
    ('office_google_profiles UNIQUE(google_location_id)','office_google_profiles_location_id_key'),
    ('google_business_locations UNIQUE(resource_name)',  'google_business_locations_resource_key'),
    ('office_google_profiles mapping_status CHECK',       'office_google_profiles_mapping_status_check')
  ) AS t(label, cname)
  LOOP
    PERFORM pg_temp._chk('constraint', r.label,
      EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.cname));
  END LOOP;

  PERFORM pg_temp._chk('index', 'office_google_operators_one_primary_idx',
    to_regclass('public.office_google_operators_one_primary_idx') IS NOT NULL);
  PERFORM pg_temp._chk('index', 'office_google_operators_one_side_manager_idx',
    to_regclass('public.office_google_operators_one_side_manager_idx') IS NOT NULL);
  PERFORM pg_temp._chk('trigger', 'trg_validate_google_operator',
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_validate_google_operator' AND NOT tgisinternal));
  PERFORM pg_temp._chk('trigger', 'trg_validate_google_activity',
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_validate_google_activity' AND NOT tgisinternal));

  --------------------------------------------------------------------------
  -- 4. RPCs (exact signatures the app calls)
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'authorize_google_office_action(uuid,uuid,text)',
    'list_office_google_profiles()',
    'admin_get_google_business_connections()',
    'admin_get_google_business_activity(uuid,integer)',
    'admin_upsert_office_google_profile(uuid,jsonb)',
    'admin_assign_google_primary(uuid,uuid)',
    'assign_google_side_manager(uuid,uuid)',
    'remove_google_operator(uuid,text)',
    'admin_update_google_connection(jsonb)',
    'admin_sync_google_locations(uuid,jsonb)',
    'admin_list_google_locations()',
    'get_office_google_mapping(uuid)',
    'admin_map_office_google_location(uuid,text,text)',
    'admin_record_google_mapping_attempt(uuid,text,text,jsonb)',
    'admin_unmap_office_google_location(uuid)',
    'admin_mark_google_mapping_error(uuid,text,text)'
  ]) AS sig
  LOOP
    PERFORM pg_temp._chk('function', r.sig, pg_temp._fn_oid(r.sig) IS NOT NULL);
  END LOOP;

  -- The authorizer must be the Phase 3 definition, otherwise an older one shadows it.
  SELECT p.prosrc INTO v_prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='authorize_google_office_action' LIMIT 1;
  PERFORM pg_temp._chk('function', 'authorizer is Phase 3 (knows GOOGLE_MAP_LOCATION)',
    v_prosrc LIKE '%GOOGLE_MAP_LOCATION%');

  --------------------------------------------------------------------------
  -- 5. Execute grants (least privilege)
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'authorize_google_office_action(uuid,uuid,text)',
    'admin_list_google_locations()',
    'get_office_google_mapping(uuid)',
    'admin_map_office_google_location(uuid,text,text)'
  ]) AS sig
  LOOP
    PERFORM pg_temp._chk('grant', 'authenticated can EXECUTE ' || r.sig,
      COALESCE(has_function_privilege('authenticated', pg_temp._fn_oid(r.sig), 'EXECUTE'), false));
  END LOOP;

  FOR r IN SELECT unnest(ARRAY[
    'authorize_google_office_action(uuid,uuid,text)',
    'get_office_google_mapping(uuid)',
    'admin_list_google_locations()',
    'admin_sync_google_locations(uuid,jsonb)',
    'admin_map_office_google_location(uuid,text,text)'
  ]) AS sig
  LOOP
    PERFORM pg_temp._chk('grant', 'anon CANNOT EXECUTE ' || r.sig,
      NOT COALESCE(has_function_privilege('anon', pg_temp._fn_oid(r.sig), 'EXECUTE'), false));
  END LOOP;

  -- CRITICAL: the location cache has NO table privilege for browser roles, so
  -- raw_location_json is unreachable from the client.
  PERFORM pg_temp._chk('grant', 'authenticated has NO table grant on google_business_locations',
    NOT EXISTS (SELECT 1 FROM information_schema.table_privileges
                WHERE table_schema='public' AND table_name='google_business_locations'
                  AND grantee='authenticated'));
  PERFORM pg_temp._chk('grant', 'anon has NO table grant on google_business_locations',
    NOT EXISTS (SELECT 1 FROM information_schema.table_privileges
                WHERE table_schema='public' AND table_name='google_business_locations'
                  AND grantee='anon'));

  -- The four Phase 1 tables are SELECT-only to authenticated; no write grants.
  FOR r IN SELECT unnest(ARRAY[
    'office_google_profiles','office_google_operators',
    'google_business_activity','google_business_connections']) AS tbl
  LOOP
    PERFORM pg_temp._chk('grant', 'authenticated has SELECT on ' || r.tbl,
      pg_temp._has_tbl_priv('authenticated', r.tbl, 'SELECT'));
    PERFORM pg_temp._chk('grant', 'authenticated CANNOT INSERT into ' || r.tbl,
      NOT pg_temp._has_tbl_priv('authenticated', r.tbl, 'INSERT'));
    PERFORM pg_temp._chk('grant', 'authenticated CANNOT UPDATE ' || r.tbl,
      NOT pg_temp._has_tbl_priv('authenticated', r.tbl, 'UPDATE'));
    PERFORM pg_temp._chk('grant', 'authenticated CANNOT DELETE from ' || r.tbl,
      NOT pg_temp._has_tbl_priv('authenticated', r.tbl, 'DELETE'));
    PERFORM pg_temp._chk('grant', 'anon has NO grant on ' || r.tbl,
      NOT EXISTS (SELECT 1 FROM information_schema.table_privileges
                  WHERE table_schema='public' AND table_name=r.tbl AND grantee='anon'));
  END LOOP;

  --------------------------------------------------------------------------
  -- 6. RLS enabled + policies present
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'google_business_connections','office_google_profiles','office_google_operators',
    'google_business_activity','google_business_locations']) AS tbl
  LOOP
    PERFORM pg_temp._chk('rls', r.tbl || ' RLS enabled',
      (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.' || r.tbl)));
  END LOOP;

  FOR r IN SELECT * FROM (VALUES
    ('office_google_profiles',      'Office members read google profiles'),
    ('office_google_operators',     'Office members read google operators'),
    ('google_business_connections', 'Admins read google business connections'),
    ('google_business_activity',    'Admins read google business activity'),
    ('google_business_locations',   'Admins read google business locations')
  ) AS t(tbl, pol)
  LOOP
    PERFORM pg_temp._chk('policy', r.tbl || ' :: ' || r.pol,
      EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname='public' AND tablename=r.tbl AND policyname=r.pol));
  END LOOP;

  --------------------------------------------------------------------------
  -- 7. SECURITY DEFINER + pinned search_path on the new RPCs
  --------------------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY[
    'admin_sync_google_locations','admin_list_google_locations',
    'get_office_google_mapping','admin_map_office_google_location',
    'admin_record_google_mapping_attempt','admin_unmap_office_google_location',
    'admin_mark_google_mapping_error']) AS fname
  LOOP
    PERFORM pg_temp._chk('security', r.fname || ' is SECURITY DEFINER',
      (SELECT p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname=r.fname LIMIT 1));
    PERFORM pg_temp._chk('security', r.fname || ' pins search_path',
      (SELECT COALESCE(array_to_string(p.proconfig, ','), '') LIKE '%search_path=%'
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname=r.fname LIMIT 1));
  END LOOP;

  PERFORM pg_temp._chk('security', 'validate_google_activity is append-only',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public' AND p.proname='validate_google_activity'
              AND p.prosrc LIKE '%append-only%'));

  -- Admin gate must be the AAL2-aware is_admin_session(), not a bare has_role.
  SELECT p.prosrc INTO v_prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='is_admin_session' LIMIT 1;
  PERFORM pg_temp._chk('security', 'is_admin_session requires AAL2 MFA',
    v_prosrc LIKE '%aal2%');

  --------------------------------------------------------------------------
  -- 8. Live permission gate (non-destructive)
  --------------------------------------------------------------------------
  PERFORM pg_temp._chk('behavior', 'authorize() denies a null user',
    public.authorize_google_office_action(NULL, gen_random_uuid(), 'GOOGLE_VIEW') = false);
  PERFORM pg_temp._chk('behavior', 'authorize() denies a null office',
    public.authorize_google_office_action(auth.uid(), NULL, 'GOOGLE_VIEW') = false);
  PERFORM pg_temp._chk('behavior', 'authorize() denies an unknown action',
    public.authorize_google_office_action(auth.uid(), gen_random_uuid(), 'GOOGLE_NOPE') = false);
END
$verify$;

-- ============================================================================
-- REPORT — exactly one result set
-- ============================================================================
SELECT kind, name, ok, detail
FROM _phase3_checks
WHERE NOT ok
ORDER BY kind, name;

SELECT
  count(*) FILTER (WHERE ok)      AS passed,
  count(*)                        AS total,
  count(*) FILTER (WHERE NOT ok)  AS failed,
  CASE WHEN count(*) FILTER (WHERE NOT ok) = 0
       THEN 'ALL CHECKS PASSED'
       ELSE 'FAILURES ABOVE — do not proceed' END AS summary
FROM _phase3_checks;

ROLLBACK;
