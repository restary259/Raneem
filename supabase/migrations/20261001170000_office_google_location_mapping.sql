-- ===========================================================================
-- PHASE 3 — Google Location Discovery + DARB Office Mapping
--
-- Makes the Google connection useful to DARB: a Google Business location is a
-- distinct resource and is explicitly mapped to exactly one DARB office. There
-- is no auto-mapping by name — the admin selects, DARB validates.
--
-- What this migration does NOT do (deliberately):
--   * no OAuth / tokens (Phase 2 connector owns that, server-side)
--   * no Google API calls — discovery runs in admin-gated server code
--   * no accounts.locations.create (Phase 3 connects existing profiles only)
--
-- Timestamp is newer than 20261001160000 (Phase 1) so the Phase 3 authorizer
-- definition below wins on a fresh deploy.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Known-Google-locations cache
--
-- The Office page must never ask Google "what locations exist?" on every load.
-- The discovery run upserts here; the mapping RPC validates against this table
-- (it can never reach Google itself). raw_location_json is kept server-side for
-- debugging / reconciliation and is never exposed to browser roles.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.google_business_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_connection_id UUID REFERENCES public.google_business_connections(id) ON DELETE SET NULL,
  google_account_id TEXT NOT NULL,
  google_location_id TEXT NOT NULL,
  google_location_resource_name TEXT NOT NULL,
  store_code TEXT,
  location_name TEXT,
  primary_category TEXT,
  address_json JSONB,
  phone TEXT,
  website_url TEXT,
  place_id TEXT,
  maps_url TEXT,
  verification_state TEXT,
  location_state TEXT,
  raw_location_json JSONB,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT google_business_locations_resource_key UNIQUE (google_location_resource_name)
);

CREATE INDEX IF NOT EXISTS idx_google_business_locations_account
  ON public.google_business_locations (google_account_id);

CREATE INDEX IF NOT EXISTS idx_google_business_locations_location
  ON public.google_business_locations (google_location_id);

-- ---------------------------------------------------------------------------
-- 2. Richer office_google_profiles (Phase 3 mapping + health)
--
-- Phase 1 shipped the placeholder columns. Phase 3 adds the mapped-location
-- detail, the explicit mapping lifecycle and the sync-health surface.
-- ---------------------------------------------------------------------------

ALTER TABLE public.office_google_profiles
  ADD COLUMN IF NOT EXISTS google_connection_id UUID REFERENCES public.google_business_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS google_store_code TEXT,
  ADD COLUMN IF NOT EXISTS google_location_name TEXT,
  ADD COLUMN IF NOT EXISTS google_primary_category TEXT,
  ADD COLUMN IF NOT EXISTS google_address_line_1 TEXT,
  ADD COLUMN IF NOT EXISTS google_address_line_2 TEXT,
  ADD COLUMN IF NOT EXISTS google_city TEXT,
  ADD COLUMN IF NOT EXISTS google_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS google_country TEXT,
  ADD COLUMN IF NOT EXISTS google_phone TEXT,
  ADD COLUMN IF NOT EXISTS google_website TEXT,
  ADD COLUMN IF NOT EXISTS google_status TEXT,
  ADD COLUMN IF NOT EXISTS google_verification_state TEXT,
  ADD COLUMN IF NOT EXISTS mapping_status TEXT NOT NULL DEFAULT 'UNMAPPED',
  ADD COLUMN IF NOT EXISTS mapped_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mapped_at TIMESTAMPTZ;

-- Explicit mapping lifecycle: UNMAPPED -> PENDING_CONFIRMATION -> MAPPED, with
-- DISCONNECTED / MAPPING_ERROR as terminal/exceptional states.
ALTER TABLE public.office_google_profiles
  DROP CONSTRAINT IF EXISTS office_google_profiles_mapping_status_check;
ALTER TABLE public.office_google_profiles
  ADD CONSTRAINT office_google_profiles_mapping_status_check
  CHECK (mapping_status IN ('UNMAPPED','PENDING_CONFIRMATION','MAPPED','DISCONNECTED','MAPPING_ERROR'));

-- NOTE: Phase 1's `UNIQUE (google_location_id)` already guarantees a Google
-- location cannot be mapped to two offices, even under a concurrent race.

