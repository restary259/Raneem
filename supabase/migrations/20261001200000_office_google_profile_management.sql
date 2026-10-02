-- ===========================================================================
-- PHASE 6 — Google Business Profile Management
--
-- Phase 5 let an operator answer reviews. Phase 6 lets them edit the profile
-- itself: name, description, categories, phone, website, address, hours and
-- attributes — with Google remaining the source of truth.
--
-- Design decisions worth calling out:
--
--   * No parallel `google_business_profiles` table. The Phase 1/3 table
--     `office_google_profiles` already owns the (office -> Google account +
--     location) identity, its uniqueness constraints, its RLS and its audit
--     triggers. Duplicating that identity in a second table would create two
--     places a forged office_id could disagree with. Phase 6 therefore EXTENDS
--     it with the editable, versioned profile fields — exactly the "extend your
--     Google location/profile model" instruction.
--
--   * `google_*` columns stay the raw discovery snapshot (Phase 3). The new
--     unprefixed columns (`business_name`, `phone_primary`, ...) are the
--     canonical DARB profile that the UI edits and that mirrors Google.
--
--   * Google is authoritative. `admin_sync_google_profile` is the canonical
--     Google -> DARB direction. `admin_apply_google_profile_update` is only
--     ever called AFTER Google accepted a write, and it is version-guarded so
--     two operators cannot silently clobber each other.
--
--   * High-risk fields (address, primary category, location mapping) are NOT
--     directly writable by a Primary/Side Manager. They go through
--     `google_profile_change_requests` and require Admin approval.
--
-- Timestamp is newer than 20261001190000 (Phase 5) so this authorizer wins.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Editable, versioned profile columns on the existing mapping row
-- ---------------------------------------------------------------------------

ALTER TABLE public.office_google_profiles
  -- Business information
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS business_description TEXT,
  ADD COLUMN IF NOT EXISTS primary_category TEXT,
  ADD COLUMN IF NOT EXISTS additional_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Contact
  ADD COLUMN IF NOT EXISTS phone_primary TEXT,
  ADD COLUMN IF NOT EXISTS phone_additional JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  -- Location
  ADD COLUMN IF NOT EXISTS address_line_1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line_2 TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6),
  -- Hours + attributes
  ADD COLUMN IF NOT EXISTS regular_hours JSONB,
  ADD COLUMN IF NOT EXISTS special_hours JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Google's own state for the location
  ADD COLUMN IF NOT EXISTS google_state TEXT,
  -- Versioning / conflict detection
  ADD COLUMN IF NOT EXISTS profile_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMPTZ,
  -- Hash of the editable content as last seen from Google. Lets a sync tell
  -- "Google changed" from "DARB changed", and lets the UI flag an external edit.
  ADD COLUMN IF NOT EXISTS profile_synced_hash TEXT,
  ADD COLUMN IF NOT EXISTS profile_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_last_successful_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_sync_error_code TEXT,
  ADD COLUMN IF NOT EXISTS profile_sync_error_message TEXT,
  ADD COLUMN IF NOT EXISTS profile_sync_locked_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 2. High-risk change requests (Admin approval workflow)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.google_profile_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  google_location_id TEXT,
  -- Only the fields Phase 6 classifies as HIGH risk.
  field TEXT NOT NULL CHECK (field IN ('ADDRESS','PRIMARY_CATEGORY','LOCATION_MAPPING')),
  current_value JSONB,
  requested_value JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED','FAILED')),
  reason TEXT,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_role TEXT CHECK (requested_by_role IN ('admin','PRIMARY','SIDE_MANAGER')),
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  applied_at TIMESTAMPTZ,
  apply_error_code TEXT,
  apply_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one open request per office+field: a second submit updates the
