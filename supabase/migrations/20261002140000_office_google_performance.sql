-- ===========================================================================
-- PHASE 8 — Google Business Performance + Insights
--
-- The analytics layer on top of Phases 1-7. Google's Business Profile
-- Performance API (businessprofileperformance.googleapis.com) is read through
-- the existing connector gateway (Phase 2 OAuth is reused, never duplicated)
-- and cached locally so the dashboard reads Supabase, not Google.
--
-- What this migration adds:
--   1. google_business_performance_daily — one row per (location, date, metric,
--      scope, entity). Extensible by design: `metric_scope`/`entity_type`/
--      `entity_id` let a future Google Post metric live beside location-wide
--      metrics without a schema change.
--   2. google_business_search_keywords_monthly — monthly search keywords, with
--      the VALUE vs THRESHOLD union kept explicit (Google returns a threshold
--      meaning "the real value is below this", which must never be shown as an
--      exact number).
--   3. google_business_performance_sync_jobs — observable sync jobs so a failed
--      keyword sync does not hide a healthy metrics sync.
--   4. Performance sync state on office_google_profiles (last sync, last
--      successful sync, error, advisory lock, data-through).
--   5. Ownership validators: a performance row may only exist under the office
--      that maps its Google location, so a forged office_id is rejected at the
--      data layer as well as in the RPC.
--   6. Read RPCs (summary / series / keywords / jobs / admin aggregate) that
--      filter and paginate server-side, and sync RPCs that upsert + reconcile.
--   7. GOOGLE_SYNC_PERFORMANCE added to the authorizer, granted to
--      PRIMARY + SIDE_MANAGER (Phase 4 already granted GOOGLE_VIEW_INSIGHTS).
--
-- Metric values are BIGINT: historical totals grow past 32-bit.
--
-- Timestamp is newer than 20261001200000 (Phase 6) so this authorizer wins on a
-- fresh deploy.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Performance tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.google_business_performance_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  google_connection_id UUID,
  google_account_id TEXT NOT NULL,
  google_location_id TEXT NOT NULL,
  metric_date DATE NOT NULL,
  metric TEXT NOT NULL,
  metric_value BIGINT NOT NULL DEFAULT 0,
  -- VALUE / ZERO / NO_DATA. Google omits a datapoint when the value is zero,
  -- so "measured 0" and "no measurement" must stay distinguishable.
  data_state TEXT NOT NULL DEFAULT 'VALUE'
    CHECK (data_state IN ('VALUE','ZERO','NO_DATA')),
  -- Extensibility: a location-wide metric is LOCATION/LOCATION/<locationId>;
  -- a future post metric is POST/POST/<postId>.
  metric_scope TEXT NOT NULL DEFAULT 'LOCATION'
    CHECK (metric_scope IN ('LOCATION','POST','PHOTO','MEDIA')),
  entity_type TEXT NOT NULL DEFAULT 'LOCATION'
    CHECK (entity_type IN ('LOCATION','POST','PHOTO','MEDIA')),
  entity_id TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'businessprofileperformance.googleapis.com',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT google_business_performance_daily_key
    UNIQUE (google_location_id, metric_date, metric, metric_scope, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_gbp_daily_office_metric_date
  ON public.google_business_performance_daily (office_id, metric, metric_date);
CREATE INDEX IF NOT EXISTS idx_gbp_daily_office_date
  ON public.google_business_performance_daily (office_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_gbp_daily_location
  ON public.google_business_performance_daily (google_location_id);

CREATE TABLE IF NOT EXISTS public.google_business_search_keywords_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  google_connection_id UUID,
  google_account_id TEXT NOT NULL,
  google_location_id TEXT NOT NULL,
  month DATE NOT NULL,
  search_keyword TEXT NOT NULL,
  insights_value BIGINT NOT NULL,
  -- Google models this as a union: either an exact value, or a threshold below
  -- which the real value falls. A THRESHOLD must never be stored/displayed as
  -- an exact number.
  insights_value_type TEXT NOT NULL DEFAULT 'VALUE'
    CHECK (insights_value_type IN ('VALUE','THRESHOLD')),
  source TEXT NOT NULL DEFAULT 'businessprofileperformance.googleapis.com',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT google_business_search_keywords_monthly_key
    UNIQUE (google_location_id, month, search_keyword)
);

CREATE INDEX IF NOT EXISTS idx_gbp_keywords_office_month
  ON public.google_business_search_keywords_monthly (office_id, month);
CREATE INDEX IF NOT EXISTS idx_gbp_keywords_office_value
  ON public.google_business_search_keywords_monthly (office_id, month, insights_value DESC);
CREATE INDEX IF NOT EXISTS idx_gbp_keywords_location
  ON public.google_business_search_keywords_monthly (google_location_id);

CREATE TABLE IF NOT EXISTS public.google_business_performance_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  google_location_id TEXT,
  sync_type TEXT NOT NULL
    CHECK (sync_type IN ('METRICS','KEYWORDS','BACKFILL')),
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','RUNNING','SUCCESS','PARTIAL','FAILED')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  records_processed INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gbp_sync_jobs_office_created
  ON public.google_business_performance_sync_jobs (office_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Ownership validators
--
-- A performance row may only exist under the office that maps its Google
-- location. Mirrors Phase 5's review validator so a forged office_id cannot
-- slip past even if some future caller bypasses the RPC.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_google_performance_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.office_google_profiles ogp
    WHERE ogp.office_id = NEW.office_id
      AND ogp.google_location_id = NEW.google_location_id
  ) THEN
    RAISE EXCEPTION 'Performance location does not belong to this office mapping'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.validate_google_performance_row() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_google_performance_row() TO service_role;

DROP TRIGGER IF EXISTS trg_validate_google_performance_daily ON public.google_business_performance_daily;
CREATE TRIGGER trg_validate_google_performance_daily
BEFORE INSERT OR UPDATE OF office_id, google_location_id
ON public.google_business_performance_daily
FOR EACH ROW EXECUTE FUNCTION public.validate_google_performance_row();

DROP TRIGGER IF EXISTS trg_validate_google_search_keywords ON public.google_business_search_keywords_monthly;
CREATE TRIGGER trg_validate_google_search_keywords
BEFORE INSERT OR UPDATE OF office_id, google_location_id
ON public.google_business_search_keywords_monthly
FOR EACH ROW EXECUTE FUNCTION public.validate_google_performance_row();

-- ---------------------------------------------------------------------------
-- 3. Supported metrics (single source of truth for validation + aggregation)
--
-- These are the current documented DailyMetric values. BUSINESS_FOOD_ORDERS is
-- kept so a historical row from any source validates, but DARB does not request
-- it by default (Google marks it deprecated).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.google_performance_metric_supported(p_metric text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT p_metric IN (
    'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
    'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
    'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
    'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
    'BUSINESS_CONVERSATIONS',
    'BUSINESS_DIRECTION_REQUESTS',
    'CALL_CLICKS',
    'WEBSITE_CLICKS',
    'BUSINESS_BOOKINGS',
    'BUSINESS_FOOD_MENU_CLICKS',
    'BUSINESS_FOOD_ORDERS'
  );
$fn$;

REVOKE ALL ON FUNCTION public.google_performance_metric_supported(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.google_performance_metric_supported(text) TO authenticated, service_role;

/** Scope for a metric. Every current metric is location-wide; a future metric
 *  can return POST/PHOTO here without changing callers. */
CREATE OR REPLACE FUNCTION public.google_performance_metric_scope(p_metric text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT 'LOCATION';
$fn$;

REVOKE ALL ON FUNCTION public.google_performance_metric_scope(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.google_performance_metric_scope(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Authorizer — add GOOGLE_SYNC_PERFORMANCE
--
-- Full redefinition (Phase 6 body) plus one operational action. Kept as one
-- function so there is still a single source of truth for every Google action.
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
    -- Phase 7 operational
    'GOOGLE_SYNC_MEDIA',
    'GOOGLE_SYNC_POSTS',
    'GOOGLE_MANAGE_CUSTOMER_MEDIA',
    -- Phase 8 operational
    'GOOGLE_SYNC_PERFORMANCE',
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

  RETURN public.google_actor_can(p_office_id, p_user_id, p_action);
END;
$fn$;

REVOKE ALL ON FUNCTION public.authorize_google_office_action(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_google_office_action(uuid, uuid, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.google_actor_can(
  p_office_id uuid,
  p_user_id uuid,
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

  -- Admin, but only with the same guarantees the browser path requires:
  -- a live AAL2 admin session, or a trusted service-role connector acting on
  -- behalf of a user who holds the admin role.
  IF (public.is_admin_session() AND auth.uid() = p_user_id)
     OR (auth.role() = 'service_role' AND public.google_user_is_admin(p_user_id)) THEN
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
    'GOOGLE_APPROVE_CHANGE_REQUEST',
    -- Phase 7: customer-media moderation is deliberately outside ordinary
    -- business-photo management.
    'GOOGLE_MANAGE_CUSTOMER_MEDIA'
  ) THEN
    RETURN false;
  END IF;

  IF p_action IN ('GOOGLE_ASSIGN_SIDE_MANAGER','GOOGLE_REMOVE_SIDE_MANAGER') THEN
    RETURN v_operator_role = 'PRIMARY';
  END IF;

  RETURN COALESCE(v_operator_role IN ('PRIMARY','SIDE_MANAGER'), false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.google_actor_can(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.google_actor_can(uuid, uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Performance sync state on the office mapping
-- ---------------------------------------------------------------------------

ALTER TABLE public.office_google_profiles
  ADD COLUMN IF NOT EXISTS performance_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS performance_last_successful_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS performance_sync_error_code TEXT,
  ADD COLUMN IF NOT EXISTS performance_sync_error_message TEXT,
  ADD COLUMN IF NOT EXISTS performance_sync_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS performance_sync_lock_token TEXT,
  ADD COLUMN IF NOT EXISTS performance_data_through DATE;

-- ---------------------------------------------------------------------------
-- 6. Sync lock — one performance sync per office at a time
--
-- Owner-tokened and self-expiring: a sync acquires the lock and receives a
-- random token, and only that token may release it or finalize a job. A second
-- operator can therefore never release a live lock, and the stale window is
-- clamped server-side so a caller cannot widen it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.acquire_google_performance_sync_lock(
  p_office_id uuid,
  p_stale_after_seconds integer DEFAULT 300
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  v_token text;
  v_acquired boolean;
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_SYNC_PERFORMANCE')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');

  UPDATE public.office_google_profiles
  SET performance_sync_locked_at = now(),
      performance_sync_lock_token = v_token,
      updated_at = now()
  WHERE office_id = p_office_id
    AND (
      performance_sync_locked_at IS NULL
      OR performance_sync_locked_at < now() - make_interval(secs => LEAST(GREATEST(p_stale_after_seconds, 60), 1800))
    )
  RETURNING true INTO v_acquired;

  IF NOT COALESCE(v_acquired, false) THEN
    RETURN NULL;
  END IF;
  RETURN v_token;
END;
$fn$;

REVOKE ALL ON FUNCTION public.acquire_google_performance_sync_lock(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acquire_google_performance_sync_lock(uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.release_google_performance_sync_lock(
  p_office_id uuid,
  p_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_released boolean;
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_SYNC_PERFORMANCE')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Only the holder of the current token may release: a stale sync that lost the
  -- lock cannot clear a newer sync's lock.
  UPDATE public.office_google_profiles
  SET performance_sync_locked_at = NULL,
      performance_sync_lock_token = NULL,
      updated_at = now()
  WHERE office_id = p_office_id
    AND performance_sync_lock_token IS NOT NULL
    AND performance_sync_lock_token = p_token
  RETURNING true INTO v_released;

  RETURN COALESCE(v_released, false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.release_google_performance_sync_lock(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_google_performance_sync_lock(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Read RPC — performance summary (current + previous period)
--
-- Filtering, aggregation and the DARB-computed comparison live here, never in
-- React. `metric_status` distinguishes VALUE / ZERO / NOT_AVAILABLE so the UI
-- never renders "0" for a metric Google did not report.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_office_google_performance_summary(
  p_office_id uuid,
  p_start_date date,
  p_end_date date,
  p_prev_start_date date DEFAULT NULL,
  p_prev_end_date date DEFAULT NULL
)
RETURNS TABLE (
  office_id uuid,
  office_name text,
  timezone text,
  mapping_status text,
  connection_status text,
  verification_status text,
  google_location_name text,
  google_maps_url text,
  data_through date,
  performance_last_synced_at timestamptz,
  performance_last_successful_sync_at timestamptz,
  performance_sync_error_code text,
  performance_sync_error_message text,
  has_any_data boolean,
  current_totals jsonb,
  previous_totals jsonb,
  metric_status jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_VIEW_INSIGHTS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN
    RAISE EXCEPTION 'Invalid date range' USING ERRCODE = 'check_violation';
  END IF;

  RETURN QUERY
  WITH supported AS (
    SELECT unnest(ARRAY[
      'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
      'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
      'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
      'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
      'BUSINESS_CONVERSATIONS',
      'BUSINESS_DIRECTION_REQUESTS',
      'CALL_CLICKS',
      'WEBSITE_CLICKS',
      'BUSINESS_BOOKINGS',
      'BUSINESS_FOOD_MENU_CLICKS'
    ]) AS metric
  ),
  cur AS (
    SELECT d.metric,
           sum(d.metric_value) AS v
    FROM public.google_business_performance_daily d
    WHERE d.office_id = p_office_id
      AND d.metric_date BETWEEN p_start_date AND p_end_date
    GROUP BY d.metric
  ),
  prev AS (
    SELECT d.metric, sum(d.metric_value) AS v
    FROM public.google_business_performance_daily d
    WHERE d.office_id = p_office_id
      AND p_prev_start_date IS NOT NULL
      AND p_prev_end_date IS NOT NULL
      AND d.metric_date BETWEEN p_prev_start_date AND p_prev_end_date
    GROUP BY d.metric
  ),
  merged AS (
    SELECT s.metric,
           COALESCE(c.v, 0) AS current_value,
           COALESCE(p.v, 0) AS previous_value,
           CASE
             WHEN c.metric IS NULL THEN 'NOT_AVAILABLE'
             WHEN COALESCE(c.v, 0) = 0 THEN 'ZERO'
             ELSE 'VALUE'
           END AS status
    FROM supported s
    LEFT JOIN cur c ON c.metric = s.metric
    LEFT JOIN prev p ON p.metric = s.metric
  )
  SELECT
    ogp.office_id,
    COALESCE(NULLIF(o.name_en, ''), o.name_ar),
    o.timezone,
    ogp.mapping_status,
    ogp.connection_status,
    ogp.verification_status,
    ogp.google_location_name,
    ogp.google_maps_url,
    ogp.performance_data_through,
    ogp.performance_last_synced_at,
    ogp.performance_last_successful_sync_at,
    ogp.performance_sync_error_code,
    ogp.performance_sync_error_message,
    EXISTS (
      SELECT 1 FROM public.google_business_performance_daily d
      WHERE d.office_id = p_office_id
    ),
    COALESCE((SELECT jsonb_object_agg(metric, current_value) FROM merged), '{}'::jsonb),
    COALESCE((SELECT jsonb_object_agg(metric, previous_value) FROM merged), '{}'::jsonb),
    COALESCE((SELECT jsonb_object_agg(metric, status) FROM merged), '{}'::jsonb)
  FROM public.office_google_profiles ogp
  JOIN public.offices o ON o.id = ogp.office_id AND o.deleted_at IS NULL
  WHERE ogp.office_id = p_office_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_office_google_performance_summary(uuid, date, date, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_office_google_performance_summary(uuid, date, date, date, date) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Read RPC — performance context (office timezone + sync state)
--
-- The UI resolves a "last 30 days" preset against the OFFICE timezone, not the
-- browser's. The server reads it here, so the client never supplies the range
-- for a preset. Also returns whether any performance/keyword data exists yet, so
-- a brand-new office can be shown "not enough history" rather than a wall of 0.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_office_google_performance_context(p_office_id uuid)
RETURNS TABLE (
  office_id uuid,
  office_name text,
  timezone text,
  mapping_status text,
  connection_status text,
  verification_status text,
  google_location_name text,
  google_maps_url text,
  data_through date,
  performance_last_synced_at timestamptz,
  performance_last_successful_sync_at timestamptz,
  performance_sync_error_code text,
  performance_sync_error_message text,
  has_any_data boolean,
  has_keywords boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_VIEW_INSIGHTS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    ogp.office_id,
    COALESCE(NULLIF(o.name_en, ''), o.name_ar),
    COALESCE(NULLIF(o.timezone, ''), 'UTC'),
    ogp.mapping_status,
    ogp.connection_status,
    ogp.verification_status,
    ogp.google_location_name,
    ogp.google_maps_url,
    ogp.performance_data_through,
    ogp.performance_last_synced_at,
    ogp.performance_last_successful_sync_at,
    ogp.performance_sync_error_code,
    ogp.performance_sync_error_message,
    EXISTS (SELECT 1 FROM public.google_business_performance_daily d WHERE d.office_id = p_office_id),
    EXISTS (SELECT 1 FROM public.google_business_search_keywords_monthly k WHERE k.office_id = p_office_id)
  FROM public.office_google_profiles ogp
  JOIN public.offices o ON o.id = ogp.office_id AND o.deleted_at IS NULL
  WHERE ogp.office_id = p_office_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_office_google_performance_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_office_google_performance_context(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8b. Read RPC — offices the caller may view Insights for
--
-- One selector source for both audiences: an admin gets every mapped office
-- (labelled ADMIN), an operator gets only the offices they operate. A team
-- member therefore never receives another office's id to select in the first
-- place, on top of the per-office authorization on every read.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_google_performance_offices()
RETURNS TABLE (
  office_id uuid,
  office_name text,
  operator_role text,
  mapping_status text,
  connection_status text,
  google_location_name text,
  google_maps_url text,
  timezone text,
  performance_last_synced_at timestamptz,
  performance_data_through date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF public.is_admin_session() THEN
    RETURN QUERY
    SELECT
      ogp.office_id,
      COALESCE(NULLIF(o.name_en, ''), o.name_ar),
      'ADMIN'::text,
      ogp.mapping_status,
      ogp.connection_status,
      ogp.google_location_name,
      ogp.google_maps_url,
      COALESCE(NULLIF(o.timezone, ''), 'UTC'),
      ogp.performance_last_synced_at,
      ogp.performance_data_through
    FROM public.office_google_profiles ogp
    JOIN public.offices o ON o.id = ogp.office_id AND o.deleted_at IS NULL
    ORDER BY o.name_en;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ogo.office_id,
    COALESCE(NULLIF(o.name_en, ''), o.name_ar),
    ogo.role,
    ogp.mapping_status,
    ogp.connection_status,
    ogp.google_location_name,
    ogp.google_maps_url,
    COALESCE(NULLIF(o.timezone, ''), 'UTC'),
    ogp.performance_last_synced_at,
    ogp.performance_data_through
  FROM public.office_google_operators ogo
  JOIN public.offices o ON o.id = ogo.office_id AND o.deleted_at IS NULL
  LEFT JOIN public.office_google_profiles ogp ON ogp.office_id = ogo.office_id
  WHERE ogo.team_member_id = auth.uid()
    AND public.authorize_google_office_action(
      auth.uid(), ogo.office_id, 'GOOGLE_VIEW_INSIGHTS'
    )
  ORDER BY o.name_en;
END;
$fn$;

REVOKE ALL ON FUNCTION public.list_google_performance_offices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_google_performance_offices() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9. Read RPC — daily series for charting
--
-- Returns normalized rows; the UI groups by metric. Rows with data_state
-- NO_DATA are never produced (a gap is simply an absent row), so a chart can
-- choose "gap" semantics deliberately.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_office_google_performance_series(
  p_office_id uuid,
  p_start_date date,
  p_end_date date,
  p_metrics text[] DEFAULT NULL
)
RETURNS TABLE (
  metric text,
  metric_date date,
  metric_value bigint,
  data_state text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_VIEW_INSIGHTS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN
    RAISE EXCEPTION 'Invalid date range' USING ERRCODE = 'check_violation';
  END IF;

  RETURN QUERY
  SELECT d.metric, d.metric_date, d.metric_value, d.data_state
  FROM public.google_business_performance_daily d
  WHERE d.office_id = p_office_id
    AND d.metric_scope = 'LOCATION'
    AND d.metric_date BETWEEN p_start_date AND p_end_date
    AND (p_metrics IS NULL OR d.metric = ANY (p_metrics))
  ORDER BY d.metric, d.metric_date;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_office_google_performance_series(uuid, date, date, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_office_google_performance_series(uuid, date, date, text[]) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9. Read RPC — monthly search keywords (paginated, server-filtered)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_office_google_search_keywords(
  p_office_id uuid,
  p_start_month date DEFAULT NULL,
  p_end_month date DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'impressions_desc',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  month date,
  search_keyword text,
  insights_value bigint,
  insights_value_type text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_search text := NULLIF(btrim(COALESCE(p_search, '')), '');
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_VIEW_INSIGHTS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT k.*
    FROM public.google_business_search_keywords_monthly k
    WHERE k.office_id = p_office_id
      AND (p_start_month IS NULL OR k.month >= p_start_month)
      AND (p_end_month IS NULL OR k.month <= p_end_month)
      AND (v_search IS NULL OR k.search_keyword ILIKE '%' || v_search || '%')
  ),
  counted AS (SELECT count(*) AS total FROM filtered)
  SELECT
    f.id, f.month, f.search_keyword, f.insights_value, f.insights_value_type,
    c.total
  FROM filtered f CROSS JOIN counted c
  ORDER BY
    CASE WHEN p_sort = 'keyword_asc' THEN f.search_keyword END ASC NULLS LAST,
    f.insights_value DESC,
    f.month DESC,
    f.search_keyword ASC
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 25), 100), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$fn$;

REVOKE ALL ON FUNCTION public.list_office_google_search_keywords(uuid, date, date, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_office_google_search_keywords(uuid, date, date, text, text, integer, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 10. Read RPC — observable sync jobs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_office_google_performance_sync_jobs(
  p_office_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  sync_type text,
  start_date date,
  end_date date,
  status text,
  started_at timestamptz,
  completed_at timestamptz,
  records_processed integer,
  error_code text,
  error_message text,
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
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_VIEW_INSIGHTS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT j.id, j.sync_type, j.start_date, j.end_date, j.status,
         j.started_at, j.completed_at, j.records_processed,
         j.error_code, j.error_message, j.created_at
  FROM public.google_business_performance_sync_jobs j
  WHERE j.office_id = p_office_id
  ORDER BY j.created_at DESC
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 10), 50), 1);
END;
$fn$;

REVOKE ALL ON FUNCTION public.list_office_google_performance_sync_jobs(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_office_google_performance_sync_jobs(uuid, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 11. Read RPC — Admin all-offices aggregate
--
-- One row per office. Summing across offices is DARB's own arithmetic, NOT a
-- Google-published aggregate; the UI labels it "DARB aggregate". Admin (AAL2)
-- only — a team member can never call this for another office.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_google_performance_aggregate(
  p_start_date date,
  p_end_date date,
  p_prev_start_date date DEFAULT NULL,
  p_prev_end_date date DEFAULT NULL,
  p_office_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  office_id uuid,
  office_name text,
  current_totals jsonb,
  previous_totals jsonb,
  metric_status jsonb,
  data_through date,
  last_synced_at timestamptz
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

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN
    RAISE EXCEPTION 'Invalid date range' USING ERRCODE = 'check_violation';
  END IF;

  RETURN QUERY
  WITH supported AS (
    SELECT unnest(ARRAY[
      'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
      'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
      'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
      'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
      'BUSINESS_CONVERSATIONS',
      'BUSINESS_DIRECTION_REQUESTS',
      'CALL_CLICKS',
      'WEBSITE_CLICKS',
      'BUSINESS_BOOKINGS',
      'BUSINESS_FOOD_MENU_CLICKS'
    ]) AS metric
  ),
  offices AS (
    SELECT ogp.office_id,
           COALESCE(NULLIF(o.name_en, ''), o.name_ar) AS office_name,
           ogp.performance_data_through,
           ogp.performance_last_synced_at
    FROM public.office_google_profiles ogp
    JOIN public.offices o ON o.id = ogp.office_id AND o.deleted_at IS NULL
    WHERE ogp.mapping_status = 'MAPPED'
      AND (p_office_ids IS NULL OR ogp.office_id = ANY (p_office_ids))
  ),
  cur AS (
    SELECT d.office_id, d.metric, sum(d.metric_value) AS v
    FROM public.google_business_performance_daily d
    WHERE d.metric_date BETWEEN p_start_date AND p_end_date
    GROUP BY d.office_id, d.metric
  ),
  prev AS (
    SELECT d.office_id, d.metric, sum(d.metric_value) AS v
    FROM public.google_business_performance_daily d
    WHERE p_prev_start_date IS NOT NULL
      AND p_prev_end_date IS NOT NULL
      AND d.metric_date BETWEEN p_prev_start_date AND p_prev_end_date
    GROUP BY d.office_id, d.metric
  ),
  merged AS (
    SELECT o.office_id, s.metric,
           COALESCE(c.v, 0) AS current_value,
           COALESCE(p.v, 0) AS previous_value,
           CASE WHEN c.office_id IS NULL THEN 'NOT_AVAILABLE'
                WHEN COALESCE(c.v, 0) = 0 THEN 'ZERO'
                ELSE 'VALUE' END AS status
    FROM offices o
    CROSS JOIN supported s
    LEFT JOIN cur c ON c.office_id = o.office_id AND c.metric = s.metric
    LEFT JOIN prev p ON p.office_id = o.office_id AND p.metric = s.metric
  )
  SELECT
    o.office_id,
    o.office_name,
    COALESCE((SELECT jsonb_object_agg(m.metric, m.current_value) FROM merged m WHERE m.office_id = o.office_id), '{}'::jsonb),
    COALESCE((SELECT jsonb_object_agg(m.metric, m.previous_value) FROM merged m WHERE m.office_id = o.office_id), '{}'::jsonb),
    COALESCE((SELECT jsonb_object_agg(m.metric, m.status) FROM merged m WHERE m.office_id = o.office_id), '{}'::jsonb),
    o.performance_data_through,
    o.performance_last_synced_at
  FROM offices o
  ORDER BY o.office_name;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_google_performance_aggregate(date, date, date, date, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_google_performance_aggregate(date, date, date, date, uuid[]) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 12. Write RPC — create / complete / fail a sync job
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_create_google_performance_sync_job(
  p_office_id uuid,
  p_sync_type text,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_location_id text;
  v_job_id uuid;
BEGIN
  IF p_sync_type NOT IN ('METRICS','KEYWORDS','BACKFILL') THEN
    RAISE EXCEPTION 'Invalid sync type' USING ERRCODE = 'check_violation';
  END IF;

  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_SYNC_PERFORMANCE')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT ogp.google_location_id INTO v_location_id
  FROM public.office_google_profiles ogp
  WHERE ogp.office_id = p_office_id
    AND ogp.mapping_status = 'MAPPED'
    AND ogp.google_location_id IS NOT NULL;

  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'Office has no mapped Google location';
  END IF;

  INSERT INTO public.google_business_performance_sync_jobs (
    office_id, google_location_id, sync_type, start_date, end_date,
    status, started_at
  )
  VALUES (
    p_office_id, v_location_id, p_sync_type, p_start_date, p_end_date,
    'RUNNING', now()
  )
  RETURNING id INTO v_job_id;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, resource_id, after_data
  )
  VALUES (
    p_office_id, v_location_id, v_actor,
    CASE WHEN public.is_admin_session() THEN 'admin' ELSE 'PRIMARY' END,
    'GOOGLE_PERFORMANCE_SYNC_STARTED', 'performance', v_job_id::text,
    jsonb_build_object('sync_type', p_sync_type,
                       'start_date', p_start_date, 'end_date', p_end_date)
  );

  RETURN v_job_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_create_google_performance_sync_job(uuid, text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_google_performance_sync_job(uuid, text, date, date) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 13. Write RPC — complete the METRICS phase (upsert + reconcile)
--
-- Called only AFTER Google's fetchMultiDailyMetricsTimeSeries succeeded. Rows
-- inside [start,end] for the requested metrics that Google no longer returns are
-- deleted so a re-sync converges (a late value that changes from 17 to 18
-- updates the same row; a metric that disappears does not linger).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_complete_google_performance_metrics_job(
  p_job_id uuid,
  p_token text,
  p_rows jsonb,
  p_metrics jsonb,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (inserted integer, updated integer, deleted integer, data_through date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_office_id uuid;
  v_location_id text;
  v_account_id text;
  v_item jsonb;
  v_existing uuid;
  v_ins integer := 0;
  v_upd integer := 0;
  v_del integer := 0;
  v_metrics text[];
  v_metric text;
  v_date date;
  v_scope text;
  v_etype text;
  v_eid text;
  v_state text;
  v_job_status text;
  v_job_type text;
  v_lock_token text;
  v_observed_max date;
BEGIN
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  SELECT j.office_id, j.google_location_id, j.status, j.sync_type
  INTO v_office_id, v_location_id, v_job_status, v_job_type
  FROM public.google_business_performance_sync_jobs j
  WHERE j.id = p_job_id
  FOR UPDATE;

  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'Sync job not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(v_actor, v_office_id, 'GOOGLE_SYNC_PERFORMANCE')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- The finalizer accepts arbitrary rows, so it must only run for a job the
  -- server itself created and while this caller still holds the sync lock.
  -- Without this an operator could POST fabricated analytics straight into the
  -- cache and the admin all-office aggregate.
  IF v_job_status <> 'RUNNING' THEN
    RAISE EXCEPTION 'Sync job is not running' USING ERRCODE = 'check_violation';
  END IF;
  IF v_job_type NOT IN ('METRICS','BACKFILL') THEN
    RAISE EXCEPTION 'Sync job type mismatch' USING ERRCODE = 'check_violation';
  END IF;

  SELECT ogp.performance_sync_lock_token
  INTO v_lock_token
  FROM public.office_google_profiles ogp
  WHERE ogp.office_id = v_office_id;

  IF v_lock_token IS NULL OR p_token IS NULL OR v_lock_token <> p_token THEN
    RAISE EXCEPTION 'Sync lock not held' USING ERRCODE = 'check_violation';
  END IF;

  SELECT ogp.google_account_id INTO v_account_id
  FROM public.office_google_profiles ogp
  WHERE ogp.office_id = v_office_id;

  SELECT array_agg(value::text) INTO v_metrics
  FROM jsonb_array_elements_text(p_metrics);

  IF v_metrics IS NULL THEN
    v_metrics := ARRAY[]::text[];
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_metric := v_item->>'metric';
    IF v_metric IS NULL OR NOT public.google_performance_metric_supported(v_metric) THEN
      CONTINUE;
    END IF;
    IF (v_item->>'metric_date') IS NULL THEN
      CONTINUE;
    END IF;
    v_date := (v_item->>'metric_date')::date;
    v_scope := COALESCE(NULLIF(v_item->>'metric_scope', ''), 'LOCATION');
    v_etype := COALESCE(NULLIF(v_item->>'entity_type', ''), 'LOCATION');
    v_eid := COALESCE(v_item->>'entity_id', '');
    v_state := COALESCE(NULLIF(v_item->>'data_state', ''), 'VALUE');


    SELECT d.id INTO v_existing
    FROM public.google_business_performance_daily d
    WHERE d.google_location_id = v_location_id
      AND d.metric_date = v_date
      AND d.metric = v_metric
      AND d.metric_scope = v_scope
      AND d.entity_type = v_etype
      AND d.entity_id = v_eid;

    INSERT INTO public.google_business_performance_daily (
      office_id, google_account_id, google_location_id,
      metric_date, metric, metric_value, data_state,
      metric_scope, entity_type, entity_id, last_synced_at
    )
    VALUES (
      v_office_id,
      COALESCE(NULLIF(v_item->>'google_account_id', ''), v_account_id, ''),
      v_location_id,
      v_date,
      v_metric,
      GREATEST(COALESCE(NULLIF(v_item->>'metric_value', '')::bigint, 0), 0),
      CASE WHEN v_state IN ('VALUE','ZERO','NO_DATA') THEN v_state ELSE 'VALUE' END,
      v_scope, v_etype, v_eid, now()
    )
    ON CONFLICT (google_location_id, metric_date, metric, metric_scope, entity_type, entity_id)
    DO UPDATE SET
      office_id = EXCLUDED.office_id,
      google_account_id = EXCLUDED.google_account_id,
      metric_value = EXCLUDED.metric_value,
      data_state = EXCLUDED.data_state,
      last_synced_at = now(),
      updated_at = now();

    IF v_existing IS NULL THEN
      v_ins := v_ins + 1;
    ELSE
      v_upd := v_upd + 1;
    END IF;
  END LOOP;

  -- data-through is the newest date Google actually reported, not the requested
  -- end date: a lagging or empty response must not be presented as current.
  SELECT max((r->>'metric_date')::date) INTO v_observed_max
  FROM jsonb_array_elements(p_rows) r
  WHERE NULLIF(r->>'metric_date', '') IS NOT NULL;

  IF v_observed_max IS NOT NULL THEN
    UPDATE public.office_google_profiles
    SET performance_data_through = GREATEST(COALESCE(performance_data_through, v_observed_max), v_observed_max),
        updated_at = now()
    WHERE office_id = v_office_id;
  END IF;

  -- Reconcile: a metric row in range that Google no longer returns is removed so
  -- a stale value cannot linger. Only the requested metrics/location-wide scope
  -- are touched, and only while this job still owns the lock, so a stale
  -- completion cannot delete rows a newer sync wrote.
  IF array_length(v_metrics, 1) IS NOT NULL THEN
    DELETE FROM public.google_business_performance_daily d
    WHERE d.office_id = v_office_id
      AND d.google_location_id = v_location_id
      AND d.metric_scope = 'LOCATION'
      AND d.entity_type = 'LOCATION'
      AND d.entity_id = ''
      AND d.metric = ANY (v_metrics)
      AND d.metric_date BETWEEN p_start_date AND p_end_date
      AND EXISTS (
        SELECT 1 FROM public.office_google_profiles ogp
        WHERE ogp.office_id = v_office_id
          AND ogp.performance_sync_lock_token = p_token
      )
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_rows) r
        WHERE (r->>'metric') = d.metric
          AND (r->>'metric_date')::date = d.metric_date
      );
    GET DIAGNOSTICS v_del = ROW_COUNT;
  END IF;

  UPDATE public.google_business_performance_sync_jobs
  SET status = 'SUCCESS',
      completed_at = now(),
      records_processed = v_ins + v_upd,
      error_code = NULL,
      error_message = NULL
  WHERE id = p_job_id;

  UPDATE public.office_google_profiles
  SET performance_last_synced_at = now(),
      performance_last_successful_sync_at = now(),
      performance_sync_error_code = NULL,
      performance_sync_error_message = NULL,
      updated_at = now()
  WHERE office_id = v_office_id;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, resource_id, after_data
  )
  VALUES (
    v_office_id, v_location_id, v_actor,
    CASE WHEN public.is_admin_session() THEN 'admin' ELSE 'PRIMARY' END,
    'GOOGLE_PERFORMANCE_SYNC_COMPLETED', 'performance', p_job_id::text,
    jsonb_build_object('inserted', v_ins, 'updated', v_upd, 'deleted', v_del,
                       'data_through', v_observed_max)
  );

  RETURN QUERY SELECT v_ins, v_upd, v_del, v_observed_max;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_complete_google_performance_metrics_job(uuid, text, jsonb, jsonb, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_complete_google_performance_metrics_job(uuid, text, jsonb, jsonb, date, date) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 14. Write RPC — complete the KEYWORDS phase
--
-- Keywords are monthly and are returned for a month range, not a single month.
-- `p_month` on a row may be null (Google aggregates across the range); those
-- rows are stored against p_end_month so they remain queryable per month.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_complete_google_performance_keywords_job(
  p_job_id uuid,
  p_token text,
  p_rows jsonb,
  p_month date
)
RETURNS TABLE (inserted integer, updated integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_office_id uuid;
  v_location_id text;
  v_account_id text;
  v_item jsonb;
  v_existing uuid;
  v_ins integer := 0;
  v_upd integer := 0;
  v_keyword text;
  v_month date;
  v_type text;
  v_job_status text;
  v_job_type text;
  v_start_date date;
  v_end_date date;
  v_lock_token text;
BEGIN
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  SELECT j.office_id, j.google_location_id, j.status, j.sync_type, j.start_date, j.end_date
  INTO v_office_id, v_location_id, v_job_status, v_job_type, v_start_date, v_end_date
  FROM public.google_business_performance_sync_jobs j
  WHERE j.id = p_job_id
  FOR UPDATE;

  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'Sync job not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(v_actor, v_office_id, 'GOOGLE_SYNC_PERFORMANCE')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- See the metrics finalizer: only a server-created, still-running job may
  -- finalize, and only while its sync lock is held.
  IF v_job_status <> 'RUNNING' THEN
    RAISE EXCEPTION 'Sync job is not running' USING ERRCODE = 'check_violation';
  END IF;
  IF v_job_type <> 'KEYWORDS' THEN
    RAISE EXCEPTION 'Sync job type mismatch' USING ERRCODE = 'check_violation';
  END IF;

  SELECT ogp.performance_sync_lock_token
  INTO v_lock_token
  FROM public.office_google_profiles ogp
  WHERE ogp.office_id = v_office_id;

  IF v_lock_token IS NULL OR p_token IS NULL OR v_lock_token <> p_token THEN
    RAISE EXCEPTION 'Sync lock not held' USING ERRCODE = 'check_violation';
  END IF;

  SELECT ogp.google_account_id INTO v_account_id
  FROM public.office_google_profiles ogp
  WHERE ogp.office_id = v_office_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_keyword := NULLIF(btrim(COALESCE(v_item->>'search_keyword', '')), '');
    IF v_keyword IS NULL THEN
      CONTINUE;
    END IF;
    v_month := COALESCE(NULLIF(v_item->>'month', '')::date, p_month);
    v_type := CASE WHEN (v_item->>'insights_value_type') = 'THRESHOLD'
                   THEN 'THRESHOLD' ELSE 'VALUE' END;

    SELECT k.id INTO v_existing
    FROM public.google_business_search_keywords_monthly k
    WHERE k.google_location_id = v_location_id
      AND k.month = v_month
      AND k.search_keyword = v_keyword;

    INSERT INTO public.google_business_search_keywords_monthly (
      office_id, google_account_id, google_location_id,
      month, search_keyword, insights_value, insights_value_type, last_synced_at
    )
    VALUES (
      v_office_id,
      COALESCE(NULLIF(v_item->>'google_account_id', ''), v_account_id, ''),
      v_location_id,
      v_month,
      v_keyword,
      GREATEST(COALESCE(NULLIF(v_item->>'insights_value', '')::bigint, 0), 0),
      v_type,
      now()
    )
    ON CONFLICT (google_location_id, month, search_keyword)
    DO UPDATE SET
      office_id = EXCLUDED.office_id,
      google_account_id = EXCLUDED.google_account_id,
      insights_value = EXCLUDED.insights_value,
      insights_value_type = EXCLUDED.insights_value_type,
      last_synced_at = now(),
      updated_at = now();

    IF v_existing IS NULL THEN
      v_ins := v_ins + 1;
    ELSE
      v_upd := v_upd + 1;
    END IF;
  END LOOP;

  -- Reconcile: every month in this job's range is refreshed by one single-month
  -- request, so a term that disappears from Google's response for a month must
  -- be removed for that month rather than lingering as a stale current value.
  DELETE FROM public.google_business_search_keywords_monthly k
  WHERE k.office_id = v_office_id
    AND k.google_location_id = v_location_id
    AND k.month BETWEEN v_start_date AND v_end_date
    AND EXISTS (
      SELECT 1 FROM public.office_google_profiles ogp
      WHERE ogp.office_id = v_office_id
        AND ogp.performance_sync_lock_token = p_token
    )
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_rows) r
      WHERE COALESCE(NULLIF(r->>'month', '')::date, p_month) = k.month
        AND NULLIF(btrim(COALESCE(r->>'search_keyword', '')), '') = k.search_keyword
    );

  UPDATE public.google_business_performance_sync_jobs
  SET status = 'SUCCESS',
      completed_at = now(),
      records_processed = v_ins + v_upd,
      error_code = NULL,
      error_message = NULL
  WHERE id = p_job_id;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, resource_id, after_data
  )
  VALUES (
    v_office_id, v_location_id, v_actor,
    CASE WHEN public.is_admin_session() THEN 'admin' ELSE 'PRIMARY' END,
    'GOOGLE_PERFORMANCE_SYNC_COMPLETED', 'performance_keywords', p_job_id::text,
    jsonb_build_object('inserted', v_ins, 'updated', v_upd, 'month', p_month)
  );

  RETURN QUERY SELECT v_ins, v_upd;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_complete_google_performance_keywords_job(uuid, text, jsonb, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_complete_google_performance_keywords_job(uuid, text, jsonb, date) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 15. Write RPC — mark a sync job FAILED / PARTIAL
--
-- Partial sync is first-class: a keyword failure must not hide healthy metrics.
-- The job's own office is the authority, never a client-supplied office id.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_fail_google_performance_sync_job(
  p_job_id uuid,
  p_status text,
  p_token text DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_office_id uuid;
  v_location_id text;
  v_job_status text;
  v_lock_token text;
BEGIN
  IF p_status NOT IN ('FAILED','PARTIAL') THEN
    RAISE EXCEPTION 'Invalid failure status' USING ERRCODE = 'check_violation';
  END IF;

  SELECT j.office_id, j.google_location_id, j.status
  INTO v_office_id, v_location_id, v_job_status
  FROM public.google_business_performance_sync_jobs j
  WHERE j.id = p_job_id
  FOR UPDATE;

  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'Sync job not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(v_actor, v_office_id, 'GOOGLE_SYNC_PERFORMANCE')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- A failure may only be recorded by the sync that still owns the live lock
  -- and only against its own RUNNING job. Checking before any write stops an
  -- operator from aborting another sync's job (which would then be rejected as
  -- "not running") and from forging a failure audit.
  IF v_job_status <> 'RUNNING' THEN
    RAISE EXCEPTION 'Sync job is not running' USING ERRCODE = 'check_violation';
  END IF;

  SELECT ogp.performance_sync_lock_token
  INTO v_lock_token
  FROM public.office_google_profiles ogp
  WHERE ogp.office_id = v_office_id;

  IF v_lock_token IS NULL OR p_token IS NULL OR v_lock_token <> p_token THEN
    RAISE EXCEPTION 'Sync lock not held' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.google_business_performance_sync_jobs
  SET status = p_status,
      completed_at = now(),
      error_code = left(COALESCE(p_error_code, 'error'), 64),
      error_message = left(COALESCE(p_error_message, 'Sync failed'), 500)
  WHERE id = p_job_id
    AND EXISTS (
      SELECT 1 FROM public.office_google_profiles ogp
      WHERE ogp.office_id = v_office_id
        AND ogp.performance_sync_lock_token = p_token
    );

  -- Only a fully FAILED job records the office error; a PARTIAL keeps metrics
  -- healthy and just records that keywords lagged. The lock is only released
  -- when this caller still holds it, so a stale failure cannot clear a newer
  -- sync's lock.
  IF p_status = 'FAILED' THEN
    UPDATE public.office_google_profiles
    SET performance_sync_error_code = left(COALESCE(p_error_code, 'error'), 64),
        performance_sync_error_message = left(COALESCE(p_error_message, 'Sync failed'), 500),
        performance_sync_locked_at = NULL,
        performance_sync_lock_token = NULL,
        updated_at = now()
    WHERE office_id = v_office_id
      AND performance_sync_lock_token IS NOT NULL
      AND performance_sync_lock_token = p_token;
  ELSE
    UPDATE public.office_google_profiles
    SET performance_sync_locked_at = NULL,
        performance_sync_lock_token = NULL,
        updated_at = now()
    WHERE office_id = v_office_id
      AND performance_sync_lock_token IS NOT NULL
      AND performance_sync_lock_token = p_token;
  END IF;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, resource_id, after_data
  )
  VALUES (
    v_office_id, v_location_id, v_actor,
    CASE WHEN public.is_admin_session() THEN 'admin' ELSE 'PRIMARY' END,
    'GOOGLE_PERFORMANCE_SYNC_FAILED', 'performance', p_job_id::text,
    jsonb_build_object('status', p_status,
                       'code', left(COALESCE(p_error_code, 'error'), 64))
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_fail_google_performance_sync_job(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_fail_google_performance_sync_job(uuid, text, text, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 16. Write RPC — record a meaningful performance view / export (audit)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_record_google_performance_audit(
  p_office_id uuid,
  p_action text,
  p_after_data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF p_action NOT IN ('GOOGLE_PERFORMANCE_VIEWED','GOOGLE_PERFORMANCE_EXPORTED') THEN
    RAISE EXCEPTION 'Invalid audit action' USING ERRCODE = 'check_violation';
  END IF;

  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_VIEW_INSIGHTS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  INSERT INTO public.google_business_activity (
    office_id, actor_user_id, actor_role, action, resource_type, after_data
  )
  VALUES (
    p_office_id, v_actor,
    CASE WHEN public.is_admin_session() THEN 'admin' ELSE 'PRIMARY' END,
    p_action, 'performance',
    COALESCE(p_after_data, '{}'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_record_google_performance_audit(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_record_google_performance_audit(uuid, text, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 17. Row Level Security + privileges
--
-- Same shape as Phases 1/5: reads inherit the office's access rules, writes are
-- RPC-only. No browser role holds INSERT/UPDATE/DELETE on any performance table.
-- ---------------------------------------------------------------------------

ALTER TABLE public.google_business_performance_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_business_search_keywords_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_business_performance_sync_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Office members read google performance" ON public.google_business_performance_daily;
CREATE POLICY "Office members read google performance"
ON public.google_business_performance_daily FOR SELECT TO authenticated
USING (
  public.is_admin_session()
  OR public.authorize_google_office_action(
    auth.uid(), google_business_performance_daily.office_id, 'GOOGLE_VIEW_INSIGHTS'
  )
);

DROP POLICY IF EXISTS "Office members read google search keywords" ON public.google_business_search_keywords_monthly;
CREATE POLICY "Office members read google search keywords"
ON public.google_business_search_keywords_monthly FOR SELECT TO authenticated
USING (
  public.is_admin_session()
  OR public.authorize_google_office_action(
    auth.uid(), google_business_search_keywords_monthly.office_id, 'GOOGLE_VIEW_INSIGHTS'
  )
);

DROP POLICY IF EXISTS "Office members read google performance jobs" ON public.google_business_performance_sync_jobs;
CREATE POLICY "Office members read google performance jobs"
ON public.google_business_performance_sync_jobs FOR SELECT TO authenticated
USING (
  public.is_admin_session()
  OR public.authorize_google_office_action(
    auth.uid(), google_business_performance_sync_jobs.office_id, 'GOOGLE_VIEW_INSIGHTS'
  )
);

REVOKE ALL ON public.google_business_performance_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.google_business_performance_daily TO authenticated;
GRANT ALL ON public.google_business_performance_daily TO service_role;

REVOKE ALL ON public.google_business_search_keywords_monthly FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.google_business_search_keywords_monthly TO authenticated;
GRANT ALL ON public.google_business_search_keywords_monthly TO service_role;

REVOKE ALL ON public.google_business_performance_sync_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.google_business_performance_sync_jobs TO authenticated;
GRANT ALL ON public.google_business_performance_sync_jobs TO service_role;

-- ---------------------------------------------------------------------------
-- 18. Verification queries (manual, for the deploy checklist)
-- ---------------------------------------------------------------------------
-- A) Cross-office: SELECT public.get_office_google_performance_summary(
--      :berlin, :start, :end) as a Hamburg-only operator -> must raise Forbidden.
-- B) Direct id: pass a google_location_id from another office into
--      admin_complete_google_performance_metrics_job -> validator trigger raises.
-- C) Threshold: a keyword row with insights_value_type='THRESHOLD' must never be
--      returned by a VALUE-only filter.
-- D) Sync lock: two concurrent acquire_google_performance_sync_lock(:berlin)
--      calls -> exactly one returns a non-null token.
-- E) Forged write: call admin_complete_google_performance_metrics_job with a
--      job id that is not RUNNING or a token that is not the live lock token ->
--      must raise 'Sync job is not running' / 'Sync lock not held'.
-- F) Direct read: a member who is not the office's Google operator selects from
--      google_business_performance_daily -> RLS returns zero rows.
-- G) Foreign failure: call admin_fail_google_performance_sync_job for a RUNNING
--      job with a token that is not the live lock token -> must raise
--      'Sync lock not held' and leave the job RUNNING (no forged failure).
-- H) Truncated keywords: a keyword listing that stops on the page ceiling is
--      reported as incomplete and the sync fails without reconciling, so cached
--      terms are preserved rather than deleted.
-- ===========================================================================