-- ---------------------------------------------------------------------------
-- 3. Authorizer — add Phase 3 actions (all admin-only)
--
-- Redefines the Phase 1 function. The body below is the Phase 1 body with the
-- five Phase 3 actions added to the allowlist and treated as admin-only.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.authorize_google_office_action(
  p_user_id uuid,
  p_office_id uuid,
  p_action text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_operator_role text;
  v_is_member boolean;
BEGIN
  IF p_user_id IS NULL OR p_office_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_action NOT IN (
    'GOOGLE_VIEW',
    'GOOGLE_REPLY_REVIEW',
    'GOOGLE_UPDATE_PROFILE',
    'GOOGLE_MANAGE_MEDIA',
    'GOOGLE_MANAGE_POSTS',
    'GOOGLE_VIEW_INSIGHTS',
    'GOOGLE_ASSIGN_SIDE_MANAGER',
    'GOOGLE_CHANGE_PRIMARY',
    'GOOGLE_CONNECT',
    'GOOGLE_DISCONNECT',
    'GOOGLE_RECONNECT',
    -- Phase 3 (admin-only)
    'GOOGLE_DISCOVER_LOCATIONS',
    'GOOGLE_VIEW_LOCATION',
    'GOOGLE_MAP_LOCATION',
    'GOOGLE_REMAP_LOCATION',
    'GOOGLE_UNMAP_LOCATION'
  ) THEN
    RETURN false;
  END IF;

  -- Background/service callers (Edge Functions) act as the system. Browser
  -- roles can never present the service_role JWT.
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  -- A browser caller may only ask about their own access; otherwise this
  -- function would be an oracle for another user's office membership.
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  -- Admin may do everything, but only with a full admin session (admin role
  -- AND AAL2 MFA) and only for a real, non-deleted office.
  IF public.is_admin_session() THEN
    RETURN EXISTS (
      SELECT 1 FROM public.offices o
      WHERE o.id = p_office_id AND o.deleted_at IS NULL
    );
  END IF;

  -- Every non-admin action requires live, active membership of this office.
  v_is_member := EXISTS (
    SELECT 1
    FROM public.office_members om
    WHERE om.office_id = p_office_id
      AND om.user_id = p_user_id
      AND om.is_active = true
  );

  IF NOT v_is_member THEN
    RETURN false;
  END IF;

  SELECT ogo.role INTO v_operator_role
  FROM public.office_google_operators ogo
  WHERE ogo.office_id = p_office_id
    AND ogo.team_member_id = p_user_id;

  -- Admin-only actions: never granted to a PRIMARY or SIDE_MANAGER.
  IF p_action IN (
    'GOOGLE_CHANGE_PRIMARY',
    'GOOGLE_CONNECT',
    'GOOGLE_DISCONNECT',
    'GOOGLE_RECONNECT',
    'GOOGLE_DISCOVER_LOCATIONS',
    'GOOGLE_VIEW_LOCATION',
    'GOOGLE_MAP_LOCATION',
    'GOOGLE_REMAP_LOCATION',
    'GOOGLE_UNMAP_LOCATION'
  ) THEN
    RETURN false;
  END IF;

  -- PRIMARY may additionally delegate a side manager.
  IF p_action = 'GOOGLE_ASSIGN_SIDE_MANAGER' THEN
    RETURN v_operator_role = 'PRIMARY';
  END IF;

  -- Shared operational actions: PRIMARY or SIDE_MANAGER.
  RETURN COALESCE(v_operator_role IN ('PRIMARY','SIDE_MANAGER'), false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.authorize_google_office_action(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_google_office_action(uuid, uuid, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Read RPC — known Google locations (admin only)
--
-- Discovery is an admin-only capability in Phase 3, so the cache read is too.
-- This is a SECURITY DEFINER RPC (not a widened table policy) so the raw JSON
-- and the connection wiring stay off the browser surface.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_list_google_locations()
RETURNS TABLE (
  google_location_id text,
  google_location_resource_name text,
  google_account_id text,
  location_name text,
  primary_category text,
  address_json jsonb,
  phone text,
  website_url text,
  place_id text,
  maps_url text,
  verification_state text,
  location_state text,
  last_seen_at timestamptz,
  mapped_office_id uuid,
  mapped_office_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.is_admin_session() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    l.google_location_id,
    l.google_location_resource_name,
    l.google_account_id,
    l.location_name,
    l.primary_category,
    l.address_json,
    l.phone,
    l.website_url,
    l.place_id,
    l.maps_url,
    l.verification_state,
    l.location_state,
    l.last_seen_at,
    ogp.office_id AS mapped_office_id,
    COALESCE(NULLIF(o.name_en, ''), o.name_ar) AS mapped_office_name
  FROM public.google_business_locations l
  LEFT JOIN public.office_google_profiles ogp
    ON ogp.google_location_resource_name = l.google_location_resource_name
   AND ogp.mapping_status = 'MAPPED'
  LEFT JOIN public.offices o ON o.id = ogp.office_id
  ORDER BY l.location_name NULLS LAST, l.google_location_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_list_google_locations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_google_locations() TO authenticated, service_role;

-- Office-scoped read of the full mapping detail (mapping lifecycle + mapped
-- location + operators + health). Admin, or an active member of that office;
-- anyone else gets Forbidden. This is what the office page renders.
CREATE OR REPLACE FUNCTION public.get_office_google_mapping(p_office_id uuid)
RETURNS TABLE (
  office_id uuid,
  mapping_status text,
  connection_status text,
  verification_status text,
  google_account_id text,
  google_location_id text,
  google_location_resource_name text,
  google_location_name text,
  google_primary_category text,
  google_address_line_1 text,
  google_address_line_2 text,
  google_city text,
  google_postal_code text,
  google_country text,
  google_phone text,
  google_website text,
  google_place_id text,
  google_maps_url text,
  google_store_code text,
  google_status text,
  google_verification_state text,
  mapped_by uuid,
  mapped_at timestamptz,
  last_synced_at timestamptz,
  last_successful_sync_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  last_error_message text,
  primary_operator_id uuid,
  primary_operator_name text,
  side_manager_id uuid,
  side_manager_name text,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT (
    public.is_admin_session()
    OR EXISTS (
      SELECT 1 FROM public.office_members om
      WHERE om.office_id = p_office_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
    )
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    ogp.office_id,
    ogp.mapping_status,
    ogp.connection_status,
    ogp.verification_status,
    ogp.google_account_id,
    ogp.google_location_id,
    ogp.google_location_resource_name,
    ogp.google_location_name,
    ogp.google_primary_category,
    ogp.google_address_line_1,
    ogp.google_address_line_2,
    ogp.google_city,
    ogp.google_postal_code,
    ogp.google_country,
    ogp.google_phone,
    ogp.google_website,
    ogp.google_place_id,
    ogp.google_maps_url,
    ogp.google_store_code,
    ogp.google_status,
    ogp.google_verification_state,
    ogp.mapped_by,
    ogp.mapped_at,
    ogp.last_synced_at,
    ogp.last_successful_sync_at,
    ogp.last_error_at,
    ogp.last_error_code,
    ogp.last_error_message,
    primary_op.team_member_id,
    primary_profile.full_name,
    side_op.team_member_id,
    side_profile.full_name,
    ogp.updated_at
  FROM public.office_google_profiles ogp
  LEFT JOIN public.office_google_operators primary_op
    ON primary_op.office_id = ogp.office_id AND primary_op.role = 'PRIMARY'
  LEFT JOIN public.profiles primary_profile ON primary_profile.id = primary_op.team_member_id
  LEFT JOIN public.office_google_operators side_op
    ON side_op.office_id = ogp.office_id AND side_op.role = 'SIDE_MANAGER'
  LEFT JOIN public.profiles side_profile ON side_profile.id = side_op.team_member_id
  WHERE ogp.office_id = p_office_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_office_google_mapping(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_office_google_mapping(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Write RPC — sync discovered locations into the cache (admin only)
--
-- The server-side discovery run calls this after talking to Google. It only
-- ever writes the cache; it never maps anything to an office.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_sync_google_locations(
  p_connection_id uuid,
  p_locations jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_count integer := 0;
BEGIN
  IF NOT public.is_admin_session() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_locations IS NULL OR jsonb_typeof(p_locations) <> 'array' THEN
    RAISE EXCEPTION 'p_locations must be a JSON array';
  END IF;

  IF jsonb_array_length(p_locations) > 500 THEN
    RAISE EXCEPTION 'Too many locations in one sync (max 500)';
  END IF;

  INSERT INTO public.google_business_locations AS l (
    google_connection_id, google_account_id, google_location_id,
    google_location_resource_name, store_code, location_name,
    primary_category, address_json, phone, website_url, place_id, maps_url,
    verification_state, location_state, raw_location_json,
    first_seen_at, last_seen_at, updated_at
  )
  SELECT
    p_connection_id,
    trim(elem->>'google_account_id'),
    trim(elem->>'google_location_id'),
    trim(elem->>'google_location_resource_name'),
    NULLIF(trim(COALESCE(elem->>'store_code','')), ''),
    NULLIF(trim(COALESCE(elem->>'location_name','')), ''),
    NULLIF(trim(COALESCE(elem->>'primary_category','')), ''),
    CASE WHEN elem ? 'address_json' THEN elem->'address_json' ELSE NULL END,
    NULLIF(trim(COALESCE(elem->>'phone','')), ''),
    NULLIF(trim(COALESCE(elem->>'website_url','')), ''),
    NULLIF(trim(COALESCE(elem->>'place_id','')), ''),
    NULLIF(trim(COALESCE(elem->>'maps_url','')), ''),
    NULLIF(trim(COALESCE(elem->>'verification_state','')), ''),
    NULLIF(trim(COALESCE(elem->>'location_state','')), ''),
    CASE WHEN elem ? 'raw_location_json' THEN elem->'raw_location_json' ELSE NULL END,
    now(), now(), now()
  FROM jsonb_array_elements(p_locations) AS elem
  WHERE NULLIF(trim(COALESCE(elem->>'google_location_id','')), '') IS NOT NULL
    AND NULLIF(trim(COALESCE(elem->>'google_location_resource_name','')), '') IS NOT NULL
    AND NULLIF(trim(COALESCE(elem->>'google_account_id','')), '') IS NOT NULL
  ON CONFLICT (google_location_resource_name) DO UPDATE SET
    google_connection_id = EXCLUDED.google_connection_id,
    google_account_id = EXCLUDED.google_account_id,
    google_location_id = EXCLUDED.google_location_id,
    store_code = EXCLUDED.store_code,
    location_name = EXCLUDED.location_name,
    primary_category = EXCLUDED.primary_category,
    address_json = EXCLUDED.address_json,
    phone = EXCLUDED.phone,
    website_url = EXCLUDED.website_url,
    place_id = EXCLUDED.place_id,
    maps_url = EXCLUDED.maps_url,
    verification_state = EXCLUDED.verification_state,
    location_state = EXCLUDED.location_state,
    raw_location_json = EXCLUDED.raw_location_json,
    last_seen_at = now(),
    updated_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.google_business_activity (
    office_id, actor_user_id, actor_role, action, resource_type, resource_id,
    after_data
  )
  VALUES (
    NULL, v_actor, 'admin', 'GOOGLE_LOCATIONS_DISCOVERED', 'google_business_locations', NULL,
    jsonb_build_object('count', v_count, 'connection_id', p_connection_id)
  );

  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_sync_google_locations(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_sync_google_locations(uuid, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Write RPC — map / remap an office to a Google location (admin only)
--
-- One atomic transaction: lock office + profile, validate the office and the
-- connection, validate the location exists in the cache AND belongs to the
-- given Google account, enforce uniqueness, write the mapping and audit.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_map_office_google_location(
  p_office_id uuid,
  p_google_account_id text,
  p_google_location_resource_name text
)
RETURNS public.office_google_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_location public.google_business_locations%ROWTYPE;
  v_profile public.office_google_profiles%ROWTYPE;
  v_before jsonb;
  v_conflict_office uuid;
  v_is_remap boolean;
  v_action text;
  v_account text := NULLIF(trim(COALESCE(p_google_account_id,'')), '');
  v_resource text := NULLIF(trim(COALESCE(p_google_location_resource_name,'')), '');
BEGIN
  IF NOT public.is_admin_session() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF v_account IS NULL OR v_resource IS NULL THEN
    RAISE EXCEPTION 'Google account and location are required';
  END IF;

  -- Lock the office row first so two concurrent admins serialise here.
  PERFORM 1 FROM public.offices o
  WHERE o.id = p_office_id AND o.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Office not found';
  END IF;

  SELECT * INTO v_profile
  FROM public.office_google_profiles
  WHERE office_id = p_office_id
  FOR UPDATE;

  v_before := CASE WHEN v_profile.id IS NULL THEN NULL ELSE to_jsonb(v_profile.*) END;

  -- The location must exist in the cache (i.e. Google actually returned it).
  SELECT * INTO v_location
  FROM public.google_business_locations
  WHERE google_location_resource_name = v_resource;

  IF v_location.id IS NULL THEN
    -- Rejection auditing happens in the caller's next transaction: any insert
    -- here would roll back with this exception. See
    -- admin_record_google_mapping_attempt().
    RAISE EXCEPTION 'Google location not found. Refresh locations and try again.';
  END IF;

  -- The location must belong to the Google account the caller named. A forged
  -- google_account_id therefore cannot reach another account's location.
  IF v_location.google_account_id IS DISTINCT FROM v_account THEN
    RAISE EXCEPTION 'Google location does not belong to the selected Google account';
  END IF;

  -- The location must not already be mapped to a different office.
  SELECT ogp.office_id INTO v_conflict_office
  FROM public.office_google_profiles ogp
  WHERE ogp.google_location_resource_name = v_resource
    AND ogp.office_id <> p_office_id
    AND ogp.mapping_status = 'MAPPED';

  IF v_conflict_office IS NOT NULL THEN
    RAISE EXCEPTION 'This Google Business Profile is already connected to another DARB office';
  END IF;

  -- Remap = this office already held a *different* mapped location.
  v_is_remap := v_profile.mapping_status = 'MAPPED'
            AND v_profile.google_location_resource_name IS DISTINCT FROM v_resource;

  v_action := CASE
    WHEN v_is_remap THEN 'GOOGLE_LOCATION_REMAP_COMPLETED'
    ELSE 'GOOGLE_LOCATION_MAPPED'
  END;

  INSERT INTO public.office_google_profiles AS ogp (
    office_id, google_connection_id, google_account_id,
    google_location_id, google_location_resource_name,
    google_place_id, google_maps_url,
    google_store_code, google_location_name, google_primary_category,
    google_address_line_1, google_address_line_2, google_city,
    google_postal_code, google_country, google_phone, google_website,
    google_status, google_verification_state,
    connection_status, verification_status,
    mapping_status, mapped_by, mapped_at,
    last_synced_at, last_successful_sync_at
  )
  VALUES (
    p_office_id,
    v_location.google_connection_id,
    v_location.google_account_id,
    v_location.google_location_id,
    v_location.google_location_resource_name,
    v_location.place_id,
    v_location.maps_url,
    v_location.store_code,
    v_location.location_name,
    v_location.primary_category,
    v_location.address_json->>'address_line_1',
    v_location.address_json->>'address_line_2',
    v_location.address_json->>'city',
    v_location.address_json->>'postal_code',
    v_location.address_json->>'country',
    v_location.phone,
    v_location.website_url,
    v_location.location_state,
    v_location.verification_state,
    'connected',
    CASE v_location.verification_state
      WHEN 'VERIFIED' THEN 'verified'
      WHEN 'PENDING' THEN 'pending'
      WHEN 'FAILED' THEN 'failed'
      ELSE 'unverified'
    END,
    'MAPPED',
    v_actor,
    now(),
    now(),
    now()
  )
  ON CONFLICT (office_id) DO UPDATE SET
    google_connection_id = EXCLUDED.google_connection_id,
    google_account_id = EXCLUDED.google_account_id,
    google_location_id = EXCLUDED.google_location_id,
    google_location_resource_name = EXCLUDED.google_location_resource_name,
    google_place_id = EXCLUDED.google_place_id,
    google_maps_url = EXCLUDED.google_maps_url,
    google_store_code = EXCLUDED.google_store_code,
    google_location_name = EXCLUDED.google_location_name,
    google_primary_category = EXCLUDED.google_primary_category,
    google_address_line_1 = EXCLUDED.google_address_line_1,
    google_address_line_2 = EXCLUDED.google_address_line_2,
    google_city = EXCLUDED.google_city,
    google_postal_code = EXCLUDED.google_postal_code,
    google_country = EXCLUDED.google_country,
    google_phone = EXCLUDED.google_phone,
    google_website = EXCLUDED.google_website,
    google_status = EXCLUDED.google_status,
    google_verification_state = EXCLUDED.google_verification_state,
    connection_status = EXCLUDED.connection_status,
    verification_status = EXCLUDED.verification_status,
    mapping_status = EXCLUDED.mapping_status,
    mapped_by = EXCLUDED.mapped_by,
    mapped_at = EXCLUDED.mapped_at,
    last_synced_at = EXCLUDED.last_synced_at,
    last_successful_sync_at = EXCLUDED.last_successful_sync_at,
    last_error_at = NULL,
    last_error_code = NULL,
    last_error_message = NULL,
    updated_at = now()
  RETURNING * INTO v_profile;

  -- Phase 3's *Started* events are recorded by the caller (server code) before
  -- this RPC; here we record the outcome. Remaps keep both the before/after
  -- snapshot so the mapping history is never erased.
  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role, action,
    resource_type, resource_id, before_data, after_data
  ) VALUES (
    p_office_id, v_profile.google_location_id, v_actor, 'admin', v_action,
    'office_google_profile', v_profile.id::text, v_before, to_jsonb(v_profile.*)
  );

  IF v_is_remap THEN
    INSERT INTO public.google_business_activity (
      office_id, google_location_id, actor_user_id, actor_role, action,
      resource_type, resource_id, before_data, after_data
    ) VALUES (
      p_office_id, v_before->>'google_location_id', v_actor, 'admin',
      'GOOGLE_LOCATION_REMAP_STARTED', 'office_google_profile', v_profile.id::text,
      v_before, to_jsonb(v_profile.*)
    );
  END IF;

  RETURN v_profile;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_map_office_google_location(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_map_office_google_location(uuid, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6b. Write RPC — record a rejected mapping attempt (admin only)
--
-- A mapping rejection raises an exception, which rolls back anything the map
-- RPC inserted, so the failure audit must live in its own transaction. Server
-- code calls this after a rejected attempt. action is constrained to the known
-- rejection events so this can never fabricate an arbitrary audit entry.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_record_google_mapping_attempt(
  p_office_id uuid,
  p_action text,
  p_google_location_resource_name text,
  p_detail jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_id uuid;
BEGIN
  IF NOT public.is_admin_session() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_action NOT IN ('GOOGLE_LOCATION_ALREADY_MAPPED','GOOGLE_LOCATION_NOT_FOUND','GOOGLE_LOCATION_VALIDATION_FAILED') THEN
    RAISE EXCEPTION 'Unsupported mapping attempt action: %', p_action;
  END IF;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role, action,
    resource_type, resource_id, after_data
  ) VALUES (
    p_office_id, NULL, v_actor, 'admin', p_action,
    'google_business_location',
    NULLIF(trim(COALESCE(p_google_location_resource_name,'')), ''),
    COALESCE(p_detail, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_record_google_mapping_attempt(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_record_google_mapping_attempt(uuid, text, text, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Write RPC — disconnect the mapping (admin only)
--
-- DARB -> Google is removed. The Google Business Profile itself is never
-- touched. Audit history is preserved (append-only).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_unmap_office_google_location(
  p_office_id uuid
)
RETURNS public.office_google_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_profile public.office_google_profiles%ROWTYPE;
  v_before jsonb;
BEGIN
  IF NOT public.is_admin_session() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM 1 FROM public.offices o
  WHERE o.id = p_office_id AND o.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Office not found';
  END IF;

  SELECT * INTO v_profile
  FROM public.office_google_profiles
  WHERE office_id = p_office_id
  FOR UPDATE;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'No Google profile is linked to this office';
  END IF;

  v_before := to_jsonb(v_profile.*);

  UPDATE public.office_google_profiles SET
    google_account_id = NULL,
    google_location_id = NULL,
    google_location_resource_name = NULL,
    google_place_id = NULL,
    google_maps_url = NULL,
    google_store_code = NULL,
    google_location_name = NULL,
    google_primary_category = NULL,
    google_address_line_1 = NULL,
    google_address_line_2 = NULL,
    google_city = NULL,
    google_postal_code = NULL,
    google_country = NULL,
    google_phone = NULL,
    google_website = NULL,
    google_status = NULL,
    google_verification_state = NULL,
    connection_status = 'not_connected',
    verification_status = 'unverified',
    mapping_status = 'DISCONNECTED',
    mapped_by = NULL,
    mapped_at = NULL,
    updated_at = now()
  WHERE office_id = p_office_id
  RETURNING * INTO v_profile;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role, action,
    resource_type, resource_id, before_data, after_data
  ) VALUES (
    p_office_id, v_before->>'google_location_id', v_actor, 'admin',
    'GOOGLE_LOCATION_UNMAPPED', 'office_google_profile', v_profile.id::text,
    v_before, to_jsonb(v_profile.*)
  );

  RETURN v_profile;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_unmap_office_google_location(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unmap_office_google_location(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Write RPC — record a mapping/validation failure (admin only)
--
-- Lets server code surface "Google says this location is gone" as a first-class
-- MAPPING_ERROR state instead of silently leaving the office "Connected".
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_mark_google_mapping_error(
  p_office_id uuid,
  p_error_code text,
  p_error_message text
)
RETURNS public.office_google_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_profile public.office_google_profiles%ROWTYPE;
  v_before jsonb;
BEGIN
  IF NOT public.is_admin_session() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_profile
  FROM public.office_google_profiles
  WHERE office_id = p_office_id
  FOR UPDATE;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'No Google profile is linked to this office';
  END IF;

  v_before := to_jsonb(v_profile.*);

  UPDATE public.office_google_profiles SET
    mapping_status = CASE WHEN mapping_status = 'MAPPED' THEN mapping_status ELSE 'MAPPING_ERROR' END,
    connection_status = 'error',
    last_error_at = now(),
    last_error_code = NULLIF(trim(COALESCE(p_error_code,'')), ''),
    last_error_message = NULLIF(trim(COALESCE(p_error_message,'')), ''),
    updated_at = now()
  WHERE office_id = p_office_id
  RETURNING * INTO v_profile;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role, action,
    resource_type, resource_id, before_data, after_data
  ) VALUES (
    p_office_id, v_profile.google_location_id, v_actor, 'admin',
    'GOOGLE_LOCATION_VALIDATION_FAILED', 'office_google_profile', v_profile.id::text,
    v_before, to_jsonb(v_profile.*)
  );

  RETURN v_profile;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_mark_google_mapping_error(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_google_mapping_error(uuid, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9. RLS + privileges
--
-- The location cache is admin-only and read through the SECURITY DEFINER RPC,
-- so browser roles get no grant at all on the table itself. raw_location_json
-- is therefore never reachable from the browser.
-- ---------------------------------------------------------------------------

ALTER TABLE public.google_business_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read google business locations" ON public.google_business_locations;
CREATE POLICY "Admins read google business locations"
ON public.google_business_locations FOR SELECT TO authenticated
USING (public.is_admin_session());

REVOKE ALL ON public.google_business_locations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.google_business_locations TO service_role;

-- ---------------------------------------------------------------------------
-- 10. Verification queries (manual, for the deploy checklist)
-- ---------------------------------------------------------------------------
-- A) Berlin -> Berlin OK; Hamburg -> Berlin must raise ALREADY_MAPPED:
--    SELECT public.admin_map_office_google_location(:berlin, :acct, :berlin_loc);
--    SELECT public.admin_map_office_google_location(:hamburg, :acct, :berlin_loc);
-- B) Forged account: same location with a different :acct must raise.
-- C) Non-admin calling any admin_* RPC must raise 'Forbidden'.
-- ===========================================================================