-- pending one instead of piling up duplicates for the Admin to triage.
CREATE UNIQUE INDEX IF NOT EXISTS google_profile_change_requests_one_pending_idx
  ON public.google_profile_change_requests (office_id, field)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_google_change_requests_office_created
  ON public.google_profile_change_requests (office_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_change_requests_status
  ON public.google_profile_change_requests (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Idempotency receipts for profile updates
--
-- A mobile retry or a double tap replays the same idempotency_key; the RPC
-- returns the first result instead of publishing a second time.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.google_profile_update_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_hash TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT google_profile_update_receipts_key UNIQUE (office_id, idempotency_key)
);

-- ---------------------------------------------------------------------------
-- 4. Invariant triggers
-- ---------------------------------------------------------------------------

-- A change request's identity is immutable once written: only the decision and
-- application columns may move. This keeps the audit trail honest even if a
-- future RPC forgets a guard.
CREATE OR REPLACE FUNCTION public.validate_google_change_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.requested_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Change request must be attributed to the caller'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Identity is immutable: the office, field and requester can never move.
    IF NEW.office_id IS DISTINCT FROM OLD.office_id
       OR NEW.field IS DISTINCT FROM OLD.field
       OR NEW.requested_by IS DISTINCT FROM OLD.requested_by THEN
      RAISE EXCEPTION 'A change request''s subject cannot be rewritten'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    -- The requested value may be revised only while the request is still open;
    -- once decided, what was approved is frozen.
    IF OLD.status <> 'PENDING'
       AND NEW.requested_value IS DISTINCT FROM OLD.requested_value THEN
      RAISE EXCEPTION 'A decided change request cannot be rewritten'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF OLD.status <> 'PENDING' AND NEW.status = 'PENDING' THEN
      RAISE EXCEPTION 'A decided change request cannot be reopened'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'google_profile_change_requests is not deletable'
    USING ERRCODE = 'insufficient_privilege';
END;
$fn$;

REVOKE ALL ON FUNCTION public.validate_google_change_request() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_google_change_request() TO service_role;

DROP TRIGGER IF EXISTS trg_validate_google_change_request ON public.google_profile_change_requests;
CREATE TRIGGER trg_validate_google_change_request
BEFORE INSERT OR UPDATE OR DELETE
ON public.google_profile_change_requests
FOR EACH ROW EXECUTE FUNCTION public.validate_google_change_request();

-- ---------------------------------------------------------------------------
-- 5. Canonical content hash
--
-- jsonb text output is canonical (keys sorted, whitespace removed), so md5 of
-- it is a stable fingerprint of the editable profile. Used to tell an external
-- Google edit from a DARB edit.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.google_profile_hash(p_profile jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT md5(COALESCE(p_profile, '{}'::jsonb)::text);
$fn$;

REVOKE ALL ON FUNCTION public.google_profile_hash(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.google_profile_hash(jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Authorizer — Phase 6 actions
--
-- Full redefinition (Phase 5 body) plus the profile-management actions. One
-- function remains the single source of truth for every Google action.
--
-- Risk classification drives the rules:
--   LOW     (name, description, phone, website) -> operators may write directly
--   MEDIUM  (hours, attributes, additional categories) -> operators may write
--   HIGH    (primary category, address, mapping) -> operators may only REQUEST;
--           direct execution is Admin-only
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
    'GOOGLE_UPDATE_HOURS',
    'GOOGLE_UPDATE_ATTRIBUTES',
    'GOOGLE_MANAGE_MEDIA',
    'GOOGLE_MANAGE_POSTS',
    'GOOGLE_VIEW_INSIGHTS',
    'GOOGLE_MANAGE_SUPPORTED_CONTENT',
    -- Phase 5 operational
    'GOOGLE_SYNC_REVIEWS',
    -- Phase 6 operational
    'GOOGLE_SYNC_PROFILE',
    'GOOGLE_REQUEST_HIGH_RISK',
    -- Phase 6 high-risk direct execution (Admin only)
    'GOOGLE_UPDATE_CATEGORY',
    'GOOGLE_UPDATE_ADDRESS',
    'GOOGLE_APPROVE_CHANGE_REQUEST',
    -- Delegation
    'GOOGLE_ASSIGN_SIDE_MANAGER',
    'GOOGLE_REMOVE_SIDE_MANAGER',
    'GOOGLE_CHANGE_PRIMARY',
    -- Admin-only connection controls
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

  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  IF public.is_admin_session() THEN
    RETURN EXISTS (
      SELECT 1 FROM public.offices o
      WHERE o.id = p_office_id AND o.deleted_at IS NULL
    );
  END IF;

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

  -- Never available to a non-admin operator, whatever their role.
  IF p_action IN (
    'GOOGLE_CHANGE_PRIMARY',
    'GOOGLE_CONNECT',
    'GOOGLE_DISCONNECT',
    'GOOGLE_RECONNECT',
    'GOOGLE_DISCOVER_LOCATIONS',
    'GOOGLE_VIEW_LOCATION',
    'GOOGLE_MAP_LOCATION',
    'GOOGLE_REMAP_LOCATION',
    'GOOGLE_UNMAP_LOCATION',
    -- High-risk direct execution: operators must request approval instead.
    'GOOGLE_UPDATE_CATEGORY',
    'GOOGLE_UPDATE_ADDRESS',
    'GOOGLE_APPROVE_CHANGE_REQUEST'
  ) THEN
    RETURN false;
  END IF;

  IF p_action IN ('GOOGLE_ASSIGN_SIDE_MANAGER','GOOGLE_REMOVE_SIDE_MANAGER') THEN
    RETURN v_operator_role = 'PRIMARY';
  END IF;

  RETURN COALESCE(v_operator_role IN ('PRIMARY','SIDE_MANAGER'), false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.authorize_google_office_action(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_google_office_action(uuid, uuid, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Canonical editable-content snapshot
--
-- One place decides what "the profile content" means, so the sync hash, the
-- change detector and the version bump all agree on the same field set.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.google_profile_content(
  p_business_name text,
  p_business_description text,
  p_primary_category text,
  p_additional_categories jsonb,
  p_phone_primary text,
  p_phone_additional jsonb,
  p_website_url text,
  p_address_line_1 text,
  p_address_line_2 text,
  p_postal_code text,
  p_city text,
  p_region text,
  p_country text,
  p_regular_hours jsonb,
  p_special_hours jsonb,
  p_attributes jsonb
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'business_name', p_business_name,
    'business_description', p_business_description,
    'primary_category', p_primary_category,
    'additional_categories', COALESCE(p_additional_categories, '[]'::jsonb),
    'phone_primary', p_phone_primary,
    'phone_additional', COALESCE(p_phone_additional, '[]'::jsonb),
    'website_url', p_website_url,
    'address_line_1', p_address_line_1,
    'address_line_2', p_address_line_2,
    'postal_code', p_postal_code,
    'city', p_city,
    'region', p_region,
    'country', p_country,
    'regular_hours', p_regular_hours,
    'special_hours', COALESCE(p_special_hours, '[]'::jsonb),
    'attributes', COALESCE(p_attributes, '[]'::jsonb)
  );
$fn$;

REVOKE ALL ON FUNCTION public.google_profile_content(text,text,text,jsonb,text,jsonb,text,text,text,text,text,text,text,jsonb,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.google_profile_content(text,text,text,jsonb,text,jsonb,text,text,text,text,text,text,text,jsonb,jsonb,jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Read RPC — the profile the UI edits
--
-- Admin or an operator of the office only. Returns the editable profile, the
-- Google identifiers, the version (for optimistic concurrency) and the sync
-- state (for the header + health badge).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_office_google_profile(p_office_id uuid)
RETURNS TABLE (
  office_id uuid,
  office_name text,
  mapping_status text,
  connection_status text,
  verification_status text,
  google_account_id text,
  google_location_id text,
  google_location_resource_name text,
  google_location_name text,
  google_place_id text,
  google_maps_url text,
  google_state text,
  business_name text,
  business_description text,
  primary_category text,
  additional_categories jsonb,
  phone_primary text,
  phone_additional jsonb,
  website_url text,
  address_line_1 text,
  address_line_2 text,
  postal_code text,
  city text,
  region text,
  country text,
  latitude numeric,
  longitude numeric,
  regular_hours jsonb,
  special_hours jsonb,
  attributes jsonb,
  profile_version integer,
  profile_updated_at timestamptz,
  profile_last_synced_at timestamptz,
  profile_last_successful_sync_at timestamptz,
  profile_sync_error_code text,
  profile_sync_error_message text,
  primary_operator_id uuid,
  primary_operator_name text,
  side_manager_id uuid,
  side_manager_name text,
  pending_change_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_VIEW')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    ogp.office_id,
    COALESCE(NULLIF(o.name_en, ''), o.name_ar),
    ogp.mapping_status,
    ogp.connection_status,
    ogp.verification_status,
    ogp.google_account_id,
    ogp.google_location_id,
    ogp.google_location_resource_name,
    ogp.google_location_name,
    ogp.google_place_id,
    ogp.google_maps_url,
    ogp.google_state,
    ogp.business_name,
    ogp.business_description,
    ogp.primary_category,
    ogp.additional_categories,
    ogp.phone_primary,
    ogp.phone_additional,
    ogp.website_url,
    ogp.address_line_1,
    ogp.address_line_2,
    ogp.postal_code,
    ogp.city,
    ogp.region,
    ogp.country,
    ogp.latitude,
    ogp.longitude,
    ogp.regular_hours,
    ogp.special_hours,
    ogp.attributes,
    ogp.profile_version,
    ogp.profile_updated_at,
    ogp.profile_last_synced_at,
    ogp.profile_last_successful_sync_at,
    ogp.profile_sync_error_code,
    ogp.profile_sync_error_message,
    p.id, p.full_name,
    s.id, s.full_name,
    (SELECT count(*)::integer FROM public.google_profile_change_requests r
      WHERE r.office_id = p_office_id AND r.status = 'PENDING')
  FROM public.office_google_profiles ogp
  JOIN public.offices o ON o.id = ogp.office_id
  LEFT JOIN public.office_google_operators po
    ON po.office_id = ogp.office_id AND po.role = 'PRIMARY'
  LEFT JOIN public.profiles p ON p.id = po.team_member_id
  LEFT JOIN public.office_google_operators so
    ON so.office_id = ogp.office_id AND so.role = 'SIDE_MANAGER'
  LEFT JOIN public.profiles s ON s.id = so.team_member_id
  WHERE ogp.office_id = p_office_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_office_google_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_office_google_profile(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9. Sync lock — one profile sync per office at a time
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.acquire_google_profile_sync_lock(
  p_office_id uuid,
  p_stale_after_seconds integer DEFAULT 120
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_acquired boolean;
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_SYNC_PROFILE')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.office_google_profiles
  SET profile_sync_locked_at = now(),
      updated_at = now()
  WHERE office_id = p_office_id
    AND (
      profile_sync_locked_at IS NULL
      OR profile_sync_locked_at < now() - make_interval(secs => GREATEST(p_stale_after_seconds, 30))
    )
  RETURNING true INTO v_acquired;

  RETURN COALESCE(v_acquired, false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.acquire_google_profile_sync_lock(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acquire_google_profile_sync_lock(uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.release_google_profile_sync_lock(p_office_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_SYNC_PROFILE')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.office_google_profiles
  SET profile_sync_locked_at = NULL,
      updated_at = now()
  WHERE office_id = p_office_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.release_google_profile_sync_lock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_google_profile_sync_lock(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 10. Write RPC — Google -> DARB (canonical sync direction)
--
-- Google is authoritative. This applies a fresh Google snapshot, but NEVER
-- silently overwrites a profile that changed on Google since DARB last agreed
-- with it: when the incoming content hash differs from the stored synced hash,
-- it reports `external_change` and hands the Google values back to the UI for a
-- human decision. `p_force` is how the operator accepts Google's version.
--
-- `p_profile` carries the normalized Google values. The office mapping stays the
-- authority for account/location, so those are read from the row, not the input.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_sync_google_profile(
  p_office_id uuid,
  p_profile jsonb,
  p_force boolean DEFAULT false
)
RETURNS TABLE (
  status text,
  profile_version integer,
  changed_fields jsonb,
  google_values jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_row public.office_google_profiles%ROWTYPE;
  v_incoming jsonb;
  v_current jsonb;
  v_incoming_hash text;
  v_changed jsonb;
  v_changed_keys text[];
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_SYNC_PROFILE')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_row
  FROM public.office_google_profiles
  WHERE office_id = p_office_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_mapped'::text, NULL::integer, '[]'::jsonb, NULL::jsonb;
    RETURN;
  END IF;

  -- Google's normalized values, defaulting to the current DARB values when the
  -- snapshot omits a field (Google only returns what the read mask asked for).
  v_incoming := public.google_profile_content(
    COALESCE(p_profile->>'business_name', v_row.business_name),
    COALESCE(p_profile->>'business_description', v_row.business_description),
    COALESCE(p_profile->>'primary_category', v_row.primary_category),
    COALESCE(p_profile->'additional_categories', v_row.additional_categories),
    COALESCE(p_profile->>'phone_primary', v_row.phone_primary),
    COALESCE(p_profile->'phone_additional', v_row.phone_additional),
    COALESCE(p_profile->>'website_url', v_row.website_url),
    COALESCE(p_profile->>'address_line_1', v_row.address_line_1),
    COALESCE(p_profile->>'address_line_2', v_row.address_line_2),
    COALESCE(p_profile->>'postal_code', v_row.postal_code),
    COALESCE(p_profile->>'city', v_row.city),
    COALESCE(p_profile->>'region', v_row.region),
    COALESCE(p_profile->>'country', v_row.country),
    COALESCE(p_profile->'regular_hours', v_row.regular_hours),
    COALESCE(p_profile->'special_hours', v_row.special_hours),
    COALESCE(p_profile->'attributes', v_row.attributes)
  );

  v_current := public.google_profile_content(
    v_row.business_name, v_row.business_description, v_row.primary_category,
    v_row.additional_categories, v_row.phone_primary, v_row.phone_additional,
    v_row.website_url, v_row.address_line_1, v_row.address_line_2,
    v_row.postal_code, v_row.city, v_row.region, v_row.country,
    v_row.regular_hours, v_row.special_hours, v_row.attributes
  );

  v_incoming_hash := public.google_profile_hash(v_incoming);

  -- Diff of the incoming Google values against what DARB currently holds.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'field', k,
           'darb', v_current->k,
           'google', v_incoming->k
         )), '[]'::jsonb),
         COALESCE(array_agg(k) FILTER (WHERE v_current->k IS DISTINCT FROM v_incoming->k), ARRAY[]::text[])
  INTO v_changed, v_changed_keys
  FROM jsonb_object_keys(v_incoming) AS k;

  -- Freshness only: nothing actually differs from what DARB already has.
  IF v_incoming_hash = public.google_profile_hash(v_current) THEN
    UPDATE public.office_google_profiles
    SET profile_synced_hash = v_incoming_hash,
        profile_last_synced_at = now(),
        profile_last_successful_sync_at = now(),
        profile_sync_error_code = NULL,
        profile_sync_error_message = NULL,
        profile_sync_locked_at = NULL,
        google_state = COALESCE(p_profile->>'google_state', google_state),
        verification_status = COALESCE(p_profile->>'verification_status', verification_status),
        updated_at = now()
    WHERE office_id = p_office_id;

    RETURN QUERY SELECT 'unchanged'::text, v_row.profile_version, '[]'::jsonb, '{}'::jsonb;
    RETURN;
  END IF;

  -- Google changed since DARB last agreed with it, and the caller did not ask to
  -- accept it. Report the difference; do not overwrite.
  IF NOT p_force
     AND v_row.profile_synced_hash IS NOT NULL
     AND v_row.profile_synced_hash <> v_incoming_hash THEN
    UPDATE public.office_google_profiles
    SET profile_last_synced_at = now(),
        profile_sync_locked_at = NULL,
        updated_at = now()
    WHERE office_id = p_office_id;

    RETURN QUERY SELECT 'external_change'::text, v_row.profile_version, v_changed, v_incoming;
    RETURN;
  END IF;

  -- Apply Google's version.
  UPDATE public.office_google_profiles
  SET business_name = v_incoming->>'business_name',
      business_description = v_incoming->>'business_description',
      primary_category = v_incoming->>'primary_category',
      additional_categories = COALESCE(v_incoming->'additional_categories', '[]'::jsonb),
      phone_primary = v_incoming->>'phone_primary',
      phone_additional = COALESCE(v_incoming->'phone_additional', '[]'::jsonb),
      website_url = v_incoming->>'website_url',
      address_line_1 = v_incoming->>'address_line_1',
      address_line_2 = v_incoming->>'address_line_2',
      postal_code = v_incoming->>'postal_code',
      city = v_incoming->>'city',
      region = v_incoming->>'region',
      country = v_incoming->>'country',
      latitude = COALESCE((p_profile->>'latitude')::numeric, latitude),
      longitude = COALESCE((p_profile->>'longitude')::numeric, longitude),
      regular_hours = v_incoming->'regular_hours',
      special_hours = COALESCE(v_incoming->'special_hours', '[]'::jsonb),
      attributes = COALESCE(v_incoming->'attributes', '[]'::jsonb),
      google_state = COALESCE(p_profile->>'google_state', google_state),
      verification_status = COALESCE(p_profile->>'verification_status', verification_status),
      profile_version = office_google_profiles.profile_version + 1,
      profile_updated_at = now(),
      profile_synced_hash = v_incoming_hash,
      profile_last_synced_at = now(),
      profile_last_successful_sync_at = now(),
      profile_sync_error_code = NULL,
      profile_sync_error_message = NULL,
      profile_sync_locked_at = NULL,
      updated_at = now()
  WHERE office_id = p_office_id
  RETURNING office_google_profiles.profile_version INTO v_row.profile_version;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, resource_id, before_data, after_data
  )
  VALUES (
    p_office_id, v_row.google_location_id, v_actor,
    CASE WHEN public.is_admin_session() THEN 'admin' ELSE 'PRIMARY' END,
    'GOOGLE_PROFILE_SYNCED', 'profile', p_office_id::text,
    jsonb_build_object('changed', v_changed_keys),
    jsonb_build_object('changed', v_changed_keys, 'forced', p_force)
  );

  RETURN QUERY SELECT 'synced'::text, v_row.profile_version, v_changed, v_incoming;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_sync_google_profile(uuid, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_sync_google_profile(uuid, jsonb, boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 11. Write RPC — record a profile sync failure (releases the lock)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_mark_google_profile_sync_error(
  p_office_id uuid,
  p_error_code text,
  p_error_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_SYNC_PROFILE')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.office_google_profiles
  SET profile_sync_error_code = left(COALESCE(p_error_code, 'error'), 64),
      profile_sync_error_message = left(COALESCE(p_error_message, 'Sync failed'), 500),
      profile_sync_locked_at = NULL,
      updated_at = now()
  WHERE office_id = p_office_id;

  INSERT INTO public.google_business_activity (
    office_id, actor_user_id, actor_role, action, resource_type, after_data
  )
  VALUES (
    p_office_id, v_actor,
    CASE WHEN public.is_admin_session() THEN 'admin' ELSE 'PRIMARY' END,
    'GOOGLE_PROFILE_ACTION_FAILED', 'profile',
    jsonb_build_object('operation', 'sync',
                       'code', left(COALESCE(p_error_code,'error'), 64),
                       'message', left(COALESCE(p_error_message,'Sync failed'), 500))
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_mark_google_profile_sync_error(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_google_profile_sync_error(uuid, text, text) TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 12. Server-side field validation
--
-- The UI validates too, but validation is a security boundary: a forged client
-- must not be able to store `javascript:` as the website or `abc123` as the
-- phone. Returns an error code, or NULL when the value is acceptable.
--
-- Lengths use octet_length because Google's limits are BYTES — an Arabic
-- description costs ~2 bytes per character.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.google_profile_field_error(
  p_field text,
  p_value jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
  v_text text;
  v_day text;
  v_period jsonb;
  v_item jsonb;
  v_n integer;
BEGIN
  -- A null value means "clear this field", which is only allowed where Google
  -- permits an empty value (description, additional phone/categories).
  IF p_value IS NULL OR p_value = 'null'::jsonb THEN
    IF p_field IN ('business_name','primary_category','phone_primary','website_url','address_line_1','city','country') THEN
      RETURN 'required';
    END IF;
    RETURN NULL;
  END IF;

  IF p_field IN ('business_name','business_description','phone_primary','website_url',
                 'address_line_1','address_line_2','postal_code','city','region','country',
                 'primary_category') THEN
    IF jsonb_typeof(p_value) <> 'string' THEN
      RETURN 'invalid_type';
    END IF;
    v_text := btrim(p_value #>> '{}');
  END IF;

  IF p_field = 'business_name' THEN
    IF char_length(v_text) < 1 THEN RETURN 'required'; END IF;
    IF char_length(v_text) > 750 THEN RETURN 'too_long'; END IF;
    RETURN NULL;
  END IF;

  IF p_field = 'business_description' THEN
    IF octet_length(v_text) > 750 THEN RETURN 'too_long'; END IF;
    RETURN NULL;
  END IF;

  IF p_field = 'primary_category' THEN
    IF char_length(v_text) < 1 THEN RETURN 'required'; END IF;
    IF char_length(v_text) > 200 THEN RETURN 'too_long'; END IF;
    RETURN NULL;
  END IF;

  IF p_field = 'phone_primary' THEN
    -- International format only: an optional +, then digits/spaces/()/-. Must
    -- carry at least 6 digits so "abc123" and "" are rejected.
    IF v_text !~ '^\+?[0-9 ()./-]{6,25}$' THEN RETURN 'invalid_phone'; END IF;
    IF (SELECT count(*) FROM regexp_matches(v_text, '[0-9]', 'g')) < 6 THEN
      RETURN 'invalid_phone';
    END IF;
    RETURN NULL;
  END IF;

  IF p_field = 'website_url' THEN
    -- HTTPS only, with a host. Rejects javascript:, data:, and bare paths.
    IF v_text !~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}(:[0-9]{1,5})?(/.*)?$' THEN
      RETURN 'invalid_url';
    END IF;
    RETURN NULL;
  END IF;

  IF p_field IN ('address_line_1','city','country') THEN
    IF char_length(v_text) < 1 THEN RETURN 'required'; END IF;
    IF char_length(v_text) > 200 THEN RETURN 'too_long'; END IF;
    RETURN NULL;
  END IF;

  IF p_field IN ('address_line_2','postal_code','region') THEN
    IF char_length(v_text) > 200 THEN RETURN 'too_long'; END IF;
    RETURN NULL;
  END IF;

  IF p_field = 'additional_categories' THEN
    IF jsonb_typeof(p_value) <> 'array' THEN RETURN 'invalid_type'; END IF;
    v_n := jsonb_array_length(p_value);
    -- Google allows up to 9 additional categories.
    IF v_n > 9 THEN RETURN 'too_many'; END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_value) LOOP
      IF jsonb_typeof(v_item) <> 'string' OR char_length(btrim(v_item #>> '{}')) = 0 THEN
        RETURN 'invalid_type';
      END IF;
    END LOOP;
    RETURN NULL;
  END IF;

  IF p_field = 'phone_additional' THEN
    IF jsonb_typeof(p_value) <> 'array' THEN RETURN 'invalid_type'; END IF;
    IF jsonb_array_length(p_value) > 3 THEN RETURN 'too_many'; END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_value) LOOP
      IF jsonb_typeof(v_item) <> 'string'
         OR btrim(v_item #>> '{}') !~ '^\+?[0-9 ()./-]{6,25}$' THEN
        RETURN 'invalid_phone';
      END IF;
    END LOOP;
    RETURN NULL;
  END IF;

  IF p_field = 'regular_hours' THEN
    -- Object keyed by weekday; each value is null (closed / not configured) or
    -- an array of {open, close} periods in 24h HH:MM.
    IF jsonb_typeof(p_value) <> 'object' THEN RETURN 'invalid_type'; END IF;
    FOR v_day IN SELECT jsonb_object_keys(p_value) LOOP
      IF v_day NOT IN ('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY') THEN
        RETURN 'invalid_weekday';
      END IF;
      IF p_value->v_day IS NULL OR jsonb_typeof(p_value->v_day) = 'null' THEN
        CONTINUE;
      END IF;
      IF jsonb_typeof(p_value->v_day) <> 'array' THEN RETURN 'invalid_type'; END IF;
      IF jsonb_array_length(p_value->v_day) > 4 THEN RETURN 'too_many'; END IF;
      FOR v_period IN SELECT * FROM jsonb_array_elements(p_value->v_day) LOOP
        IF (v_period->>'open') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
           OR (v_period->>'close') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
          RETURN 'invalid_time';
        END IF;
        IF (v_period->>'close') <= (v_period->>'open') THEN
          RETURN 'invalid_range';
        END IF;
      END LOOP;
    END LOOP;
    RETURN NULL;
  END IF;

  IF p_field = 'special_hours' THEN
    IF jsonb_typeof(p_value) <> 'array' THEN RETURN 'invalid_type'; END IF;
    IF jsonb_array_length(p_value) > 200 THEN RETURN 'too_many'; END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_value) LOOP
      IF (v_item->>'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
        RETURN 'invalid_date';
      END IF;
      IF COALESCE((v_item->>'closed')::boolean, false) = false THEN
        IF jsonb_typeof(v_item->'periods') <> 'array'
           OR jsonb_array_length(v_item->'periods') = 0 THEN
          RETURN 'invalid_range';
        END IF;
      END IF;
    END LOOP;
    RETURN NULL;
  END IF;

  IF p_field = 'attributes' THEN
    IF jsonb_typeof(p_value) <> 'array' THEN RETURN 'invalid_type'; END IF;
    IF jsonb_array_length(p_value) > 100 THEN RETURN 'too_many'; END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_value) LOOP
      IF jsonb_typeof(v_item) <> 'string' THEN RETURN 'invalid_type'; END IF;
    END LOOP;
    RETURN NULL;
  END IF;

  IF p_field = 'latitude' THEN
    IF (p_value #>> '{}')::numeric NOT BETWEEN -90 AND 90 THEN RETURN 'invalid_range'; END IF;
    RETURN NULL;
  END IF;

  IF p_field = 'longitude' THEN
    IF (p_value #>> '{}')::numeric NOT BETWEEN -180 AND 180 THEN RETURN 'invalid_range'; END IF;
    RETURN NULL;
  END IF;

  RETURN NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.google_profile_field_error(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.google_profile_field_error(text, jsonb) TO authenticated, service_role;

-- The set of fields Phase 6 classifies as HIGH risk (Admin-only to publish).
CREATE OR REPLACE FUNCTION public.google_profile_high_risk_fields()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT ARRAY[
    'primary_category',
    'address_line_1','address_line_2','postal_code','city','region','country',
    'latitude','longitude'
  ];
$fn$;

REVOKE ALL ON FUNCTION public.google_profile_high_risk_fields() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.google_profile_high_risk_fields() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 13. Write RPC — DARB -> Google (persist AFTER Google accepted)
--
-- Called by server code only after Google confirms the update. It re-checks
-- authorization, re-validates every field, enforces optimistic concurrency
-- (expected_version) and idempotency (idempotency_key), and writes a
-- field-level audit event.
--
-- Risk is derived from the fields present in `p_fields`, never from a caller
-- supplied label, so a forged payload cannot downgrade a high-risk edit.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_apply_google_profile_update(
  p_office_id uuid,
  p_fields jsonb,
  p_expected_version integer DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_google_status integer DEFAULT NULL
)
RETURNS TABLE (
  ok boolean,
  status text,
  profile_version integer,
  applied_fields jsonb,
  error_code text,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_row public.office_google_profiles%ROWTYPE;
  v_key text;
  v_value jsonb;
  v_err text;
  v_errors jsonb := '[]'::jsonb;
  v_keys text[] := ARRAY[]::text[];
  v_high boolean := false;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_receipt public.google_profile_update_receipts%ROWTYPE;
  v_hash text;
  v_result jsonb;
BEGIN
  IF p_fields IS NULL OR jsonb_typeof(p_fields) <> 'object' OR p_fields = '{}'::jsonb THEN
    RETURN QUERY SELECT false, 'invalid'::text, NULL::integer, '[]'::jsonb,
      'empty'::text, 'No fields supplied'::text;
    RETURN;
  END IF;

  v_keys := ARRAY(SELECT jsonb_object_keys(p_fields));
  v_high := v_keys && public.google_profile_high_risk_fields();

  -- Authorization: high-risk needs the admin-only action.
  IF v_high THEN
    IF NOT (
      public.is_admin_session()
      OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_UPDATE_CATEGORY')
      OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_UPDATE_ADDRESS')
    ) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  ELSE
    IF NOT (
      public.is_admin_session()
      OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_UPDATE_PROFILE')
    ) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  SELECT * INTO v_row
  FROM public.office_google_profiles
  WHERE office_id = p_office_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'not_mapped'::text, NULL::integer, '[]'::jsonb,
      'not_mapped'::text, 'Office has no Google profile'::text;
    RETURN;
  END IF;

  -- Validate every supplied field before touching anything.
  FOR v_key IN SELECT unnest(v_keys) LOOP
    IF v_key NOT IN (
      'business_name','business_description','primary_category','additional_categories',
      'phone_primary','phone_additional','website_url',
      'address_line_1','address_line_2','postal_code','city','region','country',
      'latitude','longitude','regular_hours','special_hours','attributes'
    ) THEN
      v_errors := v_errors || jsonb_build_object('field', v_key, 'code', 'unknown_field');
      CONTINUE;
    END IF;
    v_err := public.google_profile_field_error(v_key, p_fields->v_key);
    IF v_err IS NOT NULL THEN
      v_errors := v_errors || jsonb_build_object('field', v_key, 'code', v_err);
    END IF;
  END LOOP;

  IF jsonb_array_length(v_errors) > 0 THEN
    RETURN QUERY SELECT false, 'invalid'::text, v_row.profile_version, v_errors,
      'validation_failed'::text, 'One or more fields are invalid'::text;
    RETURN;
  END IF;

  -- Idempotency: a replayed key returns the first result unchanged.
  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    v_hash := public.google_profile_hash(p_fields);
    SELECT * INTO v_receipt
    FROM public.google_profile_update_receipts
    WHERE office_id = p_office_id AND idempotency_key = btrim(p_idempotency_key);

    IF FOUND THEN
      IF v_receipt.request_hash <> v_hash THEN
        RETURN QUERY SELECT false, 'idempotency_conflict'::text, v_row.profile_version,
          '[]'::jsonb, 'idempotency_conflict'::text,
          'This idempotency key was used for a different change'::text;
        RETURN;
      END IF;
      RETURN QUERY
      SELECT true, 'duplicate'::text, v_row.profile_version,
        COALESCE(v_receipt.result->'applied_fields', '[]'::jsonb),
        NULL::text, NULL::text;
      RETURN;
    END IF;
  END IF;

  -- Optimistic concurrency: the caller must be editing the version it loaded.
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_row.profile_version THEN
    RETURN QUERY SELECT false, 'conflict'::text, v_row.profile_version,
      '[]'::jsonb, 'version_conflict'::text,
      'Profile changed since you opened it. Refresh before saving.'::text;
    RETURN;
  END IF;

  -- Build the compact before/after audit payloads.
  FOR v_key IN SELECT unnest(v_keys) LOOP
    v_value := p_fields->v_key;
    v_before := v_before || jsonb_build_object(v_key,
      CASE v_key
        WHEN 'business_name' THEN to_jsonb(v_row.business_name)
        WHEN 'business_description' THEN to_jsonb(left(v_row.business_description, 120))
        WHEN 'primary_category' THEN to_jsonb(v_row.primary_category)
        WHEN 'additional_categories' THEN v_row.additional_categories
        WHEN 'phone_primary' THEN to_jsonb(v_row.phone_primary)
        WHEN 'phone_additional' THEN v_row.phone_additional
        WHEN 'website_url' THEN to_jsonb(v_row.website_url)
        WHEN 'address_line_1' THEN to_jsonb(v_row.address_line_1)
        WHEN 'address_line_2' THEN to_jsonb(v_row.address_line_2)
        WHEN 'postal_code' THEN to_jsonb(v_row.postal_code)
        WHEN 'city' THEN to_jsonb(v_row.city)
        WHEN 'region' THEN to_jsonb(v_row.region)
        WHEN 'country' THEN to_jsonb(v_row.country)
        WHEN 'latitude' THEN to_jsonb(v_row.latitude)
        WHEN 'longitude' THEN to_jsonb(v_row.longitude)
        WHEN 'regular_hours' THEN v_row.regular_hours
        WHEN 'special_hours' THEN v_row.special_hours
        WHEN 'attributes' THEN v_row.attributes
      END);
    -- Descriptions are truncated in the audit; the full public text is not a
    -- secret but duplicating kilobytes per event is not useful either.
    v_after := v_after || jsonb_build_object(v_key,
      CASE WHEN v_key = 'business_description' THEN to_jsonb(left(v_value #>> '{}', 120))
           ELSE v_value END);
  END LOOP;

  UPDATE public.office_google_profiles
  SET business_name = CASE WHEN p_fields ? 'business_name' THEN NULLIF(btrim(p_fields->>'business_name'),'') ELSE business_name END,
      business_description = CASE WHEN p_fields ? 'business_description' THEN NULLIF(btrim(p_fields->>'business_description'),'') ELSE business_description END,
      primary_category = CASE WHEN p_fields ? 'primary_category' THEN NULLIF(btrim(p_fields->>'primary_category'),'') ELSE primary_category END,
      additional_categories = CASE WHEN p_fields ? 'additional_categories' THEN COALESCE(p_fields->'additional_categories','[]'::jsonb) ELSE additional_categories END,
      phone_primary = CASE WHEN p_fields ? 'phone_primary' THEN NULLIF(btrim(p_fields->>'phone_primary'),'') ELSE phone_primary END,
      phone_additional = CASE WHEN p_fields ? 'phone_additional' THEN COALESCE(p_fields->'phone_additional','[]'::jsonb) ELSE phone_additional END,
      website_url = CASE WHEN p_fields ? 'website_url' THEN NULLIF(btrim(p_fields->>'website_url'),'') ELSE website_url END,
      address_line_1 = CASE WHEN p_fields ? 'address_line_1' THEN NULLIF(btrim(p_fields->>'address_line_1'),'') ELSE address_line_1 END,
      address_line_2 = CASE WHEN p_fields ? 'address_line_2' THEN NULLIF(btrim(p_fields->>'address_line_2'),'') ELSE address_line_2 END,
      postal_code = CASE WHEN p_fields ? 'postal_code' THEN NULLIF(btrim(p_fields->>'postal_code'),'') ELSE postal_code END,
      city = CASE WHEN p_fields ? 'city' THEN NULLIF(btrim(p_fields->>'city'),'') ELSE city END,
      region = CASE WHEN p_fields ? 'region' THEN NULLIF(btrim(p_fields->>'region'),'') ELSE region END,
      country = CASE WHEN p_fields ? 'country' THEN NULLIF(btrim(p_fields->>'country'),'') ELSE country END,
      latitude = CASE WHEN p_fields ? 'latitude' THEN (p_fields->>'latitude')::numeric ELSE latitude END,
      longitude = CASE WHEN p_fields ? 'longitude' THEN (p_fields->>'longitude')::numeric ELSE longitude END,
      regular_hours = CASE WHEN p_fields ? 'regular_hours' THEN p_fields->'regular_hours' ELSE regular_hours END,
      special_hours = CASE WHEN p_fields ? 'special_hours' THEN COALESCE(p_fields->'special_hours','[]'::jsonb) ELSE special_hours END,
      attributes = CASE WHEN p_fields ? 'attributes' THEN COALESCE(p_fields->'attributes','[]'::jsonb) ELSE attributes END,
      profile_version = office_google_profiles.profile_version + 1,
      profile_updated_at = now(),
      -- DARB and Google now agree, so the synced hash tracks the new content.
      profile_synced_hash = public.google_profile_hash(public.google_profile_content(
        CASE WHEN p_fields ? 'business_name' THEN NULLIF(btrim(p_fields->>'business_name'),'') ELSE business_name END,
        CASE WHEN p_fields ? 'business_description' THEN NULLIF(btrim(p_fields->>'business_description'),'') ELSE business_description END,
        CASE WHEN p_fields ? 'primary_category' THEN NULLIF(btrim(p_fields->>'primary_category'),'') ELSE primary_category END,
        CASE WHEN p_fields ? 'additional_categories' THEN COALESCE(p_fields->'additional_categories','[]'::jsonb) ELSE additional_categories END,
        CASE WHEN p_fields ? 'phone_primary' THEN NULLIF(btrim(p_fields->>'phone_primary'),'') ELSE phone_primary END,
        CASE WHEN p_fields ? 'phone_additional' THEN COALESCE(p_fields->'phone_additional','[]'::jsonb) ELSE phone_additional END,
        CASE WHEN p_fields ? 'website_url' THEN NULLIF(btrim(p_fields->>'website_url'),'') ELSE website_url END,
        CASE WHEN p_fields ? 'address_line_1' THEN NULLIF(btrim(p_fields->>'address_line_1'),'') ELSE address_line_1 END,
        CASE WHEN p_fields ? 'address_line_2' THEN NULLIF(btrim(p_fields->>'address_line_2'),'') ELSE address_line_2 END,
        CASE WHEN p_fields ? 'postal_code' THEN NULLIF(btrim(p_fields->>'postal_code'),'') ELSE postal_code END,
        CASE WHEN p_fields ? 'city' THEN NULLIF(btrim(p_fields->>'city'),'') ELSE city END,
        CASE WHEN p_fields ? 'region' THEN NULLIF(btrim(p_fields->>'region'),'') ELSE region END,
        CASE WHEN p_fields ? 'country' THEN NULLIF(btrim(p_fields->>'country'),'') ELSE country END,
        CASE WHEN p_fields ? 'regular_hours' THEN p_fields->'regular_hours' ELSE regular_hours END,
        CASE WHEN p_fields ? 'special_hours' THEN COALESCE(p_fields->'special_hours','[]'::jsonb) ELSE special_hours END,
        CASE WHEN p_fields ? 'attributes' THEN COALESCE(p_fields->'attributes','[]'::jsonb) ELSE attributes END
      )),
      updated_at = now()
  WHERE office_id = p_office_id
  RETURNING office_google_profiles.profile_version INTO v_row.profile_version;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, resource_id, before_data, after_data
  )
  VALUES (
    p_office_id, v_row.google_location_id, v_actor,
    CASE WHEN public.is_admin_session() THEN 'admin'
         WHEN EXISTS (SELECT 1 FROM public.office_google_operators o
                      WHERE o.office_id = p_office_id AND o.team_member_id = v_actor AND o.role = 'PRIMARY')
           THEN 'PRIMARY' ELSE 'SIDE_MANAGER' END,
    'GOOGLE_PROFILE_UPDATED', 'profile', p_office_id::text,
    v_before,
    v_after || jsonb_build_object('_fields', to_jsonb(v_keys), '_google_status', p_google_status)
  );

  v_result := jsonb_build_object('applied_fields', to_jsonb(v_keys));

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    INSERT INTO public.google_profile_update_receipts (
      office_id, idempotency_key, actor_user_id, request_hash, result
    )
    VALUES (p_office_id, btrim(p_idempotency_key), v_actor, public.google_profile_hash(p_fields), v_result)
    ON CONFLICT (office_id, idempotency_key) DO NOTHING;
  END IF;

  RETURN QUERY SELECT true, 'applied'::text, v_row.profile_version,
    to_jsonb(v_keys), NULL::text, NULL::text;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_apply_google_profile_update(uuid, jsonb, integer, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_apply_google_profile_update(uuid, jsonb, integer, text, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 14. Change requests — submit / list / decide
--
-- High-risk edits (address, primary category, location mapping) cannot be
-- published by a Primary or Side Manager directly. They submit a request; an
-- Admin approves it. Submitting is validated here, so a request can never carry
-- an invalid value into the approval queue.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_google_profile_change_request(
  p_office_id uuid,
  p_field text,
  p_requested_value jsonb,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (id uuid, status text, field text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
#variable_conflict use_column
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_err text;
  v_current jsonb;
  v_row public.office_google_profiles%ROWTYPE;
  v_id uuid;
  v_status text;
BEGIN
  IF p_field NOT IN ('ADDRESS','PRIMARY_CATEGORY','LOCATION_MAPPING') THEN
    RAISE EXCEPTION 'Unknown change request field'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_REQUEST_HIGH_RISK')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Validate the requested value using the same rules the direct write uses, so
  -- a request cannot smuggle an invalid address or category past review.
  IF p_field = 'PRIMARY_CATEGORY' THEN
    v_err := public.google_profile_field_error('primary_category', p_requested_value->'primary_category');
    IF v_err IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid category: %', v_err USING ERRCODE = 'check_violation';
    END IF;
  ELSIF p_field = 'ADDRESS' THEN
    IF jsonb_typeof(p_requested_value) <> 'object' THEN
      RAISE EXCEPTION 'Address must be an object' USING ERRCODE = 'check_violation';
    END IF;
    FOR v_err IN SELECT jsonb_object_keys(p_requested_value) LOOP
      IF v_err NOT IN ('address_line_1','address_line_2','postal_code','city','region','country') THEN
        RAISE EXCEPTION 'Unknown address field: %', v_err USING ERRCODE = 'check_violation';
      END IF;
      IF public.google_profile_field_error(v_err, p_requested_value->v_err) IS NOT NULL THEN
        RAISE EXCEPTION 'Invalid address field: %', v_err USING ERRCODE = 'check_violation';
      END IF;
    END LOOP;
  END IF;

  SELECT * INTO v_row FROM public.office_google_profiles WHERE office_id = p_office_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Office has no Google profile' USING ERRCODE = 'no_data_found';
  END IF;

  -- Snapshot of what is being changed, for the Admin's before/after view.
  v_current := CASE p_field
    WHEN 'PRIMARY_CATEGORY' THEN jsonb_build_object('primary_category', v_row.primary_category)
    WHEN 'ADDRESS' THEN jsonb_build_object(
      'address_line_1', v_row.address_line_1, 'address_line_2', v_row.address_line_2,
      'postal_code', v_row.postal_code, 'city', v_row.city,
      'region', v_row.region, 'country', v_row.country)
    ELSE jsonb_build_object('google_location_id', v_row.google_location_id)
  END;

  SELECT ogo.role INTO v_role
  FROM public.office_google_operators ogo
  WHERE ogo.office_id = p_office_id AND ogo.team_member_id = v_actor;

  INSERT INTO public.google_profile_change_requests (
    office_id, google_location_id, field, current_value, requested_value,
    reason, requested_by, requested_by_role
  )
  VALUES (
    p_office_id, v_row.google_location_id, p_field, v_current, p_requested_value,
    left(NULLIF(btrim(COALESCE(p_reason,'')), ''), 500), v_actor,
    CASE WHEN public.is_admin_session() THEN 'admin' ELSE COALESCE(v_role,'PRIMARY') END
  )
  -- One open request per office+field: resubmitting replaces the pending one
  -- rather than queueing a duplicate for the Admin.
  ON CONFLICT (office_id, field) WHERE status = 'PENDING'
  DO UPDATE SET
    requested_value = EXCLUDED.requested_value,
    current_value = EXCLUDED.current_value,
    reason = EXCLUDED.reason,
    requested_by = EXCLUDED.requested_by,
    requested_by_role = EXCLUDED.requested_by_role,
    updated_at = now()
  RETURNING google_profile_change_requests.id, google_profile_change_requests.status
  INTO v_id, v_status;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, resource_id, after_data
  )
  VALUES (
    p_office_id, v_row.google_location_id, v_actor,
    CASE WHEN public.is_admin_session() THEN 'admin' ELSE COALESCE(v_role,'PRIMARY') END,
    'GOOGLE_PROFILE_CHANGE_REQUESTED', 'change_request', v_id::text,
    jsonb_build_object('field', p_field, 'requested', p_requested_value)
  );

  -- Admins triage the approval queue.
  PERFORM public.emit_notification(
    admins.admin_id, NULL, 'google_business',
    'Google profile change requested',
    'طلب تعديل ملف Google',
    'A change to the Google profile was requested and needs approval.',
    'تم طلب تعديل على ملف Google ويحتاج إلى موافقة.',
    NULL, '/team/google/profile',
    'google_change_request:' || v_id::text || ':' || admins.admin_id::text
  )
  FROM (
    SELECT ur.user_id AS admin_id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'admin'::public.app_role
      AND p.deleted_at IS NULL AND p.deactivated_at IS NULL
  ) admins;

  RETURN QUERY SELECT v_id, v_status, p_field;
END;
$fn$;

REVOKE ALL ON FUNCTION public.submit_google_profile_change_request(uuid, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_google_profile_change_request(uuid, text, jsonb, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_google_profile_change_requests(
  p_office_id uuid,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  office_id uuid,
  field text,
  current_value jsonb,
  requested_value jsonb,
  status text,
  reason text,
  requested_by uuid,
  requested_by_name text,
  requested_by_role text,
  decided_by uuid,
  decided_by_name text,
  decided_at timestamptz,
  decision_note text,
  applied_at timestamptz,
  apply_error_code text,
  apply_error_message text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_VIEW')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT r.id, r.office_id, r.field, r.current_value, r.requested_value,
         r.status, r.reason, r.requested_by, rq.full_name, r.requested_by_role,
         r.decided_by, dc.full_name, r.decided_at, r.decision_note,
         r.applied_at, r.apply_error_code, r.apply_error_message, r.created_at
  FROM public.google_profile_change_requests r
  LEFT JOIN public.profiles rq ON rq.id = r.requested_by
  LEFT JOIN public.profiles dc ON dc.id = r.decided_by
  WHERE r.office_id = p_office_id
    AND (p_status IS NULL OR r.status = p_status)
  ORDER BY
    CASE WHEN r.status = 'PENDING' THEN 0 ELSE 1 END,
    r.created_at DESC
  LIMIT 100;
END;
$fn$;

REVOKE ALL ON FUNCTION public.list_google_profile_change_requests(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_google_profile_change_requests(uuid, text) TO authenticated, service_role;

-- Approve or reject. Approval only marks the request; the caller then publishes
-- to Google and finalizes. An operator can never decide — not even their own
-- request — because GOOGLE_APPROVE_CHANGE_REQUEST is admin-only.
CREATE OR REPLACE FUNCTION public.decide_google_profile_change_request(
  p_office_id uuid,
  p_request_id uuid,
  p_decision text,
  p_note text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  status text,
  field text,
  requested_value jsonb,
  profile_version integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
#variable_conflict use_column
DECLARE
  v_actor uuid := auth.uid();
  v_req public.google_profile_change_requests%ROWTYPE;
  v_version integer;
BEGIN
  IF p_decision NOT IN ('APPROVED','REJECTED') THEN
    RAISE EXCEPTION 'Decision must be APPROVED or REJECTED'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_APPROVE_CHANGE_REQUEST')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_req
  FROM public.google_profile_change_requests
  WHERE id = p_request_id AND office_id = p_office_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Change request not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_req.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Change request already decided'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Separation of duties: an Admin may not rubber-stamp their own request.
  IF v_req.requested_by = v_actor THEN
    RAISE EXCEPTION 'A change request cannot be decided by its requester'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.google_profile_change_requests
  SET status = p_decision,
      decided_by = v_actor,
      decided_at = now(),
      decision_note = left(NULLIF(btrim(COALESCE(p_note,'')), ''), 500),
      updated_at = now()
  WHERE id = p_request_id;

  SELECT ogp.profile_version INTO v_version
  FROM public.office_google_profiles ogp WHERE ogp.office_id = p_office_id;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, resource_id, after_data
  )
  VALUES (
    p_office_id, v_req.google_location_id, v_actor, 'admin',
    CASE WHEN p_decision = 'APPROVED'
         THEN 'GOOGLE_PROFILE_CHANGE_APPROVED'
         ELSE 'GOOGLE_PROFILE_CHANGE_REJECTED' END,
    'change_request', p_request_id::text,
    jsonb_build_object('field', v_req.field, 'note', left(COALESCE(p_note,''), 200))
  );

  -- Notify the requester of the outcome.
  PERFORM public.emit_notification(
    v_req.requested_by, NULL, 'google_business',
    CASE WHEN p_decision = 'APPROVED'
         THEN 'Google profile change approved'
         ELSE 'Google profile change rejected' END,
    CASE WHEN p_decision = 'APPROVED'
         THEN 'تمت الموافقة على تعديل ملف Google'
         ELSE 'تم رفض تعديل ملف Google' END,
    CASE WHEN p_decision = 'APPROVED'
         THEN 'Your Google profile change was approved.'
         ELSE 'Your Google profile change was rejected.' END,
    CASE WHEN p_decision = 'APPROVED'
         THEN 'تمت الموافقة على تعديل ملف Google الخاص بك.'
         ELSE 'تم رفض تعديل ملف Google الخاص بك.' END,
    NULL, '/team/google/profile',
    'google_change_decision:' || p_request_id::text
  );

  RETURN QUERY SELECT p_request_id, p_decision, v_req.field, v_req.requested_value, v_version;
END;
$fn$;

REVOKE ALL ON FUNCTION public.decide_google_profile_change_request(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_google_profile_change_request(uuid, uuid, text, text) TO authenticated, service_role;

-- Finalize after the Google publish attempt: success stamps applied_at, failure
-- moves the request to FAILED with the normalized error so the Admin sees it.
CREATE OR REPLACE FUNCTION public.admin_finalize_google_change_request(
  p_office_id uuid,
  p_request_id uuid,
  p_ok boolean,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_status text;
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_APPROVE_CHANGE_REQUEST')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_ok THEN
    UPDATE public.google_profile_change_requests
    SET status = 'APPROVED',
        applied_at = now(),
        apply_error_code = NULL,
        apply_error_message = NULL,
        updated_at = now()
    WHERE id = p_request_id AND office_id = p_office_id
    RETURNING status INTO v_status;
  ELSE
    UPDATE public.google_profile_change_requests
    SET status = 'FAILED',
        apply_error_code = left(COALESCE(p_error_code, 'error'), 64),
        apply_error_message = left(COALESCE(p_error_message, 'Publish failed'), 500),
        updated_at = now()
    WHERE id = p_request_id AND office_id = p_office_id
    RETURNING status INTO v_status;
  END IF;

  RETURN COALESCE(v_status, 'not_found');
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_finalize_google_change_request(uuid, uuid, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_finalize_google_change_request(uuid, uuid, boolean, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 15. Row Level Security + privileges
--
-- Reads inherit the office's access rules; writes are RPC-only. No browser role
-- holds INSERT/UPDATE/DELETE on any Phase 6 table.
-- ---------------------------------------------------------------------------

ALTER TABLE public.google_profile_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Office members read google change requests" ON public.google_profile_change_requests;
CREATE POLICY "Office members read google change requests"
ON public.google_profile_change_requests FOR SELECT TO authenticated
USING (
  public.is_admin_session()
  OR EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.office_id = google_profile_change_requests.office_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
  )
);

REVOKE ALL ON public.google_profile_change_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.google_profile_change_requests TO authenticated;
GRANT ALL ON public.google_profile_change_requests TO service_role;

ALTER TABLE public.google_profile_update_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read google profile receipts" ON public.google_profile_update_receipts;
CREATE POLICY "Admins read google profile receipts"
ON public.google_profile_update_receipts FOR SELECT TO authenticated
USING (public.is_admin_session());

REVOKE ALL ON public.google_profile_update_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.google_profile_update_receipts TO authenticated;
GRANT ALL ON public.google_profile_update_receipts TO service_role;

-- ---------------------------------------------------------------------------
-- 16. Verification queries (manual, for the deploy checklist)
-- ---------------------------------------------------------------------------
-- A) Version conflict: admin_apply_google_profile_update(:berlin, '{"phone_primary":"+49..."}',
--    p_expected_version => <stale>) -> status = 'conflict'.
-- B) Idempotency: repeat the same call with the same p_idempotency_key
--    -> second call returns status = 'duplicate' and does not bump the version.
-- C) High risk: as a Primary, admin_apply_google_profile_update with
--    '{"primary_category":"..."}' -> raises 'Forbidden'.
-- D) Validation: phone_primary => 'abc123' -> status = 'invalid'.
-- ===========================================================================

