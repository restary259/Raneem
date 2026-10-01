-- DARB Office -> Google Business permission foundation (Phase 1)
--
-- Builds the DARB-side ownership/permission layer BEFORE any Google API work:
--   office -> google profile (placeholder) -> PRIMARY/SIDE_MANAGER operators
--   -> server-side authorization -> append-only audit trail -> RLS.
--
-- This migration deliberately contains NO OAuth, NO tokens and NO Google API
-- calls. It only establishes WHO owns an office's Google presence and WHO may
-- act on it. OAuth/token storage arrives in a later, server-only phase.
--
-- Security invariants enforced at the database boundary:
--   * a Google operator must be an active team member of the same office;
--   * at most one PRIMARY and one SIDE_MANAGER per office;
--   * google_business_activity is append-only (writes only via a
--     SECURITY DEFINER RPC, never from a browser role);
--   * office isolation is enforced in RLS, so knowing another office's id
--     grants nothing.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.google_business_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'google_business_profile'
    CHECK (provider IN ('google_business_profile')),
  google_email TEXT,
  google_account_id TEXT,
  connection_status TEXT NOT NULL DEFAULT 'not_connected'
    CHECK (connection_status IN ('not_connected','pending','connected','error','revoked')),
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No OAuth access/refresh tokens live here in Phase 1. Tokens must be stored
-- server-side only, in a table with no browser role grants, when Phase 2 lands.

CREATE TABLE IF NOT EXISTS public.office_google_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  google_account_id TEXT,
  google_location_id TEXT,
  google_location_resource_name TEXT,
  google_place_id TEXT,
  google_maps_url TEXT,
  connection_status TEXT NOT NULL DEFAULT 'not_connected'
    CHECK (connection_status IN ('not_connected','pending','connected','error','revoked')),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending','verified','failed')),
  last_synced_at TIMESTAMPTZ,
  last_successful_sync_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT office_google_profiles_office_id_key UNIQUE (office_id),
  CONSTRAINT office_google_profiles_location_id_key UNIQUE (google_location_id)
);

CREATE TABLE IF NOT EXISTS public.office_google_operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('PRIMARY','SIDE_MANAGER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT office_google_operators_unique_member UNIQUE (office_id, team_member_id)
);

-- At most one PRIMARY and one SIDE_MANAGER per office.
CREATE UNIQUE INDEX IF NOT EXISTS office_google_operators_one_primary_idx
  ON public.office_google_operators (office_id)
  WHERE role = 'PRIMARY';

CREATE UNIQUE INDEX IF NOT EXISTS office_google_operators_one_side_manager_idx
  ON public.office_google_operators (office_id)
  WHERE role = 'SIDE_MANAGER';

-- office_id is nullable so DARB-level connection events (connect/disconnect)
-- can be recorded before an office mapping exists (Phase 3).
CREATE TABLE IF NOT EXISTS public.google_business_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  google_location_id TEXT,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('admin','PRIMARY','SIDE_MANAGER','system')),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_office_google_profiles_office
  ON public.office_google_profiles (office_id);

CREATE INDEX IF NOT EXISTS idx_office_google_operators_office
  ON public.office_google_operators (office_id, role);

CREATE INDEX IF NOT EXISTS idx_office_google_operators_member
  ON public.office_google_operators (team_member_id);

CREATE INDEX IF NOT EXISTS idx_google_business_activity_office_created
  ON public.google_business_activity (office_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Invariant triggers (same-office, active team member, append-only audit)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_google_operator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.is_active_team_member(NEW.team_member_id) THEN
    RAISE EXCEPTION 'Google operator must be an active team member'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.office_members om
    WHERE om.office_id = NEW.office_id
      AND om.user_id = NEW.team_member_id
      AND om.is_active = true
  ) THEN
    RAISE EXCEPTION 'Google operator must belong to the same office'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.validate_google_operator() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_google_operator() TO service_role;

