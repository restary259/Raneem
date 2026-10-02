-- ============================================================================
-- PHASE 9 — Real-Time Google Notifications + Background Sync
-- ============================================================================
-- Adds the durable event pipeline, the background sync queue, Google location
-- health, and the notification fan-out that routes a Google event to exactly the
-- DARB office it belongs to.
--
-- Architecture (one centralized Pub/Sub pipeline for the whole DARB Google
-- account, office routing inside DARB):
--
--   Google -> Pub/Sub -> DARB webhook -> google_business_events (persist, ACK)
--          -> route_google_business_event  (google_location_id -> office)
--          -> google_business_sync_jobs    (one active job per office/type)
--          -> worker -> Google API -> existing Phase 5-8 sync RPCs
--          -> notify_google_business_event -> notifications (office-scoped)
--          -> Supabase realtime -> browsers
--
-- Security posture (mirrors Phase 1/3/5/7):
--   * `google_business_events.payload_json` is never granted to any browser
--     role; raw external payloads are admin-only through a SECURITY DEFINER RPC.
--   * office_id is always derived from the Google location mapping, never taken
--     from the Pub/Sub payload (the router rejects a mismatch).
--   * notification recipients are re-resolved at send time (live active
--     membership + operator role), so a role change or deactivation takes effect
--     on the very next event.
--
-- MANUAL DEPLOY: newer than 20261002140000_office_google_performance.sql, whose
-- `authorize_google_office_action` / `google_actor_can` this file redefines; the
-- copies below carry every Phase 7/8 action forward.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Event receipt table
--
-- One row per Pub/Sub message. `google_message_id` is the idempotency anchor:
-- Pub/Sub may redeliver, so a replayed message returns the first row instead of
-- creating a second event.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.google_business_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_connection_id UUID REFERENCES public.google_business_connections(id) ON DELETE SET NULL,
  google_account_id TEXT,
  google_location_id TEXT,
  google_resource_name TEXT,
  -- DARB's normalized event type. An event Google adds later is stored as
  -- 'UNKNOWN' rather than crashing the router (forward compatible).
  event_type TEXT NOT NULL,
  -- Pub/Sub message id: the redelivery-safe identity.
  google_message_id TEXT,
  -- Google's own event/resource id when the notification carries one.
  google_event_id TEXT,
  -- Cryptographic hash of the normalized payload: same event vs changed payload.
  payload_hash TEXT,
  -- Raw external payload. Never reachable from a browser role.
  payload_json JSONB,
  -- Derived from the Google location mapping by the router, never trusted from
  -- the payload.
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  routing_status TEXT NOT NULL DEFAULT 'UNROUTED'
    CHECK (routing_status IN ('UNROUTED','ROUTED','IGNORED','UNKNOWN_LOCATION','UNKNOWN_ACCOUNT')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processing_status TEXT NOT NULL DEFAULT 'RECEIVED'
    CHECK (processing_status IN
      ('RECEIVED','QUEUED','PROCESSING','PROCESSED','DUPLICATE','FAILED','DEAD_LETTERED','IGNORED')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS google_business_events_message_uidx
  ON public.google_business_events (google_message_id)
  WHERE google_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gbp_events_office_created
  ON public.google_business_events (office_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gbp_events_status
  ON public.google_business_events (processing_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gbp_events_type_created
  ON public.google_business_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gbp_events_location
  ON public.google_business_events (google_location_id);
CREATE INDEX IF NOT EXISTS idx_gbp_events_hash
  ON public.google_business_events (payload_hash);

-- ---------------------------------------------------------------------------
-- 2. Background sync queue
--
-- Generic queue for PROFILE / REVIEWS / MEDIA / POSTS / PERFORMANCE / HEALTH /
-- FULL. A partial unique index enforces "at most one active job per
-- office + sync_type" so an event burst cannot stampede the Google API.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.google_business_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  google_location_id TEXT,
  google_connection_id UUID REFERENCES public.google_business_connections(id) ON DELETE SET NULL,
  sync_type TEXT NOT NULL
    CHECK (sync_type IN ('PROFILE','REVIEWS','MEDIA','POSTS','PERFORMANCE','HEALTH','FULL')),
  priority TEXT NOT NULL DEFAULT 'NORMAL'
    CHECK (priority IN ('CRITICAL','HIGH','NORMAL','LOW')),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','RUNNING','SUCCESS','PARTIAL','FAILED','CANCELLED')),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  records_processed INTEGER NOT NULL DEFAULT 0,
  -- The event that triggered this job, when it was event-driven.
  trigger_event_id UUID REFERENCES public.google_business_events(id) ON DELETE SET NULL,
  -- Owner-tokened lock, mirroring the Phase 8 performance lock: only the token
  -- that claimed the job may complete or fail it.
  lock_token TEXT,
  locked_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS google_business_sync_jobs_active_uidx
  ON public.google_business_sync_jobs (office_id, sync_type)
  WHERE status IN ('PENDING','RUNNING');

CREATE INDEX IF NOT EXISTS idx_gbp_sync_jobs_status
  ON public.google_business_sync_jobs (status, priority, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_gbp_sync_jobs_office_created
  ON public.google_business_sync_jobs (office_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Google location health
--
-- Deterministic states, no invented score. One row per mapped office.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.google_business_location_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  google_location_id TEXT,
  verification_state TEXT,
  voice_of_merchant_state TEXT,
  location_state TEXT,
  duplicate_state TEXT,
  health_status TEXT NOT NULL DEFAULT 'UNKNOWN'
    CHECK (health_status IN ('HEALTHY','ATTENTION','ACTION_REQUIRED','UNAVAILABLE','UNKNOWN')),
  last_checked_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT google_business_location_health_office_key UNIQUE (office_id)
);

CREATE INDEX IF NOT EXISTS idx_gbp_health_status
  ON public.google_business_location_health (health_status);

-- ---------------------------------------------------------------------------
-- 4. Health state history (append-only)
--
-- "Healthy -> Attention -> Healthy" over time. Only a *change* is recorded.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.google_business_health_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  google_location_id TEXT,
  event_type TEXT NOT NULL,
  previous_state TEXT,
  new_state TEXT,
  source TEXT NOT NULL DEFAULT 'EVENT'
    CHECK (source IN ('EVENT','SYNC','ADMIN','RECONCILE')),
  google_event_id UUID REFERENCES public.google_business_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gbp_health_events_office_created
  ON public.google_business_health_events (office_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. State on the existing tables
--
--   * office_google_profiles.last_google_event_at — "last Google event" is a
--     different question from "last successful sync", so it is a separate
--     column, not a reuse of last_synced_at.
--   * google_business_connections gains the account-level Pub/Sub configuration
--     and the delivery/processing counters the admin health page reads.
--   * notifications gains office/entity context so a click can route to the
--     exact review/profile rather than a generic dashboard.
-- ---------------------------------------------------------------------------

ALTER TABLE public.office_google_profiles
  ADD COLUMN IF NOT EXISTS last_google_event_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS health_status TEXT NOT NULL DEFAULT 'UNKNOWN';

ALTER TABLE public.google_business_connections
  ADD COLUMN IF NOT EXISTS pubsub_topic TEXT,
  ADD COLUMN IF NOT EXISTS pubsub_subscription TEXT,
  ADD COLUMN IF NOT EXISTS pubsub_status TEXT NOT NULL DEFAULT 'not_configured'
    CHECK (pubsub_status IN ('not_configured','connecting','connected','misconfigured','error')),
  ADD COLUMN IF NOT EXISTS notification_types TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS notification_setting_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_event_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_event_processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS event_failure_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dead_letter_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS google_event_type TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_office_created
  ON public.notifications (office_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 6. Authorizer — union of every prior phase plus the Phase 9 actions
--
-- Redefines Phase 8's functions. The Phase 7 media/post actions and the Phase 8
-- performance action MUST survive this copy or those syncs break; the Phase 9
-- deploy verifier asserts the union.
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
    -- Phase 9 operational
    'GOOGLE_SYNC_OFFICE',
    'GOOGLE_VIEW_HEALTH',
    'GOOGLE_VIEW_SYNC_STATUS',
    -- Phase 9 admin-only controls
    'GOOGLE_MANAGE_NOTIFICATIONS',
    'GOOGLE_VIEW_EVENTS',
    'GOOGLE_RETRY_EVENT',
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
    'GOOGLE_MANAGE_CUSTOMER_MEDIA',
    -- Phase 9: the Pub/Sub configuration is account-level and would affect
    -- every office, so it stays Admin-only; raw events and retries too.
    'GOOGLE_MANAGE_NOTIFICATIONS',
    'GOOGLE_VIEW_EVENTS',
    'GOOGLE_RETRY_EVENT'
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
-- 7. Resource resolver — Google location -> DARB office
--
-- The single source of truth for routing. A business NAME is never used; only
-- the Google resource identifiers. An unknown account or location returns
-- matched = false with a reason, so the router can alert Admin instead of
-- guessing.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_google_event_office(
  p_google_account_id text,
  p_google_location_id text
)
RETURNS TABLE (
  matched boolean,
  reason text,
  office_id uuid,
  google_connection_id uuid,
  google_account_id text,
  google_location_resource_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_location text := NULLIF(btrim(COALESCE(p_google_location_id, '')), '');
  v_account text := NULLIF(btrim(COALESCE(p_google_account_id, '')), '');
  v_row record;
BEGIN
  IF v_location IS NULL THEN
    RETURN QUERY SELECT false, 'NO_LOCATION', NULL::uuid, NULL::uuid, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT
    ogp.office_id,
    ogp.google_connection_id,
    ogp.google_account_id,
    ogp.google_location_resource_name
  INTO v_row
  FROM public.office_google_profiles ogp
  JOIN public.offices o ON o.id = ogp.office_id AND o.deleted_at IS NULL
  WHERE ogp.google_location_id = v_location
    AND ogp.mapping_status = 'MAPPED'
  LIMIT 1;

  IF v_row.office_id IS NULL THEN
    RETURN QUERY SELECT false, 'UNKNOWN_LOCATION', NULL::uuid, NULL::uuid, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- When the notification names an account it must be the one the location was
  -- verified under; otherwise the event is not for this mapping.
  IF v_account IS NOT NULL
     AND v_row.google_account_id IS NOT NULL
     AND v_row.google_account_id <> v_account THEN
    RETURN QUERY SELECT false, 'ACCOUNT_MISMATCH', NULL::uuid, NULL::uuid, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- The account must belong to a DARB connection (never an arbitrary Google
  -- account).
  IF v_account IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.google_business_connections c
    WHERE c.google_account_id = v_account
      AND c.connection_status IN ('connected','pending')
  ) THEN
    RETURN QUERY SELECT false, 'UNKNOWN_ACCOUNT', NULL::uuid, NULL::uuid, NULL::text, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    true, 'ROUTED', v_row.office_id, v_row.google_connection_id,
    v_row.google_account_id, v_row.google_location_resource_name;
END;
$fn$;

REVOKE ALL ON FUNCTION public.resolve_google_event_office(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_google_event_office(text, text) TO service_role;


-- ---------------------------------------------------------------------------
-- 8. Event receipt — persist + idempotency
--
-- Service-role only: the webhook is the only writer. A redelivered
-- `google_message_id` returns the existing row with is_duplicate = true and the
-- webhook ACKs without creating a second event.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_google_business_event(
  p_google_message_id text,
  p_event_type text,
  p_google_account_id text DEFAULT NULL,
  p_google_location_id text DEFAULT NULL,
  p_google_resource_name text DEFAULT NULL,
  p_google_event_id text DEFAULT NULL,
  p_payload_hash text DEFAULT NULL,
  p_payload jsonb DEFAULT NULL
)
RETURNS TABLE (
  event_id uuid,
  is_duplicate boolean,
  processing_status text,
  routing_status text,
  office_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_message_id text := NULLIF(btrim(COALESCE(p_google_message_id, '')), '');
  v_event_type text := UPPER(NULLIF(btrim(COALESCE(p_event_type, '')), ''));
  v_id uuid;
  v_existing record;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF v_message_id IS NULL THEN
    RAISE EXCEPTION 'p_google_message_id is required';
  END IF;

  IF v_event_type IS NULL THEN
    RAISE EXCEPTION 'p_event_type is required';
  END IF;

  -- A raw external payload is capped so a hostile request cannot bloat the row.
  IF p_payload IS NOT NULL AND octet_length(p_payload::text) > 262144 THEN
    RAISE EXCEPTION 'Event payload too large';
  END IF;

  INSERT INTO public.google_business_events (
    google_message_id, event_type, google_account_id, google_location_id,
    google_resource_name, google_event_id, payload_hash, payload_json
  )
  VALUES (
    v_message_id, v_event_type,
    NULLIF(btrim(COALESCE(p_google_account_id, '')), ''),
    NULLIF(btrim(COALESCE(p_google_location_id, '')), ''),
    NULLIF(btrim(COALESCE(p_google_resource_name, '')), ''),
    NULLIF(btrim(COALESCE(p_google_event_id, '')), ''),
    NULLIF(btrim(COALESCE(p_payload_hash, '')), ''),
    p_payload
  )
  ON CONFLICT (google_message_id) WHERE google_message_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT v_id, false, 'RECEIVED'::text, 'UNROUTED'::text, NULL::uuid;
    RETURN;
  END IF;

  SELECT e.id, e.processing_status, e.routing_status, e.office_id
  INTO v_existing
  FROM public.google_business_events e
  WHERE e.google_message_id = v_message_id;

  RETURN QUERY SELECT
    v_existing.id, true, v_existing.processing_status, v_existing.routing_status, v_existing.office_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.record_google_business_event(text, text, text, text, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_google_business_event(text, text, text, text, text, text, text, jsonb)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 9. Event router — classify, resolve office, queue a sync job
--
-- Idempotent: a second call for an already-routed event returns the existing
-- routing without creating a second job. The office is always derived from the
-- Google location mapping; a payload-supplied office is never consulted.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.route_google_business_event(p_event_id uuid)
RETURNS TABLE (
  event_id uuid,
  event_type text,
  routing_status text,
  office_id uuid,
  sync_job_id uuid,
  sync_type text,
  priority text,
  is_duplicate boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_event record;
  v_resolve record;
  v_sync_type text;
  v_priority text;
  v_job_id uuid;
  v_job_status text;
BEGIN
  -- Service-role (the webhook) or a live AAL2 admin session (dead-letter
  -- retry). A browser never routes arbitrary events: the office still comes
  -- only from the location mapping.
  IF NOT (auth.role() = 'service_role' OR public.is_admin_session()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_event FROM public.google_business_events e WHERE e.id = p_event_id;
  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- Already routed: return the existing outcome (idempotent replay).
  IF v_event.routing_status IN ('ROUTED','IGNORED','UNKNOWN_LOCATION','UNKNOWN_ACCOUNT')
     AND v_event.processing_status <> 'RECEIVED' THEN
    SELECT j.id, j.sync_type, j.priority INTO v_job_id, v_sync_type, v_priority
    FROM public.google_business_sync_jobs j
    WHERE j.trigger_event_id = p_event_id
    ORDER BY j.created_at DESC LIMIT 1;

    RETURN QUERY SELECT
      v_event.id, v_event.event_type, v_event.routing_status, v_event.office_id,
      v_job_id, v_sync_type, v_priority, true;
    RETURN;
  END IF;

  -- Classification. An unknown Google event type is ignored, never a crash.
  CASE v_event.event_type
    WHEN 'NEW_REVIEW' THEN v_sync_type := 'REVIEWS'; v_priority := 'HIGH';
    WHEN 'UPDATED_REVIEW' THEN v_sync_type := 'REVIEWS'; v_priority := 'HIGH';
    WHEN 'NEW_CUSTOMER_MEDIA' THEN v_sync_type := 'MEDIA'; v_priority := 'NORMAL';
    WHEN 'GOOGLE_UPDATE' THEN v_sync_type := 'PROFILE'; v_priority := 'HIGH';
    WHEN 'UPDATED_LOCATION_STATE' THEN v_sync_type := 'HEALTH'; v_priority := 'HIGH';
    WHEN 'DUPLICATE_LOCATION' THEN v_sync_type := 'HEALTH'; v_priority := 'HIGH';
    WHEN 'VOICE_OF_MERCHANT_UPDATED' THEN v_sync_type := 'HEALTH'; v_priority := 'CRITICAL';
    ELSE v_sync_type := NULL; v_priority := NULL;
  END CASE;

  IF v_sync_type IS NULL THEN
    UPDATE public.google_business_events
    SET routing_status = 'IGNORED',
        processing_status = 'IGNORED',
        processed_at = now(),
        error_code = 'UNSUPPORTED_EVENT_TYPE',
        updated_at = now()
    WHERE id = p_event_id;

    RETURN QUERY SELECT v_event.id, v_event.event_type, 'IGNORED'::text, NULL::uuid,
      NULL::uuid, NULL::text, NULL::text, false;
    RETURN;
  END IF;

  SELECT * INTO v_resolve
  FROM public.resolve_google_event_office(v_event.google_account_id, v_event.google_location_id);

  IF NOT COALESCE(v_resolve.matched, false) THEN
    -- Unknown account/location is never guessed; it is parked for Admin.
    UPDATE public.google_business_events
    SET routing_status = CASE
          WHEN v_resolve.reason = 'UNKNOWN_ACCOUNT' THEN 'UNKNOWN_ACCOUNT'
          ELSE 'UNKNOWN_LOCATION' END,
        processing_status = 'IGNORED',
        processed_at = now(),
        error_code = v_resolve.reason,
        updated_at = now()
    WHERE id = p_event_id;

    RETURN QUERY SELECT v_event.id, v_event.event_type, v_resolve.reason, NULL::uuid,
      NULL::uuid, NULL::text, NULL::text, false;
    RETURN;
  END IF;

  UPDATE public.google_business_events
  SET office_id = v_resolve.office_id,
      google_connection_id = COALESCE(v_resolve.google_connection_id, google_connection_id),
      google_account_id = COALESCE(google_account_id, v_resolve.google_account_id),
      routing_status = 'ROUTED',
      processing_status = 'QUEUED',
      updated_at = now()
  WHERE id = p_event_id;

  SELECT j.id, j.status INTO v_job_id, v_job_status
  FROM public.google_business_sync_jobs j
  WHERE j.office_id = v_resolve.office_id
    AND j.sync_type = v_sync_type
    AND j.status IN ('PENDING','RUNNING')
  LIMIT 1;

  IF v_job_id IS NULL THEN
    INSERT INTO public.google_business_sync_jobs (
      office_id, google_location_id, google_connection_id,
      sync_type, priority, trigger_event_id
    )
    VALUES (
      v_resolve.office_id, v_event.google_location_id, v_resolve.google_connection_id,
      v_sync_type, v_priority, p_event_id
    )
    RETURNING id INTO v_job_id;
  END IF;

  -- Record the event on the office mapping for the "last Google event" read.
  UPDATE public.office_google_profiles ogp
  SET last_google_event_at = GREATEST(COALESCE(ogp.last_google_event_at, now()), now()),
      updated_at = now()
  WHERE ogp.office_id = v_resolve.office_id;

  -- Fan out the immediate, office-facing alerts here. Reviews are notified by
  -- the review sync itself (with the star copy); health/VOM/duplicate only when
  -- the health refresh observes a real state transition, so repeat events do
  -- not spam Admin. That leaves profile-update and customer-media as the two
  -- events whose notification is the point of the event.
  IF v_event.event_type IN ('GOOGLE_UPDATE','NEW_CUSTOMER_MEDIA') THEN
    PERFORM public.notify_google_business_event(
      p_event_id,
      v_resolve.office_id,
      v_event.event_type,
      CASE WHEN v_event.event_type = 'NEW_CUSTOMER_MEDIA' THEN 'media' ELSE 'profile' END,
      NULL
    );
  END IF;

  RETURN QUERY SELECT
    v_event.id, v_event.event_type, 'ROUTED'::text, v_resolve.office_id,
    v_job_id, v_sync_type, v_priority, false;
END;
$fn$;

REVOKE ALL ON FUNCTION public.route_google_business_event(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.route_google_business_event(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 10. Sync job lifecycle
--
-- Creation is idempotent per (office, sync_type) via the partial unique index;
-- claim takes an owner token; finish only writes for the owning token and
-- retries a transient FAILED job until max_attempts.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_google_business_sync_job(
  p_office_id uuid,
  p_sync_type text,
  p_priority text DEFAULT 'NORMAL',
  p_trigger_event_id uuid DEFAULT NULL
)
RETURNS TABLE (job_id uuid, status text, is_existing boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_location_id text;
  v_connection_id uuid;
  v_job_id uuid;
  v_status text;
  v_existing boolean := false;
  v_component text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_sync_type NOT IN ('PROFILE','REVIEWS','MEDIA','POSTS','PERFORMANCE','HEALTH','FULL') THEN
    RAISE EXCEPTION 'Invalid sync_type';
  END IF;
  IF p_priority NOT IN ('CRITICAL','HIGH','NORMAL','LOW') THEN
    RAISE EXCEPTION 'Invalid priority';
  END IF;

  SELECT ogp.google_location_id, ogp.google_connection_id
  INTO v_location_id, v_connection_id
  FROM public.office_google_profiles ogp
  WHERE ogp.office_id = p_office_id;

  -- A FULL sync enqueues the component jobs plus a bookkeeping row.
  IF p_sync_type = 'FULL' THEN
    INSERT INTO public.google_business_sync_jobs (
      office_id, google_location_id, google_connection_id, sync_type, priority, trigger_event_id
    )
    VALUES (p_office_id, v_location_id, v_connection_id, 'FULL', p_priority, p_trigger_event_id)
    ON CONFLICT (office_id, sync_type) WHERE google_business_sync_jobs.status IN ('PENDING','RUNNING') DO NOTHING
    RETURNING id INTO v_job_id;

    IF v_job_id IS NULL THEN
      SELECT j.id INTO v_job_id FROM public.google_business_sync_jobs j
      WHERE j.office_id = p_office_id AND j.sync_type = 'FULL'
        AND j.status IN ('PENDING','RUNNING') LIMIT 1;
      v_existing := true;
    END IF;

    FOREACH v_component IN ARRAY ARRAY['PROFILE','REVIEWS','MEDIA','POSTS','PERFORMANCE','HEALTH']
    LOOP
      INSERT INTO public.google_business_sync_jobs (
        office_id, google_location_id, google_connection_id, sync_type, priority, trigger_event_id
      )
      VALUES (p_office_id, v_location_id, v_connection_id, v_component, p_priority, p_trigger_event_id)
      ON CONFLICT (office_id, sync_type) WHERE google_business_sync_jobs.status IN ('PENDING','RUNNING') DO NOTHING;
    END LOOP;

    RETURN QUERY SELECT v_job_id, 'PENDING'::text, v_existing;
    RETURN;
  END IF;

  INSERT INTO public.google_business_sync_jobs (
    office_id, google_location_id, google_connection_id, sync_type, priority, trigger_event_id
  )
  VALUES (p_office_id, v_location_id, v_connection_id, p_sync_type, p_priority, p_trigger_event_id)
  ON CONFLICT (office_id, sync_type) WHERE google_business_sync_jobs.status IN ('PENDING','RUNNING') DO NOTHING
  RETURNING id INTO v_job_id;

  IF v_job_id IS NULL THEN
    SELECT j.id, j.status INTO v_job_id, v_status
    FROM public.google_business_sync_jobs j
    WHERE j.office_id = p_office_id AND j.sync_type = p_sync_type
      AND j.status IN ('PENDING','RUNNING') LIMIT 1;
    RETURN QUERY SELECT v_job_id, COALESCE(v_status, 'PENDING'), true;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_job_id, 'PENDING'::text, false;
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_google_business_sync_job(uuid, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_google_business_sync_job(uuid, text, text, uuid)
  TO service_role;

-- Claim the highest-priority runnable job and take the owner lock.
CREATE OR REPLACE FUNCTION public.claim_google_business_sync_job(
  p_office_id uuid DEFAULT NULL,
  p_sync_types text[] DEFAULT NULL
)
RETURNS TABLE (
  job_id uuid,
  office_id uuid,
  sync_type text,
  priority text,
  lock_token text,
  google_location_id text,
  trigger_event_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_job_id uuid;
  v_token text := encode(gen_random_bytes(24), 'hex');
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT j.id INTO v_job_id
  FROM public.google_business_sync_jobs j
  WHERE j.status = 'PENDING'
    AND j.scheduled_at <= now()
    AND (p_office_id IS NULL OR j.office_id = p_office_id)
    AND (p_sync_types IS NULL OR j.sync_type = ANY (p_sync_types))
  ORDER BY
    CASE j.priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END,
    j.scheduled_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.google_business_sync_jobs
  SET status = 'RUNNING',
      started_at = now(),
      lock_token = v_token,
      locked_at = now(),
      attempt_count = attempt_count + 1,
      updated_at = now()
  WHERE id = v_job_id;

  RETURN QUERY
  SELECT j.id, j.office_id, j.sync_type, j.priority, v_token,
         j.google_location_id, j.trigger_event_id
  FROM public.google_business_sync_jobs j
  WHERE j.id = v_job_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.claim_google_business_sync_job(uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_google_business_sync_job(uuid, text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_google_business_sync_job(
  p_job_id uuid,
  p_token text,
  p_status text,
  p_records_processed integer DEFAULT 0,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_job record;
  v_retry boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_status NOT IN ('SUCCESS','PARTIAL','FAILED','CANCELLED') THEN
    RAISE EXCEPTION 'Invalid terminal status';
  END IF;

  SELECT * INTO v_job FROM public.google_business_sync_jobs j WHERE j.id = p_job_id;
  IF v_job.id IS NULL THEN
    RETURN false;
  END IF;

  -- Only the owner token may finalize a RUNNING job.
  IF v_job.status <> 'RUNNING' OR v_job.lock_token IS DISTINCT FROM p_token THEN
    RETURN false;
  END IF;

  -- A transient failure retries with backoff until max_attempts, then stays
  -- FAILED. The lock token is cleared on a retry so the job can be re-claimed.
  v_retry := p_status = 'FAILED' AND v_job.attempt_count < v_job.max_attempts;

  UPDATE public.google_business_sync_jobs
  SET status = CASE WHEN v_retry THEN 'PENDING' ELSE p_status END,
      completed_at = CASE WHEN v_retry THEN NULL ELSE now() END,
      scheduled_at = CASE
        WHEN v_retry THEN now() + make_interval(secs => LEAST(600, 10 * (2 ^ v_job.attempt_count))::int)
        ELSE scheduled_at END,
      lock_token = CASE WHEN v_retry THEN NULL ELSE lock_token END,
      locked_at = CASE WHEN v_retry THEN NULL ELSE locked_at END,
      records_processed = GREATEST(COALESCE(p_records_processed, 0), 0),
      last_error_code = p_error_code,
      last_error_message = p_error_message,
      updated_at = now()
  WHERE id = p_job_id;

  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.finish_google_business_sync_job(uuid, text, text, integer, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_google_business_sync_job(uuid, text, text, integer, text, text)
  TO service_role;


-- ---------------------------------------------------------------------------
-- 11. Health evaluation
--
-- Deterministic: a documented state, never a fabricated score. Pure helper so
-- it is unit-testable, plus the writer that records a change only when the
-- meaningful state actually changes.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.google_health_status_from_states(
  p_verification_state text,
  p_voice_of_merchant_state text,
  p_location_state text,
  p_duplicate_state text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT CASE
    WHEN UPPER(COALESCE(p_location_state, '')) IN ('SUSPENDED','DISABLED','UNAVAILABLE')
      THEN 'UNAVAILABLE'
    WHEN UPPER(COALESCE(p_voice_of_merchant_state, '')) IN
         ('LOST','NOT_GOOD_STANDING','NO_AUTHORITY','LOSS_OF_VOICE_OF_MERCHANT')
      THEN 'ACTION_REQUIRED'
    WHEN NULLIF(UPPER(COALESCE(p_duplicate_state, '')), '') IS NOT NULL
         AND UPPER(p_duplicate_state) NOT IN ('NONE','NONE_DETECTED')
      THEN 'ATTENTION'
    WHEN NULLIF(UPPER(COALESCE(p_verification_state, '')), '') IS NOT NULL
         AND UPPER(p_verification_state) <> 'VERIFIED'
      THEN 'ATTENTION'
    ELSE 'HEALTHY'
  END
$fn$;

-- Records the current health of a mapped office. Returns whether the state
-- changed, so the caller only notifies on a real transition (never on a repeat
-- of the same event).
CREATE OR REPLACE FUNCTION public.record_google_location_health(
  p_office_id uuid,
  p_google_location_id text DEFAULT NULL,
  p_verification_state text DEFAULT NULL,
  p_voice_of_merchant_state text DEFAULT NULL,
  p_location_state text DEFAULT NULL,
  p_duplicate_state text DEFAULT NULL,
  p_source text DEFAULT 'SYNC',
  p_event_type text DEFAULT 'HEALTH_CHECK',
  p_google_event_id uuid DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS TABLE (
  health_status text,
  previous_status text,
  changed boolean,
  health_event_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_new text;
  v_previous text;
  v_health_id uuid;
  v_health_event_id uuid;
  v_location text := NULLIF(btrim(COALESCE(p_google_location_id, '')), '');
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_source NOT IN ('EVENT','SYNC','ADMIN','RECONCILE') THEN
    RAISE EXCEPTION 'Invalid source';
  END IF;

  v_new := public.google_health_status_from_states(
    p_verification_state, p_voice_of_merchant_state, p_location_state, p_duplicate_state);

  SELECT h.health_status INTO v_previous
  FROM public.google_business_location_health h
  WHERE h.office_id = p_office_id;

  INSERT INTO public.google_business_location_health (
    office_id, google_location_id, verification_state, voice_of_merchant_state,
    location_state, duplicate_state, health_status, last_checked_at, last_event_at,
    last_error_code, last_error_message
  )
  VALUES (
    p_office_id,
    COALESCE(v_location, (SELECT ogp.google_location_id FROM public.office_google_profiles ogp WHERE ogp.office_id = p_office_id)),
    NULLIF(btrim(COALESCE(p_verification_state, '')), ''),
    NULLIF(btrim(COALESCE(p_voice_of_merchant_state, '')), ''),
    NULLIF(btrim(COALESCE(p_location_state, '')), ''),
    NULLIF(btrim(COALESCE(p_duplicate_state, '')), ''),
    v_new, now(), now(),
    NULLIF(btrim(COALESCE(p_error_code, '')), ''),
    NULLIF(btrim(COALESCE(p_error_message, '')), '')
  )
  ON CONFLICT (office_id) DO UPDATE SET
    google_location_id = COALESCE(EXCLUDED.google_location_id, public.google_business_location_health.google_location_id),
    verification_state = COALESCE(EXCLUDED.verification_state, public.google_business_location_health.verification_state),
    voice_of_merchant_state = COALESCE(EXCLUDED.voice_of_merchant_state, public.google_business_location_health.voice_of_merchant_state),
    location_state = COALESCE(EXCLUDED.location_state, public.google_business_location_health.location_state),
    duplicate_state = COALESCE(EXCLUDED.duplicate_state, public.google_business_location_health.duplicate_state),
    health_status = EXCLUDED.health_status,
    last_checked_at = now(),
    last_event_at = now(),
    last_error_code = EXCLUDED.last_error_code,
    last_error_message = EXCLUDED.last_error_message,
    updated_at = now()
  RETURNING id INTO v_health_id;

  UPDATE public.office_google_profiles
  SET health_status = v_new, updated_at = now()
  WHERE office_id = p_office_id;

  -- Only a genuine transition is history-worthy.
  IF v_previous IS DISTINCT FROM v_new THEN
    INSERT INTO public.google_business_health_events (
      office_id, google_location_id, event_type, previous_state, new_state, source, google_event_id
    )
    VALUES (
      p_office_id, v_location, p_event_type, v_previous, v_new, p_source, p_google_event_id
    )
    RETURNING id INTO v_health_event_id;
  END IF;

  RETURN QUERY SELECT v_new, v_previous, (v_previous IS DISTINCT FROM v_new), v_health_event_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.record_google_location_health(uuid, text, text, text, text, text, text, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_google_location_health(uuid, text, text, text, text, text, text, text, uuid, text, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 12. Notification fan-out
--
-- Recipients are re-resolved at send time: the office's live operators (active
-- membership + active profile) plus every active Admin. A role change or
-- deactivation therefore takes effect on the very next event, and a
-- notification for one office can never reach another office's team.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.emit_google_notification(
  _user_id uuid,
  _office_id uuid,
  _entity_type text,
  _entity_id text,
  _google_event_type text,
  _title_en text,
  _title_ar text,
  _body_en text,
  _body_ar text,
  _link text DEFAULT NULL,
  _dedupe_key text DEFAULT NULL,
  _priority text DEFAULT 'medium'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    user_id, title, body, source, title_en, title_ar, body_en, body_ar,
    link, dedupe_key, office_id, entity_type, entity_id, google_event_type, priority
  )
  VALUES (
    _user_id, _title_en, _body_en, 'google_business', _title_en, _title_ar, _body_en, _body_ar,
    _link, _dedupe_key, _office_id, _entity_type, _entity_id, _google_event_type, _priority
  )
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END;
$fn$;

REVOKE ALL ON FUNCTION public.emit_google_notification(uuid, uuid, text, text, text, text, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emit_google_notification(uuid, uuid, text, text, text, text, text, text, text, text, text, text)
  TO service_role;

-- Notifies the correct users for one routed event. Idempotent per
-- (event, recipient): a redelivered event cannot duplicate a user notification.
CREATE OR REPLACE FUNCTION public.notify_google_business_event(
  p_event_id uuid,
  p_office_id uuid,
  p_event_type text,
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_extra jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_office_name text;
  v_recipient uuid;
  v_count integer := 0;
  v_title_en text;
  v_title_ar text;
  v_body_en text;
  v_body_ar text;
  v_link text;
  v_priority text;
  v_dedupe text;
  v_audience text; -- 'office' | 'admin' | 'both'
  v_summary text;
BEGIN
  -- Called by the service-role webhook path, and by the event router when an
  -- AAL2 admin replays a dead-lettered event through normal processing. The
  -- recipients are always derived server-side, never from the caller.
  IF NOT (auth.role() = 'service_role' OR public.is_admin_session()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT COALESCE(NULLIF(o.name_en, ''), o.name_ar, 'Office')
  INTO v_office_name
  FROM public.offices o WHERE o.id = p_office_id;

  -- Copy is factual, never alarmist.
  CASE p_event_type
    WHEN 'NEW_REVIEW' THEN
      v_title_en := 'New Google review'; v_title_ar := 'تقييم جديد على Google';
      v_summary := COALESCE(p_extra->>'summary', 'A new review was posted.');
      v_link := '/team/google/reviews';
      v_priority := 'high'; v_audience := 'both';
    WHEN 'UPDATED_REVIEW' THEN
      v_title_en := 'Google review updated'; v_title_ar := 'تم تحديث تقييم على Google';
      v_summary := COALESCE(p_extra->>'summary', 'An existing review changed.');
      v_link := '/team/google/reviews';
      v_priority := 'medium'; v_audience := 'office';
    WHEN 'NEW_CUSTOMER_MEDIA' THEN
      v_title_en := 'New customer photo'; v_title_ar := 'صورة جديدة من عميل';
      v_summary := COALESCE(p_extra->>'summary', 'A customer contributed a new photo.');
      v_link := '/team/google/photos';
      v_priority := 'medium'; v_audience := 'office';
    WHEN 'GOOGLE_UPDATE' THEN
      v_title_en := 'Google profile update available'; v_title_ar := 'يتوفر تحديث لملف Google';
      v_summary := COALESCE(p_extra->>'summary', 'Google has an update that should be reviewed.');
      v_link := '/team/google/profile';
      v_priority := 'high'; v_audience := 'both';
    WHEN 'UPDATED_LOCATION_STATE' THEN
      v_title_en := 'Google location status changed'; v_title_ar := 'تغيّرت حالة الموقع على Google';
      v_summary := COALESCE(p_extra->>'summary', 'The Google location state changed.');
      v_link := '/team/google';
      v_priority := 'high'; v_audience := 'both';
    WHEN 'DUPLICATE_LOCATION' THEN
      v_title_en := 'Potential duplicate location'; v_title_ar := 'موقع مكرر محتمل';
      v_summary := COALESCE(p_extra->>'summary', 'Google reported a possible duplicate location.');
      v_link := '/team/google';
      v_priority := 'high'; v_audience := 'admin';
    WHEN 'VOICE_OF_MERCHANT_UPDATED' THEN
      v_title_en := 'Voice of Merchant status changed'; v_title_ar := 'تغيّرت حالة Voice of Merchant';
      v_summary := COALESCE(p_extra->>'summary', 'The merchant standing on Google changed.');
      v_link := '/team/google';
      v_priority := 'high'; v_audience := 'admin';
    WHEN 'GOOGLE_SYNC_FAILED' THEN
      v_title_en := 'Google sync failed'; v_title_ar := 'فشلت مزامنة Google';
      v_summary := COALESCE(p_extra->>'summary', 'A Google synchronization failed.');
      v_link := '/team/google';
      v_priority := 'medium'; v_audience := 'admin';
    WHEN 'GOOGLE_CONNECTION_ERROR' THEN
      v_title_en := 'Google Business connection needs attention';
      v_title_ar := 'اتصال Google Business يحتاج إلى انتباه';
      v_summary := COALESCE(p_extra->>'summary', 'The Google connection requires Admin attention.');
      v_link := '/admin/offices';
      v_priority := 'high'; v_audience := 'admin';
    ELSE
      RETURN 0;
  END CASE;

  v_body_en := v_summary || ' — ' || v_office_name;
  v_body_ar := v_summary || ' — ' || v_office_name;

  -- Deep-link straight to the review the event named, so a click lands on the
  -- review itself rather than the generic list. The route re-checks office
  -- authorization, so the link is convenience, not access control.
  IF v_link = '/team/google/reviews' AND p_entity_id IS NOT NULL THEN
    v_link := v_link || '?review=' || p_entity_id;
  END IF;

  IF v_audience IN ('office','both') THEN
    FOR v_recipient IN
      SELECT ogo.team_member_id
      FROM public.office_google_operators ogo
      JOIN public.office_members om
        ON om.office_id = ogo.office_id AND om.user_id = ogo.team_member_id AND om.is_active = true
      JOIN public.profiles p
        ON p.id = ogo.team_member_id AND p.deleted_at IS NULL AND p.deactivated_at IS NULL
      WHERE ogo.office_id = p_office_id
    LOOP
      v_dedupe := 'google_event:' || p_event_id::text || ':' || v_recipient::text;
      PERFORM public.emit_google_notification(
        v_recipient, p_office_id, p_entity_type, p_entity_id, p_event_type,
        v_title_en, v_title_ar, v_body_en, v_body_ar, v_link, v_dedupe, v_priority);
      v_count := v_count + 1;
    END LOOP;
  END IF;

  IF v_audience IN ('admin','both') THEN
    FOR v_recipient IN
      SELECT ur.user_id
      FROM public.user_roles ur
      JOIN public.profiles p
        ON p.id = ur.user_id AND p.deleted_at IS NULL AND p.deactivated_at IS NULL
      WHERE ur.role = 'admin'::public.app_role
    LOOP
      v_dedupe := 'google_event:' || p_event_id::text || ':' || v_recipient::text;
      PERFORM public.emit_google_notification(
        v_recipient, p_office_id, p_entity_type, p_entity_id, p_event_type,
        v_title_en, v_title_ar, v_body_en, v_body_ar, v_link, v_dedupe, v_priority);
      v_count := v_count + 1;
    END LOOP;
  END IF;

  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION public.notify_google_business_event(uuid, uuid, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_google_business_event(uuid, uuid, text, text, text, jsonb)
  TO service_role;


-- ---------------------------------------------------------------------------
-- 13. Event processing state + dead letters
--
-- `mark_google_business_event` is the worker's terminal write. A FAILED event
-- that exhausts its attempts becomes DEAD_LETTERED and increments the
-- connection's dead-letter counter for the admin health page.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_google_business_event(
  p_event_id uuid,
  p_status text,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_event record;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_status NOT IN ('PROCESSING','PROCESSED','DUPLICATE','FAILED','DEAD_LETTERED','IGNORED','QUEUED') THEN
    RAISE EXCEPTION 'Invalid processing status';
  END IF;

  SELECT * INTO v_event FROM public.google_business_events e WHERE e.id = p_event_id;
  IF v_event.id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.google_business_events
  SET processing_status = p_status,
      attempt_count = attempt_count + CASE WHEN p_status IN ('PROCESSING','FAILED') THEN 1 ELSE 0 END,
      processed_at = CASE WHEN p_status IN ('PROCESSED','DUPLICATE','DEAD_LETTERED','IGNORED') THEN now() ELSE processed_at END,
      error_code = p_error_code,
      error_message = p_error_message,
      updated_at = now()
  WHERE id = p_event_id;

  IF v_event.google_connection_id IS NOT NULL THEN
    UPDATE public.google_business_connections
    SET last_event_processed_at = CASE WHEN p_status IN ('PROCESSED','DUPLICATE') THEN now() ELSE last_event_processed_at END,
        event_failure_count = event_failure_count + CASE WHEN p_status = 'FAILED' THEN 1 ELSE 0 END,
        dead_letter_count = dead_letter_count + CASE WHEN p_status = 'DEAD_LETTERED' THEN 1 ELSE 0 END,
        updated_at = now()
    WHERE id = v_event.google_connection_id;
  END IF;

  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mark_google_business_event(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_google_business_event(uuid, text, text, text)
  TO service_role;

-- Admin retry of a dead-lettered event: re-queue it for normal processing.
CREATE OR REPLACE FUNCTION public.admin_retry_google_business_event(p_event_id uuid)
RETURNS TABLE (event_id uuid, processing_status text, sync_job_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_event record;
  v_job_id uuid;
  v_sync_type text;
  v_priority text;
BEGIN
  IF NOT (public.is_admin_session() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_event FROM public.google_business_events e WHERE e.id = p_event_id;
  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- Only a failed/dead-lettered event may be retried; a processed event is
  -- already accounted for and must not produce a second notification.
  IF v_event.processing_status NOT IN ('FAILED','DEAD_LETTERED') THEN
    RAISE EXCEPTION 'Only a failed or dead-lettered event can be retried';
  END IF;

  UPDATE public.google_business_events
  SET processing_status = 'RECEIVED',
      error_code = NULL,
      error_message = NULL,
      updated_at = now()
  WHERE id = p_event_id;

  SELECT r.sync_job_id, r.sync_type, r.priority
  INTO v_job_id, v_sync_type, v_priority
  FROM public.route_google_business_event(p_event_id) r;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role, action,
    resource_type, resource_id, after_data
  )
  VALUES (
    v_event.office_id, v_event.google_location_id, auth.uid(), 'admin',
    'GOOGLE_EVENT_RETRIED', 'google_business_events', p_event_id::text,
    jsonb_build_object('event_type', v_event.event_type)
  );

  RETURN QUERY SELECT p_event_id, 'QUEUED'::text, v_job_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_retry_google_business_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_retry_google_business_event(uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 14. Read RPCs — admin integration health, event timeline, dead letters
-- ---------------------------------------------------------------------------

-- Raw events are admin-only. payload_json is exposed only here, never through
-- the table (which has no browser grant at all).
CREATE OR REPLACE FUNCTION public.admin_list_google_business_events(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_status text DEFAULT NULL,
  p_office_id uuid DEFAULT NULL
)
RETURNS TABLE (
  event_id uuid,
  event_type text,
  routing_status text,
  processing_status text,
  office_id uuid,
  office_name text,
  google_account_id text,
  google_location_id text,
  google_resource_name text,
  google_message_id text,
  google_event_id text,
  payload_hash text,
  attempt_count integer,
  error_code text,
  error_message text,
  received_at timestamptz,
  processed_at timestamptz,
  payload_json jsonb,
  total_count bigint
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
    e.id, e.event_type, e.routing_status, e.processing_status, e.office_id,
    COALESCE(NULLIF(o.name_en, ''), o.name_ar) AS office_name,
    e.google_account_id, e.google_location_id, e.google_resource_name,
    e.google_message_id, e.google_event_id, e.payload_hash,
    e.attempt_count, e.error_code, e.error_message, e.received_at, e.processed_at,
    e.payload_json,
    count(*) OVER () AS total_count
  FROM public.google_business_events e
  LEFT JOIN public.offices o ON o.id = e.office_id
  WHERE (p_status IS NULL OR e.processing_status = p_status)
    AND (p_office_id IS NULL OR e.office_id = p_office_id)
  ORDER BY e.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_list_google_business_events(integer, integer, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_google_business_events(integer, integer, text, uuid)
  TO authenticated, service_role;

-- The Google event timeline: one row per event, office resolved, for the Admin
-- operations page. Same payload protection as above (no payload_json here).
CREATE OR REPLACE FUNCTION public.admin_google_event_timeline(
  p_limit integer DEFAULT 100,
  p_office_id uuid DEFAULT NULL
)
RETURNS TABLE (
  event_id uuid,
  event_type text,
  routing_status text,
  processing_status text,
  office_id uuid,
  office_name text,
  google_location_id text,
  received_at timestamptz,
  processed_at timestamptz
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
    e.id, e.event_type, e.routing_status, e.processing_status, e.office_id,
    COALESCE(NULLIF(o.name_en, ''), o.name_ar) AS office_name,
    e.google_location_id, e.received_at, e.processed_at
  FROM public.google_business_events e
  LEFT JOIN public.offices o ON o.id = e.office_id
  WHERE (p_office_id IS NULL OR e.office_id = p_office_id)
  ORDER BY e.received_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_google_event_timeline(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_google_event_timeline(integer, uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_list_google_dead_letters(
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  event_id uuid,
  event_type text,
  office_id uuid,
  office_name text,
  google_location_id text,
  error_code text,
  error_message text,
  attempt_count integer,
  received_at timestamptz,
  processed_at timestamptz
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
    e.id, e.event_type, e.office_id,
    COALESCE(NULLIF(o.name_en, ''), o.name_ar) AS office_name,
    e.google_location_id, e.error_code, e.error_message, e.attempt_count,
    e.received_at, e.processed_at
  FROM public.google_business_events e
  LEFT JOIN public.offices o ON o.id = e.office_id
  WHERE e.processing_status = 'DEAD_LETTERED'
  ORDER BY e.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_list_google_dead_letters(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_google_dead_letters(integer)
  TO authenticated, service_role;

-- Global integration health: connection + Pub/Sub status, per-state office
-- counts, event counters, and sync-job counts. No fabricated "healthy after X".
CREATE OR REPLACE FUNCTION public.admin_google_integration_health()
RETURNS TABLE (
  connection_id uuid,
  google_email text,
  connection_status text,
  pubsub_status text,
  pubsub_topic text,
  pubsub_subscription text,
  notification_types text[],
  mapped_offices integer,
  healthy_mappings integer,
  last_event_received_at timestamptz,
  last_event_processed_at timestamptz,
  event_failure_count integer,
  dead_letter_count integer,
  pending_events bigint,
  failed_events bigint,
  dead_lettered_events bigint,
  pending_jobs bigint,
  running_jobs bigint,
  failed_jobs bigint,
  offices_action_required integer,
  offices_attention integer
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
    c.id,
    c.google_email,
    c.connection_status,
    c.pubsub_status,
    c.pubsub_topic,
    c.pubsub_subscription,
    c.notification_types,
    (SELECT count(*)::integer FROM public.office_google_profiles ogp WHERE ogp.mapping_status = 'MAPPED'),
    (SELECT count(*)::integer FROM public.office_google_profiles ogp WHERE ogp.mapping_status = 'MAPPED' AND ogp.connection_status = 'connected'),
    c.last_event_received_at,
    c.last_event_processed_at,
    c.event_failure_count,
    c.dead_letter_count,
    (SELECT count(*) FROM public.google_business_events e WHERE e.processing_status IN ('RECEIVED','QUEUED')),
    (SELECT count(*) FROM public.google_business_events e WHERE e.processing_status = 'FAILED'),
    (SELECT count(*) FROM public.google_business_events e WHERE e.processing_status = 'DEAD_LETTERED'),
    (SELECT count(*) FROM public.google_business_sync_jobs j WHERE j.status = 'PENDING'),
    (SELECT count(*) FROM public.google_business_sync_jobs j WHERE j.status = 'RUNNING'),
    (SELECT count(*) FROM public.google_business_sync_jobs j WHERE j.status = 'FAILED'),
    (SELECT count(*)::integer FROM public.google_business_location_health h WHERE h.health_status = 'ACTION_REQUIRED'),
    (SELECT count(*)::integer FROM public.google_business_location_health h WHERE h.health_status = 'ATTENTION')
  FROM public.google_business_connections c
  ORDER BY (c.connection_status = 'connected') DESC, c.created_at DESC
  LIMIT 1;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_google_integration_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_google_integration_health()
  TO authenticated, service_role;

-- Admin global alerts: offices needing attention, derived from health + review
-- backlog. Measurement, not a score.
CREATE OR REPLACE FUNCTION public.admin_google_attention_offices()
RETURNS TABLE (
  office_id uuid,
  office_name text,
  health_status text,
  unanswered_reviews integer,
  health_reason text,
  last_event_at timestamptz
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
    ogp.office_id,
    COALESCE(NULLIF(o.name_en, ''), o.name_ar) AS office_name,
    COALESCE(h.health_status, ogp.health_status, 'UNKNOWN') AS health_status,
    COALESCE((
      SELECT count(*)::integer FROM public.google_business_reviews r
      WHERE r.office_id = ogp.office_id
        AND r.visibility_state = 'ACTIVE'
        AND r.darb_reply_status = 'UNANSWERED'
    ), 0) AS unanswered_reviews,
    h.last_error_message AS health_reason,
    ogp.last_google_event_at
  FROM public.office_google_profiles ogp
  JOIN public.offices o ON o.id = ogp.office_id AND o.deleted_at IS NULL
  LEFT JOIN public.google_business_location_health h ON h.office_id = ogp.office_id
  WHERE ogp.mapping_status = 'MAPPED'
    AND (
      COALESCE(h.health_status, ogp.health_status, 'UNKNOWN') IN ('ATTENTION','ACTION_REQUIRED','UNAVAILABLE')
      OR EXISTS (
        SELECT 1 FROM public.google_business_reviews r
        WHERE r.office_id = ogp.office_id
          AND r.visibility_state = 'ACTIVE'
          AND r.darb_reply_status = 'UNANSWERED'
      )
    )
  ORDER BY
    CASE COALESCE(h.health_status, ogp.health_status, 'UNKNOWN')
      WHEN 'ACTION_REQUIRED' THEN 0 WHEN 'UNAVAILABLE' THEN 1 WHEN 'ATTENTION' THEN 2 ELSE 3 END,
    office_name;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_google_attention_offices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_google_attention_offices()
  TO authenticated, service_role;

-- Office-scoped health + sync status for Primary/Side (GOOGLE_VIEW_HEALTH).
CREATE OR REPLACE FUNCTION public.get_office_google_health(p_office_id uuid)
RETURNS TABLE (
  office_id uuid,
  health_status text,
  verification_state text,
  voice_of_merchant_state text,
  location_state text,
  duplicate_state text,
  last_checked_at timestamptz,
  last_event_at timestamptz,
  last_google_event_at timestamptz,
  last_error_code text,
  last_error_message text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_VIEW_HEALTH') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    ogp.office_id,
    COALESCE(h.health_status, ogp.health_status, 'UNKNOWN'),
    h.verification_state, h.voice_of_merchant_state, h.location_state, h.duplicate_state,
    h.last_checked_at, h.last_event_at, ogp.last_google_event_at,
    h.last_error_code, h.last_error_message
  FROM public.office_google_profiles ogp
  LEFT JOIN public.google_business_location_health h ON h.office_id = ogp.office_id
  WHERE ogp.office_id = p_office_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_office_google_health(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_office_google_health(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_office_google_health_events(
  p_office_id uuid,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  health_event_id uuid,
  event_type text,
  previous_state text,
  new_state text,
  source text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_VIEW_HEALTH') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;


  RETURN QUERY
  SELECT h.id, h.event_type, h.previous_state, h.new_state, h.source, h.created_at
  FROM public.google_business_health_events h
  WHERE h.office_id = p_office_id
  ORDER BY h.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
END;
$fn$;

REVOKE ALL ON FUNCTION public.list_office_google_health_events(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_office_google_health_events(uuid, integer)
  TO authenticated, service_role;

-- Office-scoped sync job list + progress (GOOGLE_VIEW_SYNC_STATUS).
CREATE OR REPLACE FUNCTION public.list_office_google_sync_jobs(
  p_office_id uuid,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  job_id uuid,
  sync_type text,
  priority text,
  status text,
  attempt_count integer,
  max_attempts integer,
  records_processed integer,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_VIEW_SYNC_STATUS') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT j.id, j.sync_type, j.priority, j.status, j.attempt_count, j.max_attempts,
         j.records_processed, j.scheduled_at, j.started_at, j.completed_at,
         j.last_error_code, j.last_error_message, j.created_at
  FROM public.google_business_sync_jobs j
  WHERE j.office_id = p_office_id
  ORDER BY j.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
END;
$fn$;

REVOKE ALL ON FUNCTION public.list_office_google_sync_jobs(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_office_google_sync_jobs(uuid, integer)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 15. Notification category + Pub/Sub configuration
-- ---------------------------------------------------------------------------

-- Google Business notifications keep their own source so the settings UI can
-- label them; the category bucket stays 'system' (Google alerts are operational,
-- not a student/profile/message category).
CREATE OR REPLACE FUNCTION public.notification_category_for_source(_source text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _source IN ('direct_message', 'case_message', 'chat') THEN 'messages'
    WHEN _source IN ('appointment', 'appointment_reminder') THEN 'appointments'
    WHEN _source IN ('case', 'case_status', 'case_event', 'student_profile_updated',
                     'case_created', 'case_assigned', 'case_submitted') THEN 'cases'
    WHEN _source IN ('payout', 'payment', 'commission', 'enrollment') THEN 'payments'
    WHEN _source IN ('document', 'document_request', 'document_uploaded') THEN 'documents'
    WHEN _source IN ('profile', 'profile_incomplete') THEN 'profile'
    WHEN _source IN ('recruit', 'recruitment', 'partner_recruit', 'recruit_application') THEN 'recruitment'
    WHEN _source IN ('google_business') THEN 'system'
    ELSE 'system'
  END
$function$;

-- Admin-only: persist the verified account-level Pub/Sub configuration. Google
-- allows exactly one notification setting and one topic per Google Business
-- account, so this is deliberately a single-connection write, never per office.
CREATE OR REPLACE FUNCTION public.admin_update_google_pubsub_config(
  p_connection_id uuid,
  p_topic text DEFAULT NULL,
  p_subscription text DEFAULT NULL,
  p_status text DEFAULT 'not_configured',
  p_notification_types text[] DEFAULT NULL
)
RETURNS TABLE (connection_id uuid, pubsub_status text, pubsub_topic text, notification_types text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_before jsonb;
BEGIN
  IF NOT public.is_admin_session() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_status NOT IN ('not_configured','connecting','connected','misconfigured','error') THEN
    RAISE EXCEPTION 'Invalid pubsub status';
  END IF;

  SELECT jsonb_build_object(
    'pubsub_status', c.pubsub_status, 'pubsub_topic', c.pubsub_topic,
    'notification_types', c.notification_types)
  INTO v_before
  FROM public.google_business_connections c WHERE c.id = p_connection_id;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Connection not found';
  END IF;

  UPDATE public.google_business_connections
  SET pubsub_topic = NULLIF(btrim(COALESCE(p_topic, '')), ''),
      pubsub_subscription = NULLIF(btrim(COALESCE(p_subscription, '')), ''),
      pubsub_status = p_status,
      notification_types = COALESCE(p_notification_types, notification_types),
      notification_setting_verified_at = CASE WHEN p_status = 'connected' THEN now() ELSE notification_setting_verified_at END,
      updated_at = now()
  WHERE id = p_connection_id;

  INSERT INTO public.google_business_activity (
    office_id, actor_user_id, actor_role, action, resource_type, resource_id,
    before_data, after_data
  )
  VALUES (
    NULL, auth.uid(), 'admin', 'GOOGLE_PUBSUB_CONFIG_UPDATED', 'google_business_connections',
    p_connection_id::text, v_before,
    jsonb_build_object('pubsub_status', p_status, 'pubsub_topic', p_topic,
                       'notification_types', p_notification_types)
  );

  RETURN QUERY
  SELECT c.id, c.pubsub_status, c.pubsub_topic, c.notification_types
  FROM public.google_business_connections c WHERE c.id = p_connection_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_update_google_pubsub_config(uuid, text, text, text, text[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_google_pubsub_config(uuid, text, text, text, text[])
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 16. Reconciliation enqueue
--
-- Scheduled work only ENQUEUES jobs; the worker performs the Google calls. The
-- schedule never touches Google auth rules directly. Each office gets at most
-- one active job per type (the partial unique index), so a re-run of the cron
-- cannot stack duplicates.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enqueue_google_reconciliation_jobs(
  p_sync_type text,
  p_priority text DEFAULT 'LOW'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_count integer := 0;
  v_office record;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_sync_type NOT IN ('PROFILE','REVIEWS','MEDIA','POSTS','PERFORMANCE','HEALTH','FULL') THEN
    RAISE EXCEPTION 'Invalid sync_type';
  END IF;

  FOR v_office IN
    SELECT ogp.office_id
    FROM public.office_google_profiles ogp
    JOIN public.offices o ON o.id = ogp.office_id AND o.deleted_at IS NULL
    WHERE ogp.mapping_status = 'MAPPED'
      AND ogp.google_location_id IS NOT NULL
      AND ogp.connection_status = 'connected'
  LOOP
    INSERT INTO public.google_business_sync_jobs (office_id, sync_type, priority)
    SELECT v_office.office_id, p_sync_type, p_priority
    WHERE NOT EXISTS (
      SELECT 1 FROM public.google_business_sync_jobs j
      WHERE j.office_id = v_office.office_id
        AND j.sync_type = p_sync_type
        AND j.status IN ('PENDING','RUNNING')
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION public.enqueue_google_reconciliation_jobs(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_google_reconciliation_jobs(text, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 17. RLS + privileges
--
-- Raw events and sync jobs are technical integration data: admin-only reads,
-- no browser writes at all. Location health is readable by the office's active
-- members (they see their own office's health) and by admins. Health history is
-- admin-only.
-- ---------------------------------------------------------------------------

ALTER TABLE public.google_business_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_business_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_business_location_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_business_health_events ENABLE ROW LEVEL SECURITY;

-- Raw events: admin-only. The table itself has NO grant to any browser role, so
-- even an admin reads through the SECURITY DEFINER RPC.
DROP POLICY IF EXISTS "Admins read google business events" ON public.google_business_events;
CREATE POLICY "Admins read google business events"
ON public.google_business_events FOR SELECT TO authenticated
USING (public.is_admin_session());

DROP POLICY IF EXISTS "Admins read google sync jobs" ON public.google_business_sync_jobs;
CREATE POLICY "Admins read google sync jobs"
ON public.google_business_sync_jobs FOR SELECT TO authenticated
USING (
  public.is_admin_session()
  OR EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.office_id = google_business_sync_jobs.office_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
  )
);

DROP POLICY IF EXISTS "Office members read google location health" ON public.google_business_location_health;
CREATE POLICY "Office members read google location health"
ON public.google_business_location_health FOR SELECT TO authenticated
USING (
  public.is_admin_session()
  OR EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.office_id = google_business_location_health.office_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
  )
);

-- Health history can name integration problems; admin-only.
DROP POLICY IF EXISTS "Admins read google health events" ON public.google_business_health_events;
CREATE POLICY "Admins read google health events"
ON public.google_business_health_events FOR SELECT TO authenticated
USING (public.is_admin_session());

-- Browser roles: no write grant anywhere. Raw events have no SELECT grant at all.
REVOKE ALL ON public.google_business_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.google_business_sync_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.google_business_location_health FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.google_business_health_events FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.google_business_sync_jobs TO authenticated;
GRANT SELECT ON public.google_business_location_health TO authenticated;

GRANT ALL ON public.google_business_events TO service_role;
GRANT ALL ON public.google_business_sync_jobs TO service_role;
GRANT ALL ON public.google_business_location_health TO service_role;
GRANT ALL ON public.google_business_health_events TO service_role;

-- Realtime for the dashboard: notifications (bell), sync status and health.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'google_business_sync_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.google_business_sync_jobs;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'google_business_location_health'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.google_business_location_health;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 18. Office-scoped review notification (supersedes Phase 5's global fan-out)
--
-- Phase 5 notified every admin regardless of office and ignored deactivation.
-- Phase 9 tightens the same call site: the office's own operators (an active
-- office membership AND an active profile) plus admins who monitor all
-- offices. `admin_sync_google_reviews` still calls this by name, so the
-- signature is unchanged and no caller needs to move.
--
-- NOTE: unlike the Phase 5 original this does NOT touch the legacy global
-- `google_review` source; it emits the office-scoped `google_business` source
-- with the review as its entity, so the office/Admin RLS on notifications and
-- the click-through route both resolve correctly.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_new_google_review(
  p_office_id uuid,
  p_review_id uuid,
  p_star_rating integer,
  p_reviewer text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_office_name text;
  v_reviewer text := COALESCE(NULLIF(btrim(p_reviewer), ''), 'A customer');
  v_stars text := repeat('★', GREATEST(LEAST(COALESCE(p_star_rating, 0), 5), 1));
  v_dedupe_prefix text := 'google_review:' || p_review_id::text;
  v_title_en text := 'New Google review';
  v_title_ar text := 'تقييم جديد على Google';
  v_body_en text;
  v_body_ar text;
  v_recipient uuid;
BEGIN
  SELECT COALESCE(NULLIF(o.name_en, ''), o.name_ar, 'Office')
  INTO v_office_name
  FROM public.offices o WHERE o.id = p_office_id;

  v_body_en := v_stars || ' ' || v_reviewer || ' left a new review for ' || v_office_name || '.';
  v_body_ar := v_stars || ' ' || v_reviewer || ' ترك تقييماً جديداً لمكتب ' || v_office_name || '.';

  -- The office's active operators only.
  FOR v_recipient IN
    SELECT ogo.team_member_id
    FROM public.office_google_operators ogo
    JOIN public.office_members om
      ON om.office_id = ogo.office_id AND om.user_id = ogo.team_member_id AND om.is_active = true
    JOIN public.profiles p
      ON p.id = ogo.team_member_id AND p.deleted_at IS NULL AND p.deactivated_at IS NULL
    WHERE ogo.office_id = p_office_id
  LOOP
    PERFORM public.emit_google_notification(
      v_recipient, p_office_id, 'review', p_review_id::text, 'NEW_REVIEW',
      v_title_en, v_title_ar, v_body_en, v_body_ar, '/team/google/reviews',
      -- The recipient is part of the key: the unique index is on dedupe_key
      -- alone, so a shared key would let only the first recipient win.
      v_dedupe_prefix || ':' || v_recipient::text, 'high');
  END LOOP;

  -- Admins monitor every office.
  FOR v_recipient IN
    SELECT ur.user_id
    FROM public.user_roles ur
    JOIN public.profiles p
      ON p.id = ur.user_id AND p.deleted_at IS NULL AND p.deactivated_at IS NULL
    WHERE ur.role = 'admin'::public.app_role
  LOOP
    PERFORM public.emit_google_notification(
      v_recipient, p_office_id, 'review', p_review_id::text, 'NEW_REVIEW',
      v_title_en, v_title_ar, v_body_en, v_body_ar, '/team/google/reviews',
      v_dedupe_prefix || ':' || v_recipient::text, 'high');
  END LOOP;
END;
$fn$;

REVOKE ALL ON FUNCTION public.notify_new_google_review(uuid, uuid, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_new_google_review(uuid, uuid, integer, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 19. Let the background worker read an office mapping
--
-- Phase 4's get_office_google_mapping authorizes an Admin session or an active
-- office member. The Phase 9 worker (sync jobs, reconciliation) runs as the
-- service role with no user session, so it would be refused its own office's
-- mapping. Redefined here with the service-role allowance; the browser path is
-- unchanged.
-- ---------------------------------------------------------------------------

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
  updated_at timestamptz,
  primary_is_active boolean,
  side_manager_is_active boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin_session()
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
    ogp.updated_at,
    (primary_op.team_member_id IS NOT NULL
      AND public.is_active_team_member(primary_op.team_member_id)
      AND EXISTS (
        SELECT 1 FROM public.office_members om
        WHERE om.office_id = ogp.office_id
          AND om.user_id = primary_op.team_member_id
          AND om.is_active = true)),
    (side_op.team_member_id IS NOT NULL
      AND public.is_active_team_member(side_op.team_member_id)
      AND EXISTS (
        SELECT 1 FROM public.office_members om
        WHERE om.office_id = ogp.office_id
          AND om.user_id = side_op.team_member_id
          AND om.is_active = true))
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
-- 20. Scheduled reconciliation + worker drain
--
-- Real-time events are not enough: a webhook outage, a misconfigured
-- subscription or a transient API failure can leave the cache incomplete, so a
-- schedule re-enqueues each sync type. The schedule only ENQUEUES; the actual
-- Google calls stay in the worker, which uses GoogleAuthService (Phase 2) like
-- every other path.
--
-- The worker is a server route, not a Supabase Edge Function, so its base URL is
-- deployment config read from vault (`app_public_url`). When it is not set the
-- drainer warns and does nothing rather than posting to a guessed host.
-- ---------------------------------------------------------------------------

-- Cron-safe enqueue. The cron job runs as the database owner, which is not
-- `service_role`, so it cannot call the service-role API above. This wrapper
-- performs the same guarded insert (not EXISTS => no stacked jobs) and is
-- revoked from every browser role.
CREATE OR REPLACE FUNCTION public.cron_enqueue_google_reconciliation(
  p_sync_type text,
  p_priority text DEFAULT 'LOW'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_count integer := 0;
  v_office record;
BEGIN
  IF p_sync_type NOT IN ('PROFILE','REVIEWS','MEDIA','POSTS','PERFORMANCE','HEALTH','FULL') THEN
    RAISE EXCEPTION 'Invalid sync_type';
  END IF;
  IF p_priority NOT IN ('CRITICAL','HIGH','NORMAL','LOW') THEN
    RAISE EXCEPTION 'Invalid priority';
  END IF;

  FOR v_office IN
    SELECT ogp.office_id
    FROM public.office_google_profiles ogp
    JOIN public.offices o ON o.id = ogp.office_id AND o.deleted_at IS NULL
    WHERE ogp.mapping_status = 'MAPPED'
      AND ogp.google_location_id IS NOT NULL
      AND ogp.connection_status = 'connected'
  LOOP
    INSERT INTO public.google_business_sync_jobs (office_id, sync_type, priority)
    SELECT v_office.office_id, p_sync_type, p_priority
    WHERE NOT EXISTS (
      SELECT 1 FROM public.google_business_sync_jobs j
      WHERE j.office_id = v_office.office_id
        AND j.sync_type = p_sync_type
        AND j.status IN ('PENDING','RUNNING')
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION public.cron_enqueue_google_reconciliation(text, text)
  FROM PUBLIC, anon, authenticated;

-- The service-role API delegates to the cron-safe body after its own check.
CREATE OR REPLACE FUNCTION public.enqueue_google_reconciliation_jobs(
  p_sync_type text,
  p_priority text DEFAULT 'LOW'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN public.cron_enqueue_google_reconciliation(p_sync_type, p_priority);
END;
$fn$;

REVOKE ALL ON FUNCTION public.enqueue_google_reconciliation_jobs(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_google_reconciliation_jobs(text, text)
  TO service_role;

-- Drains queued jobs through the server worker. SECURITY DEFINER so cron can
-- read the vault secret; the secret is never returned to a browser.
CREATE OR REPLACE FUNCTION public.dispatch_google_business_worker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_secret text;
  v_base text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_dispatch_secret';

  IF v_secret IS NULL OR btrim(v_secret) = '' THEN
    RAISE WARNING 'dispatch_google_business_worker: vault secret cron_dispatch_secret is missing — Google sync jobs will not drain';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_base
  FROM vault.decrypted_secrets WHERE name = 'app_public_url';

  IF v_base IS NULL OR btrim(v_base) = '' THEN
    RAISE WARNING 'dispatch_google_business_worker: vault secret app_public_url is missing — Google sync jobs will not drain';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_base, '/') || '/api/cron/google-business-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.dispatch_google_business_worker()
  FROM PUBLIC, anon, authenticated;

-- Arm the schedules. Guarded so replaying the migration never stacks jobs, and
-- wrapped so a project without pg_cron still applies the rest of Phase 9.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'google-business-worker-drain') THEN
    PERFORM cron.schedule(
      'google-business-worker-drain',
      '* * * * *',
      'SELECT public.dispatch_google_business_worker()'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'google-reconcile-reviews') THEN
    PERFORM cron.schedule(
      'google-reconcile-reviews',
      '*/20 * * * *',
      $cron$SELECT public.cron_enqueue_google_reconciliation('REVIEWS','LOW')$cron$
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'google-reconcile-profile') THEN
    PERFORM cron.schedule(
      'google-reconcile-profile',
      '7 */3 * * *',
      $cron$SELECT public.cron_enqueue_google_reconciliation('PROFILE','NORMAL')$cron$
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'google-reconcile-media') THEN
    PERFORM cron.schedule(
      'google-reconcile-media',
      '17 */3 * * *',
      $cron$SELECT public.cron_enqueue_google_reconciliation('MEDIA','NORMAL')$cron$
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'google-reconcile-posts') THEN
    PERFORM cron.schedule(
      'google-reconcile-posts',
      '27 */4 * * *',
      $cron$SELECT public.cron_enqueue_google_reconciliation('POSTS','NORMAL')$cron$
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'google-reconcile-performance') THEN
    PERFORM cron.schedule(
      'google-reconcile-performance',
      '37 4 * * *',
      $cron$SELECT public.cron_enqueue_google_reconciliation('PERFORMANCE','LOW')$cron$
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'google-reconcile-health') THEN
    PERFORM cron.schedule(
      'google-reconcile-health',
      '47 */6 * * *',
      $cron$SELECT public.cron_enqueue_google_reconciliation('HEALTH','NORMAL')$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Phase 9 cron scheduling skipped: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- 26. Realtime publication
--
-- The office Reviews screen subscribes to `google_business_reviews` so a
-- NEW_REVIEW event surfaces without a manual refresh. Health and job tables are
-- added too, so the Admin operations page re-reads on a real state change.
-- RLS still governs every delivered row.
-- ---------------------------------------------------------------------------
DO $pub$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'google_business_reviews'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.google_business_reviews;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'google_business_location_health'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.google_business_location_health;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'google_business_sync_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.google_business_sync_jobs;
  END IF;
END $pub$;