DROP TRIGGER IF EXISTS trg_validate_google_operator ON public.office_google_operators;
CREATE TRIGGER trg_validate_google_operator
BEFORE INSERT OR UPDATE OF office_id, team_member_id
ON public.office_google_operators
FOR EACH ROW EXECUTE FUNCTION public.validate_google_operator();

-- The audit trail is append-only: no browser role may UPDATE/DELETE it, and an
-- actor may only write activity as themselves (system/service writes allowed).
CREATE OR REPLACE FUNCTION public.validate_google_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'google_business_activity is append-only'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Activity actor must be the authenticated caller'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.validate_google_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_google_activity() TO service_role;

DROP TRIGGER IF EXISTS trg_validate_google_activity ON public.google_business_activity;
CREATE TRIGGER trg_validate_google_activity
BEFORE INSERT OR UPDATE OR DELETE
ON public.google_business_activity
FOR EACH ROW EXECUTE FUNCTION public.validate_google_activity();

-- ---------------------------------------------------------------------------
-- 3. Centralized permission layer
-- ---------------------------------------------------------------------------

-- Single source of truth for "can this user do this Google action on this
-- office". Called by every write RPC and available to the UI for affordances.
-- It re-checks live office membership, so a stale operator row can never grant
-- access after a member leaves the office.
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
    'GOOGLE_RECONNECT'
  ) THEN
    RETURN false;
  END IF;

  -- Background/service callers (Edge Functions, Phase 2 OAuth) act as the
  -- system. Browser roles can never present the service_role JWT.
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
  IF p_action IN ('GOOGLE_CHANGE_PRIMARY','GOOGLE_CONNECT','GOOGLE_DISCONNECT','GOOGLE_RECONNECT') THEN
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
-- 4. Read RPCs
-- ---------------------------------------------------------------------------

-- Every Google profile visible to the caller. Admin sees all offices; a team
-- member sees only profiles for offices they actively belong to.
CREATE OR REPLACE FUNCTION public.list_office_google_profiles()
RETURNS TABLE (
  id uuid,
  office_id uuid,
  google_account_id text,
  google_location_id text,
  google_location_resource_name text,
  google_place_id text,
  google_maps_url text,
  connection_status text,
  verification_status text,
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    ogp.id,
    ogp.office_id,
    ogp.google_account_id,
    ogp.google_location_id,
    ogp.google_location_resource_name,
    ogp.google_place_id,
    ogp.google_maps_url,
    ogp.connection_status,
    ogp.verification_status,
    ogp.last_synced_at,
    ogp.last_successful_sync_at,
    ogp.last_error_at,
    ogp.last_error_code,
    ogp.last_error_message,
    primary_op.team_member_id AS primary_operator_id,
    primary_profile.full_name AS primary_operator_name,
    side_op.team_member_id AS side_manager_id,
    side_profile.full_name AS side_manager_name,
    ogp.updated_at
  FROM public.office_google_profiles ogp
  LEFT JOIN public.office_google_operators primary_op
    ON primary_op.office_id = ogp.office_id AND primary_op.role = 'PRIMARY'
  LEFT JOIN public.profiles primary_profile ON primary_profile.id = primary_op.team_member_id
  LEFT JOIN public.office_google_operators side_op
    ON side_op.office_id = ogp.office_id AND side_op.role = 'SIDE_MANAGER'
  LEFT JOIN public.profiles side_profile ON side_profile.id = side_op.team_member_id
  WHERE public.is_admin_session()
     OR EXISTS (
       SELECT 1 FROM public.office_members om
       WHERE om.office_id = ogp.office_id
         AND om.user_id = auth.uid()
         AND om.is_active = true
     )
  ORDER BY ogp.office_id;
$fn$;

REVOKE ALL ON FUNCTION public.list_office_google_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_office_google_profiles() TO authenticated, service_role;

-- The DARB-level Google connections. Admin-only: this is account-level metadata
-- (the Google account that will be linked to the agency), not per-office data.
CREATE OR REPLACE FUNCTION public.admin_get_google_business_connections()
RETURNS SETOF public.google_business_connections
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
  SELECT * FROM public.google_business_connections
  ORDER BY created_at DESC;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_get_google_business_connections() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_google_business_connections() TO authenticated, service_role;

-- Audit feed for an office. Admin sees any office; office members see their own.
CREATE OR REPLACE FUNCTION public.admin_get_google_business_activity(
  p_office_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS SETOF public.google_business_activity
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
  SELECT * FROM public.google_business_activity
  WHERE office_id = p_office_id
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_get_google_business_activity(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_google_business_activity(uuid, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Write RPCs (admin-managed, server-authorized, audited)
-- ---------------------------------------------------------------------------

-- Upsert the placeholder Google profile for an office (admin only). This does
-- NOT connect anything to Google; it registers that an office WILL own a
-- profile. google_location_id stays NULL until Phase 3 discovery.
CREATE OR REPLACE FUNCTION public.admin_upsert_office_google_profile(
  p_office_id uuid,
  p_patch jsonb DEFAULT '{}'::jsonb
)
RETURNS public.office_google_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_profile public.office_google_profiles%ROWTYPE;
  v_before jsonb;
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_admin_session() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.offices o
    WHERE o.id = p_office_id AND o.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Office not found';
  END IF;

  SELECT to_jsonb(ogp.*) INTO v_before
  FROM public.office_google_profiles ogp
  WHERE ogp.office_id = p_office_id;

  INSERT INTO public.office_google_profiles (
    office_id, google_account_id, google_location_id,
    google_location_resource_name, google_place_id, google_maps_url,
    connection_status, verification_status
  )
  VALUES (
    p_office_id,
    NULLIF(trim(COALESCE(p_patch->>'google_account_id','')), ''),
    NULLIF(trim(COALESCE(p_patch->>'google_location_id','')), ''),
    NULLIF(trim(COALESCE(p_patch->>'google_location_resource_name','')), ''),
    NULLIF(trim(COALESCE(p_patch->>'google_place_id','')), ''),
    NULLIF(trim(COALESCE(p_patch->>'google_maps_url','')), ''),
    COALESCE(NULLIF(trim(COALESCE(p_patch->>'connection_status','')), ''), 'not_connected'),
    COALESCE(NULLIF(trim(COALESCE(p_patch->>'verification_status','')), ''), 'unverified')
  )
  ON CONFLICT (office_id) DO UPDATE SET
    google_account_id = COALESCE(EXCLUDED.google_account_id, public.office_google_profiles.google_account_id),
    google_location_id = COALESCE(EXCLUDED.google_location_id, public.office_google_profiles.google_location_id),
    google_location_resource_name = COALESCE(EXCLUDED.google_location_resource_name, public.office_google_profiles.google_location_resource_name),
    google_place_id = COALESCE(EXCLUDED.google_place_id, public.office_google_profiles.google_place_id),
    google_maps_url = COALESCE(EXCLUDED.google_maps_url, public.office_google_profiles.google_maps_url),
    connection_status = EXCLUDED.connection_status,
    verification_status = EXCLUDED.verification_status,
    updated_at = now()
  RETURNING * INTO v_profile;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role, action,
    resource_type, resource_id, before_data, after_data
  )
  VALUES (
    p_office_id, v_profile.google_location_id, v_actor, 'admin',
    CASE WHEN v_before IS NULL THEN 'ADMIN_CREATED_GOOGLE_PROFILE'
         ELSE 'ADMIN_UPDATED_GOOGLE_PROFILE' END,
    'office_google_profile', v_profile.id::text, v_before, to_jsonb(v_profile.*)
  );

  RETURN v_profile;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_upsert_office_google_profile(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_office_google_profile(uuid, jsonb) TO authenticated, service_role;

-- Assign/replace the PRIMARY operator for an office (admin only). Replaces the
-- current PRIMARY in a single transaction; the unique index guarantees one row.
CREATE OR REPLACE FUNCTION public.admin_assign_google_primary(
  p_office_id uuid,
  p_team_member_id uuid
)
RETURNS public.office_google_operators
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_before jsonb;
  v_row public.office_google_operators%ROWTYPE;
  v_actor uuid := auth.uid();
  v_name text;
BEGIN
  IF NOT public.is_admin_session() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT public.is_active_team_member(p_team_member_id) THEN
    RAISE EXCEPTION 'Google operator must be an active team member'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.office_id = p_office_id
      AND om.user_id = p_team_member_id
      AND om.is_active = true
  ) THEN
    RAISE EXCEPTION 'Google operator must belong to the same office'
      USING ERRCODE = 'check_violation';
  END IF;

  -- One person cannot hold both roles; require removing the other role first so
  -- each change is a separate, audited step.
  IF EXISTS (
    SELECT 1 FROM public.office_google_operators ogo
    WHERE ogo.office_id = p_office_id
      AND ogo.team_member_id = p_team_member_id
      AND ogo.role = 'SIDE_MANAGER'
  ) THEN
    RAISE EXCEPTION 'This member is the current side manager; remove that role first'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT to_jsonb(ogo.*) INTO v_before
  FROM public.office_google_operators ogo
  WHERE ogo.office_id = p_office_id AND ogo.role = 'PRIMARY';

  DELETE FROM public.office_google_operators
  WHERE office_id = p_office_id AND role = 'PRIMARY';

  INSERT INTO public.office_google_operators (office_id, team_member_id, role)
  VALUES (p_office_id, p_team_member_id, 'PRIMARY')
  RETURNING * INTO v_row;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = p_team_member_id;

  INSERT INTO public.google_business_activity (
    office_id, actor_user_id, actor_role, action, resource_type, resource_id,
    before_data, after_data
  )
  VALUES (
    p_office_id, v_actor, 'admin',
    CASE WHEN v_before IS NULL THEN 'ADMIN_ASSIGNED_PRIMARY' ELSE 'ADMIN_CHANGED_PRIMARY' END,
    'office_google_operator', v_row.id::text,
    v_before,
    jsonb_build_object('team_member_id', p_team_member_id, 'team_member_name', v_name, 'role', 'PRIMARY')
  );

  RETURN v_row;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_assign_google_primary(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_google_primary(uuid, uuid) TO authenticated, service_role;

-- Assign/replace the SIDE_MANAGER for an office. Admin OR that office's PRIMARY
-- may call this (RULE 7); everyone else is rejected at the RPC, not the UI.
CREATE OR REPLACE FUNCTION public.assign_google_side_manager(
  p_office_id uuid,
  p_team_member_id uuid
)
RETURNS public.office_google_operators
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_before jsonb;
  v_row public.office_google_operators%ROWTYPE;
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_name text;
BEGIN
  IF NOT public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_ASSIGN_SIDE_MANAGER') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT public.is_active_team_member(p_team_member_id) THEN
    RAISE EXCEPTION 'Google operator must be an active team member'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.office_id = p_office_id
      AND om.user_id = p_team_member_id
      AND om.is_active = true
  ) THEN
    RAISE EXCEPTION 'Google operator must belong to the same office'
      USING ERRCODE = 'check_violation';
  END IF;

  -- A PRIMARY cannot appoint themselves as the side manager.
  IF p_team_member_id = v_actor THEN
    RAISE EXCEPTION 'A side manager must be a different team member'
      USING ERRCODE = 'check_violation';
  END IF;

  -- One person cannot hold both roles; require removing the other role first so
  -- each change is a separate, audited step.
  IF EXISTS (
    SELECT 1 FROM public.office_google_operators ogo
    WHERE ogo.office_id = p_office_id
      AND ogo.team_member_id = p_team_member_id
      AND ogo.role = 'PRIMARY'
  ) THEN
    RAISE EXCEPTION 'This member is the current primary operator; remove that role first'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT ogo.role INTO v_actor_role
  FROM public.office_google_operators ogo
  WHERE ogo.office_id = p_office_id AND ogo.team_member_id = v_actor;

  IF public.is_admin_session() THEN
    v_actor_role := 'admin';
  END IF;

  SELECT to_jsonb(ogo.*) INTO v_before
  FROM public.office_google_operators ogo
  WHERE ogo.office_id = p_office_id AND ogo.role = 'SIDE_MANAGER';

  DELETE FROM public.office_google_operators
  WHERE office_id = p_office_id AND role = 'SIDE_MANAGER';

  INSERT INTO public.office_google_operators (office_id, team_member_id, role)
  VALUES (p_office_id, p_team_member_id, 'SIDE_MANAGER')
  RETURNING * INTO v_row;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = p_team_member_id;

  INSERT INTO public.google_business_activity (
    office_id, actor_user_id, actor_role, action, resource_type, resource_id,
    before_data, after_data
  )
  VALUES (
    p_office_id, v_actor, COALESCE(v_actor_role, 'system'),
    CASE WHEN v_before IS NULL THEN 'SIDE_MANAGER_ASSIGNED' ELSE 'SIDE_MANAGER_CHANGED' END,
    'office_google_operator', v_row.id::text,
    v_before,
    jsonb_build_object('team_member_id', p_team_member_id, 'team_member_name', v_name, 'role', 'SIDE_MANAGER')
  );

  RETURN v_row;
END;
$fn$;

REVOKE ALL ON FUNCTION public.assign_google_side_manager(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_google_side_manager(uuid, uuid) TO authenticated, service_role;

-- Remove an operator row. Removing the PRIMARY is admin-only; a PRIMARY may
-- remove the SIDE_MANAGER. Every removal is audited.
CREATE OR REPLACE FUNCTION public.remove_google_operator(
  p_office_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_action text;
BEGIN
  IF p_role NOT IN ('PRIMARY','SIDE_MANAGER') THEN
    RAISE EXCEPTION 'Invalid operator role';
  END IF;

  IF p_role = 'PRIMARY' THEN
    IF NOT public.is_admin_session() THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
    v_action := 'ADMIN_REMOVED_PRIMARY';
  ELSE
    IF NOT public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_ASSIGN_SIDE_MANAGER') THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
    v_action := 'SIDE_MANAGER_REMOVED';
  END IF;

  SELECT to_jsonb(ogo.*) INTO v_before
  FROM public.office_google_operators ogo
  WHERE ogo.office_id = p_office_id AND ogo.role = p_role;

  IF v_before IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.office_google_operators
  WHERE office_id = p_office_id AND role = p_role;

  INSERT INTO public.google_business_activity (
    office_id, actor_user_id,
    actor_role,
    action, resource_type, resource_id, before_data
  )
  VALUES (
    p_office_id, v_actor,
    CASE WHEN public.is_admin_session() THEN 'admin' ELSE 'PRIMARY' END,
    v_action, 'office_google_operator', (v_before->>'id'), v_before
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.remove_google_operator(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_google_operator(uuid, text) TO authenticated, service_role;

-- Register/update the DARB-level Google connection (admin only). Phase 2 will
-- call this AFTER a successful OAuth exchange; it stores NO tokens.
CREATE OR REPLACE FUNCTION public.admin_update_google_connection(
  p_patch jsonb
)
RETURNS public.google_business_connections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_row public.google_business_connections%ROWTYPE;
  v_status text;
BEGIN
  IF NOT public.is_admin_session() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_status := COALESCE(NULLIF(trim(COALESCE(p_patch->>'connection_status','')), ''), 'pending');

  SELECT * INTO v_row
  FROM public.google_business_connections
  WHERE provider = 'google_business_profile'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_row.id IS NULL THEN
    INSERT INTO public.google_business_connections (
      provider, google_email, google_account_id, connection_status,
      connected_by, connected_at, revoked_at
    )
    VALUES (
      'google_business_profile',
      NULLIF(trim(COALESCE(p_patch->>'google_email','')), ''),
      NULLIF(trim(COALESCE(p_patch->>'google_account_id','')), ''),
      v_status,
      CASE WHEN v_status = 'connected' THEN v_actor ELSE NULL END,
      CASE WHEN v_status = 'connected' THEN now() ELSE NULL END,
      CASE WHEN v_status = 'revoked' THEN now() ELSE NULL END
    )
    RETURNING * INTO v_row;
    v_before := NULL;
  ELSE
    v_before := to_jsonb(v_row.*);
    UPDATE public.google_business_connections SET
      google_email = COALESCE(NULLIF(trim(COALESCE(p_patch->>'google_email','')), ''), google_email),
      google_account_id = COALESCE(NULLIF(trim(COALESCE(p_patch->>'google_account_id','')), ''), google_account_id),
      connection_status = v_status,
      connected_by = CASE WHEN v_status = 'connected' THEN v_actor ELSE connected_by END,
      connected_at = CASE WHEN v_status = 'connected' THEN now() ELSE connected_at END,
      revoked_at = CASE WHEN v_status = 'revoked' THEN now() ELSE revoked_at END,
      updated_at = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  END IF;

  INSERT INTO public.google_business_activity (
    office_id, actor_user_id, actor_role, action, resource_type, resource_id,
    before_data, after_data
  )
  VALUES (
    NULL, v_actor, 'admin',
    CASE v_status
      WHEN 'connected' THEN 'ADMIN_CONNECTED_GOOGLE'
      WHEN 'revoked' THEN 'ADMIN_DISCONNECTED_GOOGLE'
      ELSE 'ADMIN_UPDATED_GOOGLE_CONNECTION'
    END,
    'google_business_connection', v_row.id::text, v_before, to_jsonb(v_row.*)
  );

  RETURN v_row;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_update_google_connection(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_google_connection(jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.office_google_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_google_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_business_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_business_connections ENABLE ROW LEVEL SECURITY;

-- Reads inherit the office's access rules (RLS). Writes are RPC-only: browser
-- roles get no INSERT/UPDATE/DELETE grant, so the append-only audit and the
-- same-office operator invariants cannot be bypassed by a direct write.

DROP POLICY IF EXISTS "Office members read google profiles" ON public.office_google_profiles;
CREATE POLICY "Office members read google profiles"
ON public.office_google_profiles FOR SELECT TO authenticated
USING (
  public.is_admin_session()
  OR EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.office_id = office_google_profiles.office_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
  )
);

DROP POLICY IF EXISTS "Office members read google operators" ON public.office_google_operators;
CREATE POLICY "Office members read google operators"
ON public.office_google_operators FOR SELECT TO authenticated
USING (
  public.is_admin_session()
  OR EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.office_id = office_google_operators.office_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
  )
);

DROP POLICY IF EXISTS "Admins read google business connections" ON public.google_business_connections;
CREATE POLICY "Admins read google business connections"
ON public.google_business_connections FOR SELECT TO authenticated
USING (public.is_admin_session());

-- Append-only audit: admins read everything; office members read their office.
-- DARB-level rows (office_id IS NULL) are admin-only.
DROP POLICY IF EXISTS "Admins read google business activity" ON public.google_business_activity;
CREATE POLICY "Admins read google business activity"
ON public.google_business_activity FOR SELECT TO authenticated
USING (
  public.is_admin_session()
  OR (
    google_business_activity.office_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.office_members om
      WHERE om.office_id = google_business_activity.office_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
    )
  )
);

-- ---------------------------------------------------------------------------
-- 7. Privileges
-- ---------------------------------------------------------------------------

-- Read-only to browser roles, writes only through the SECURITY DEFINER RPCs.
REVOKE ALL ON public.office_google_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.office_google_operators FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.google_business_activity FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.google_business_connections FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.office_google_profiles TO authenticated;
GRANT SELECT ON public.office_google_operators TO authenticated;
GRANT SELECT ON public.google_business_activity TO authenticated;
GRANT SELECT ON public.google_business_connections TO authenticated;

GRANT ALL ON public.office_google_profiles TO service_role;
GRANT ALL ON public.office_google_operators TO service_role;
GRANT ALL ON public.google_business_activity TO service_role;
GRANT ALL ON public.google_business_connections TO service_role;
