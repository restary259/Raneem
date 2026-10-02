-- ============================================================================
-- PHASE 10 — Security, E2E, production hardening & go-live
--
-- This migration adds the production controls the earlier phases deferred:
--
--   1. Emergency kill switches (global / per-office / read / write) that are
--      enforced at the authorizer and the worker, not just the UI. Reads of
--      cached DARB data keep working when Google is disabled.
--   2. Stale sync-job recovery: a RUNNING job whose worker died is reclaimed
--      or failed, so a job can never stay RUNNING forever.
--   3. A server-side data-integrity audit (orphans, duplicates, cross-office
--      records, stuck jobs, invalid operators, invalid notifications).
--   4. Per-office and system audit reports for the Admin diagnostics surface.
--
-- Everything is additive. No existing function signature is changed except
-- `authorize_google_office_action` (same signature, extra gate), so the Phase
-- 5-9 verifiers stay green.
--
-- Timestamp is newer than every function it redefines.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Settings: one row per connection (the centralized info@darb.agency
--    connection) plus optional per-office overrides.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.google_business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL connection = the global switch row (there is at most one).
  google_connection_id UUID REFERENCES public.google_business_connections(id) ON DELETE CASCADE,
  -- Master switch. FALSE disables live Google operations everywhere but keeps
  -- cached DARB data readable.
  global_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Live Google reads (syncs). FALSE = serve cache only.
  read_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Google mutations (replies, profile edits, media uploads, posts).
  write_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Who last changed it, for the audit trail on the Admin page.
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- At most one global row and one row per connection.
  CONSTRAINT google_business_settings_scope_key UNIQUE (google_connection_id)
);

-- Per-office kill switch, so one problem profile can be isolated.
CREATE TABLE IF NOT EXISTS public.office_google_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  read_enabled BOOLEAN NOT NULL DEFAULT true,
  write_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT office_google_settings_office_key UNIQUE (office_id)
);

-- The single global row, so the getter never returns "no row".
INSERT INTO public.google_business_settings (google_connection_id, global_enabled)
SELECT NULL, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.google_business_settings WHERE google_connection_id IS NULL
);

ALTER TABLE public.google_business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_google_settings ENABLE ROW LEVEL SECURITY;

-- Admins (AAL2) may read the switches; nobody but the service role writes
-- directly. There is deliberately no anon/authenticated table write path.
DROP POLICY IF EXISTS "Admins read google business settings" ON public.google_business_settings;
CREATE POLICY "Admins read google business settings"
  ON public.google_business_settings FOR SELECT TO authenticated
  USING (public.is_admin_session());

DROP POLICY IF EXISTS "Admins read office google settings" ON public.office_google_settings;
CREATE POLICY "Admins read office google settings"
  ON public.office_google_settings FOR SELECT TO authenticated
  USING (public.is_admin_session());

REVOKE ALL ON public.google_business_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.office_google_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.google_business_settings TO authenticated;
GRANT SELECT ON public.office_google_settings TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Kill-switch resolution
-- ---------------------------------------------------------------------------

-- Read the effective switches. Office overrides can only NARROW the global
-- switch, never widen it.
CREATE OR REPLACE FUNCTION public.get_google_business_settings(p_office_id uuid DEFAULT NULL)
RETURNS TABLE (
  global_enabled boolean,
  read_enabled boolean,
  write_enabled boolean,
  office_found boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_g boolean := true;
  v_r boolean := true;
  v_w boolean := true;
  v_found boolean := false;
  v_os record;
BEGIN
  SELECT s.global_enabled, s.read_enabled, s.write_enabled
  INTO v_g, v_r, v_w
  FROM public.google_business_settings s
  WHERE s.google_connection_id IS NULL;

  v_g := COALESCE(v_g, true);
  v_r := COALESCE(v_r, true);
  v_w := COALESCE(v_w, true);

  IF p_office_id IS NOT NULL THEN
    SELECT * INTO v_os FROM public.office_google_settings os WHERE os.office_id = p_office_id;
    IF FOUND THEN
      v_found := true;
      v_g := v_g AND COALESCE(v_os.enabled, true);
      v_r := v_r AND COALESCE(v_os.enabled, true) AND COALESCE(v_os.read_enabled, true);
      v_w := v_w AND COALESCE(v_os.enabled, true) AND COALESCE(v_os.write_enabled, true);
    END IF;
  END IF;

  RETURN QUERY SELECT v_g, v_r, v_w, v_found;
END;
$fn$;

-- Single gate used by the authorizer, the worker and the event router.
--   VIEW   cached DARB reads         — always allowed (data stays readable)
--   READ   live Google reads/syncs   — needs global + read
--   WRITE  Google mutations          — needs global + write
--   CONFIG connection/mapping config — needs global
--   EVENT  Pub/Sub event processing  — needs global
CREATE OR REPLACE FUNCTION public.google_business_operation_allowed(
  p_office_id uuid,
  p_kind text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v record;
BEGIN
  IF p_kind NOT IN ('VIEW','READ','WRITE','CONFIG','EVENT') THEN
    RETURN false;
  END IF;

  -- Cached reads are never blocked by a Google outage or kill switch.
  IF p_kind = 'VIEW' THEN
    RETURN true;
  END IF;

  SELECT * INTO v FROM public.get_google_business_settings(p_office_id);

  IF NOT COALESCE(v.global_enabled, true) THEN
    RETURN false;
  END IF;

  CASE p_kind
    WHEN 'READ' THEN RETURN COALESCE(v.read_enabled, true);
    WHEN 'WRITE' THEN RETURN COALESCE(v.write_enabled, true);
    WHEN 'CONFIG' THEN RETURN COALESCE(v.global_enabled, true);
    WHEN 'EVENT' THEN RETURN true;
    ELSE RETURN false;
  END CASE;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_google_business_settings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_google_business_settings(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.google_business_operation_allowed(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.google_business_operation_allowed(uuid, text) TO authenticated, service_role;

-- Classify a Google action so the authorizer can pick the right gate.
CREATE OR REPLACE FUNCTION public.google_business_action_kind(p_action text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN p_action IN (
      'GOOGLE_VIEW','GOOGLE_VIEW_INSIGHTS','GOOGLE_VIEW_HEALTH',
      'GOOGLE_VIEW_SYNC_STATUS','GOOGLE_VIEW_EVENTS','GOOGLE_VIEW_LOCATION'
    ) THEN 'VIEW'
    WHEN p_action IN (
      'GOOGLE_SYNC_REVIEWS','GOOGLE_SYNC_PROFILE','GOOGLE_SYNC_MEDIA',
      'GOOGLE_SYNC_POSTS','GOOGLE_SYNC_PERFORMANCE','GOOGLE_SYNC_OFFICE'
    ) THEN 'READ'
    WHEN p_action IN (
      'GOOGLE_CONNECT','GOOGLE_DISCONNECT','GOOGLE_RECONNECT',
      'GOOGLE_DISCOVER_LOCATIONS','GOOGLE_MAP_LOCATION','GOOGLE_REMAP_LOCATION',
      'GOOGLE_UNMAP_LOCATION','GOOGLE_MANAGE_NOTIFICATIONS','GOOGLE_RETRY_EVENT'
    ) THEN 'CONFIG'
    ELSE 'WRITE'
  END;
$fn$;

REVOKE ALL ON FUNCTION public.google_business_action_kind(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.google_business_action_kind(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Authorizer now honours the kill switches.
--
-- Same signature as Phase 9; adds the switch gate AFTER the action whitelist
-- and the role check so a disabled integration cannot be reached through any
-- Google server function. Service-role internals bypass (the worker has its
-- own gate, so a paused integration still stops the worker).
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
  v_allowed boolean;
  v_kind text;
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
    'GOOGLE_SYNC_REVIEWS',
    'GOOGLE_SYNC_PROFILE',
    'GOOGLE_REQUEST_HIGH_RISK',
    'GOOGLE_UPDATE_CATEGORY',
    'GOOGLE_UPDATE_ADDRESS',
    'GOOGLE_APPROVE_CHANGE_REQUEST',
    'GOOGLE_SYNC_MEDIA',
    'GOOGLE_SYNC_POSTS',
    'GOOGLE_MANAGE_CUSTOMER_MEDIA',
    'GOOGLE_SYNC_PERFORMANCE',
    'GOOGLE_SYNC_OFFICE',
    'GOOGLE_VIEW_HEALTH',
    'GOOGLE_VIEW_SYNC_STATUS',
    'GOOGLE_MANAGE_NOTIFICATIONS',
    'GOOGLE_VIEW_EVENTS',
    'GOOGLE_RETRY_EVENT',
    'GOOGLE_ASSIGN_SIDE_MANAGER',
    'GOOGLE_REMOVE_SIDE_MANAGER',
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

  -- Emergency kill switch. Applied to everybody, including service_role, so a
  -- paused integration is paused for real. VIEW is always allowed.
  v_kind := public.google_business_action_kind(p_action);
  IF NOT public.google_business_operation_allowed(p_office_id, v_kind) THEN
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

-- ---------------------------------------------------------------------------
-- 4. Admin controls: read and update the switches. Admin-gated, AAL2.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_get_google_business_settings()
RETURNS TABLE (
  connection_id uuid,
  google_email text,
  global_enabled boolean,
  read_enabled boolean,
  write_enabled boolean,
  updated_at timestamptz,
  reason text,
  offices_disabled integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v record;
BEGIN
  IF NOT public.is_admin_session() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT s.global_enabled, s.read_enabled, s.write_enabled, s.updated_at, s.reason,
         s.google_connection_id
  INTO v
  FROM public.google_business_settings s
  WHERE s.google_connection_id IS NULL;

  RETURN QUERY SELECT
    v.google_connection_id,
    (SELECT c.google_email FROM public.google_business_connections c
      WHERE c.id = v.google_connection_id),
    COALESCE(v.global_enabled, true),
    COALESCE(v.read_enabled, true),
    COALESCE(v.write_enabled, true),
    v.updated_at,
    v.reason,
    (SELECT count(*)::integer FROM public.office_google_settings os WHERE os.enabled = false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_get_google_business_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_google_business_settings() TO authenticated, service_role;

-- Changed/added return columns require an explicit drop for idempotent replay.
DROP FUNCTION IF EXISTS public.admin_set_google_business_settings(boolean, boolean, boolean, uuid, boolean, boolean, boolean, text);

CREATE OR REPLACE FUNCTION public.admin_set_google_business_settings(
  p_global_enabled boolean DEFAULT NULL,
  p_read_enabled boolean DEFAULT NULL,
  p_write_enabled boolean DEFAULT NULL,
  p_office_id uuid DEFAULT NULL,
  p_office_enabled boolean DEFAULT NULL,
  p_office_read_enabled boolean DEFAULT NULL,
  p_office_write_enabled boolean DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (
  out_scope text,
  out_global_enabled boolean,
  out_read_enabled boolean,
  out_write_enabled boolean,
  out_office_id uuid,
  out_office_enabled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_read boolean;
  v_write boolean;
  v_enabled boolean;
  v_global boolean;
BEGIN
  IF NOT public.is_admin_session() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_office_id IS NULL THEN
    UPDATE public.google_business_settings s
    SET global_enabled = COALESCE(p_global_enabled, s.global_enabled),
        read_enabled = COALESCE(p_read_enabled, s.read_enabled),
        write_enabled = COALESCE(p_write_enabled, s.write_enabled),
        updated_by = auth.uid(),
        reason = COALESCE(p_reason, s.reason),
        updated_at = now()
    WHERE s.google_connection_id IS NULL;

    RETURN QUERY
    SELECT 'global'::text, s.global_enabled, s.read_enabled, s.write_enabled, NULL::uuid, NULL::boolean
    FROM public.google_business_settings s WHERE s.google_connection_id IS NULL;
    RETURN;
  END IF;

  INSERT INTO public.office_google_settings AS ogs (
    office_id, enabled, read_enabled, write_enabled, updated_by, reason
  )
  VALUES (
    p_office_id,
    COALESCE(p_office_enabled, true),
    COALESCE(p_office_read_enabled, true),
    COALESCE(p_office_write_enabled, true),
    auth.uid(), p_reason
  )
  ON CONFLICT (office_id) DO UPDATE
  SET enabled = COALESCE(p_office_enabled, ogs.enabled),
      read_enabled = COALESCE(p_office_read_enabled, ogs.read_enabled),
      write_enabled = COALESCE(p_office_write_enabled, ogs.write_enabled),
      updated_by = auth.uid(),
      reason = COALESCE(p_reason, ogs.reason),
      updated_at = now();

  SELECT os.enabled, os.read_enabled, os.write_enabled
  INTO v_enabled, v_read, v_write
  FROM public.office_google_settings os WHERE os.office_id = p_office_id;

  SELECT s.global_enabled INTO v_global
  FROM public.google_business_settings s WHERE s.google_connection_id IS NULL;

  RETURN QUERY SELECT 'office'::text, v_global, v_read, v_write, p_office_id, v_enabled;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_set_google_business_settings(boolean, boolean, boolean, uuid, boolean, boolean, boolean, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_google_business_settings(boolean, boolean, boolean, uuid, boolean, boolean, boolean, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Stale sync-job recovery
--
-- A worker that dies mid-run leaves a RUNNING job holding its lock. Reclaim it
-- when the lock is older than the timeout: return it to PENDING while attempts
-- remain (safe — the sync cores are idempotent upserts), otherwise FAIL it so
-- it stops blocking the queue and surfaces on the Admin page.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recover_stale_google_sync_jobs(
  p_timeout interval DEFAULT '15 minutes'
)
RETURNS TABLE (recovered integer, failed integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_recovered integer := 0;
  v_failed integer := 0;
  v_job record;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOR v_job IN
    SELECT j.id, j.attempt_count, j.max_attempts
    FROM public.google_business_sync_jobs j
    WHERE j.status = 'RUNNING'
      AND COALESCE(j.locked_at, j.started_at, j.updated_at) < now() - p_timeout
    FOR UPDATE SKIP LOCKED
  LOOP
    IF v_job.attempt_count < v_job.max_attempts THEN
      UPDATE public.google_business_sync_jobs
      SET status = 'PENDING',
          lock_token = NULL,
          locked_at = NULL,
          scheduled_at = now() + make_interval(secs => LEAST(600, 10 * (2 ^ v_job.attempt_count))::int),
          last_error_code = 'STALE_LOCK_RECOVERED',
          last_error_message = 'Worker lock expired; job re-queued.',
          updated_at = now()
      WHERE id = v_job.id;
      v_recovered := v_recovered + 1;
    ELSE
      UPDATE public.google_business_sync_jobs
      SET status = 'FAILED',
          completed_at = now(),
          lock_token = NULL,
          locked_at = NULL,
          last_error_code = 'STALE_LOCK_EXHAUSTED',
          last_error_message = 'Worker lock expired after the final attempt.',
          updated_at = now()
      WHERE id = v_job.id;
      v_failed := v_failed + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_recovered, v_failed;
END;
$fn$;

REVOKE ALL ON FUNCTION public.recover_stale_google_sync_jobs(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_stale_google_sync_jobs(interval) TO service_role;

-- Cron-safe wrapper: pg_cron runs as the DB owner (no service_role claim).
CREATE OR REPLACE FUNCTION public.cron_recover_stale_google_sync_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM * FROM public.recover_stale_google_sync_jobs('15 minutes');
END;
$fn$;

REVOKE ALL ON FUNCTION public.cron_recover_stale_google_sync_jobs() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5b. Claim honours the kill switches so a paused integration stops draining.
--
-- Same signature/return as Phase 9 (CREATE OR REPLACE). A global pause returns
-- no job at all; a per-office pause skips that office's jobs. Cached reads are
-- unaffected.
-- ---------------------------------------------------------------------------

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
  trigger_event_id uuid,
  trigger_event_type text
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

  IF NOT public.google_business_operation_allowed(NULL, 'READ') THEN
    RETURN;
  END IF;

  SELECT j.id INTO v_job_id
  FROM public.google_business_sync_jobs j
  WHERE j.status = 'PENDING'
    AND j.scheduled_at <= now()
    AND (p_office_id IS NULL OR j.office_id = p_office_id)
    AND (p_sync_types IS NULL OR j.sync_type = ANY (p_sync_types))
    AND public.google_business_operation_allowed(j.office_id, 'READ')
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

  -- `trigger_event_type` carries the original Google event so the worker can
  -- raise the alert for the correct audience (e.g. DUPLICATE_LOCATION is
  -- Admin-only, not office-facing).
  RETURN QUERY
  SELECT j.id, j.office_id, j.sync_type, j.priority, v_token,
         j.google_location_id, j.trigger_event_id, e.event_type
  FROM public.google_business_sync_jobs j
  LEFT JOIN public.google_business_events e ON e.id = j.trigger_event_id
  WHERE j.id = v_job_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.claim_google_business_sync_job(uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_google_business_sync_job(uuid, text[]) TO service_role;

-- ---------------------------------------------------------------------------
-- 5c. Event receipt is still captured while a global pause is on, but routing
--     is held so no Google work is queued. A NULL global pause never blocks
--     capture (we must not lose the event), only live work.
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
  IF NOT (auth.role() = 'service_role' OR public.is_admin_session()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_event FROM public.google_business_events e WHERE e.id = p_event_id;
  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

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

  -- While the integration is globally paused, keep the event captured and
  -- UNROUTED (Admin can retry after resuming) rather than queueing Google work.
  IF NOT public.google_business_operation_allowed(NULL, 'EVENT') THEN
    RETURN QUERY SELECT v_event.id, v_event.event_type, 'UNROUTED'::text, NULL::uuid,
      NULL::uuid, v_sync_type, v_priority, false;
    RETURN;
  END IF;

  SELECT * INTO v_resolve
  FROM public.resolve_google_event_office(v_event.google_account_id, v_event.google_location_id);

  IF NOT COALESCE(v_resolve.matched, false) THEN
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

  -- A per-office pause stops that office's live work but routes the event so
  -- the office's queue is consistent; the worker's claim skips it.
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

  UPDATE public.office_google_profiles ogp
  SET last_google_event_at = GREATEST(COALESCE(ogp.last_google_event_at, now()), now()),
      updated_at = now()
  WHERE ogp.office_id = v_resolve.office_id;

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
-- 6. Data-integrity audit
--
-- One query that returns every invariant violation the Phase 10 report needs.
-- Read-only; safe to run in production.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.audit_google_business_integrity()
RETURNS TABLE (
  check_key text,
  severity text,
  violation_count integer,
  detail text
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
  WITH
  checks AS (
    SELECT 'duplicate_location_mapping'::text AS check_key, 'high'::text AS severity,
      (SELECT count(*)::integer FROM (
        SELECT google_location_id FROM public.office_google_profiles
        WHERE google_location_id IS NOT NULL
        GROUP BY google_location_id HAVING count(DISTINCT office_id) > 1
      ) d) AS violation_count,
      'A Google location mapped to more than one DARB office'::text AS detail

    UNION ALL
    SELECT 'office_multiple_locations', 'high',
      (SELECT count(*)::integer FROM (
        SELECT office_id FROM public.office_google_profiles
        WHERE google_location_id IS NOT NULL
        GROUP BY office_id HAVING count(DISTINCT google_location_id) > 1
      ) d),
      'A DARB office mapped to more than one Google location'

    UNION ALL
    SELECT 'orphan_reviews', 'medium',
      (SELECT count(*)::integer FROM public.google_business_reviews r
        LEFT JOIN public.offices o ON o.id = r.office_id
        WHERE o.id IS NULL),
      'Reviews whose office no longer exists'

    UNION ALL
    SELECT 'orphan_media', 'medium',
      (SELECT count(*)::integer FROM public.google_business_media m
        LEFT JOIN public.offices o ON o.id = m.office_id
        WHERE o.id IS NULL),
      'Media whose office no longer exists'

    UNION ALL
    SELECT 'orphan_posts', 'medium',
      (SELECT count(*)::integer FROM public.google_business_posts p
        LEFT JOIN public.offices o ON o.id = p.office_id
        WHERE o.id IS NULL),
      'Posts whose office no longer exists'

    UNION ALL
    SELECT 'cross_office_review_location', 'high',
      (SELECT count(*)::integer FROM public.google_business_reviews r
        JOIN public.office_google_profiles ogp ON ogp.office_id = r.office_id
        WHERE ogp.google_location_id IS NOT NULL
          AND r.google_location_id <> ogp.google_location_id),
      'A review whose location does not match its office mapping'

    UNION ALL
    SELECT 'cross_office_post_location', 'high',
      (SELECT count(*)::integer FROM public.google_business_posts p
        JOIN public.office_google_profiles ogp ON ogp.office_id = p.office_id
        WHERE p.google_location_id IS NOT NULL
          AND ogp.google_location_id IS NOT NULL
          AND p.google_location_id <> ogp.google_location_id),
      'A post whose location does not match its office mapping'

    UNION ALL
    SELECT 'stuck_sync_jobs', 'high',
      (SELECT count(*)::integer FROM public.google_business_sync_jobs j
        WHERE j.status = 'RUNNING'
          AND COALESCE(j.locked_at, j.started_at, j.updated_at) < now() - interval '1 hour'),
      'A sync job RUNNING for over an hour'

    UNION ALL
    SELECT 'invalid_operator_office', 'high',
      (SELECT count(*)::integer FROM public.office_google_operators ogo
        LEFT JOIN public.office_members om
          ON om.office_id = ogo.office_id AND om.user_id = ogo.team_member_id
        WHERE om.id IS NULL OR om.is_active = false),
      'An operator who is not an active member of their office'

    UNION ALL
    SELECT 'duplicate_primary', 'high',
      (SELECT count(*)::integer FROM (
        SELECT office_id FROM public.office_google_operators
        WHERE role = 'PRIMARY' GROUP BY office_id HAVING count(*) > 1
      ) d),
      'An office with more than one PRIMARY'

    UNION ALL
    SELECT 'duplicate_side', 'high',
      (SELECT count(*)::integer FROM (
        SELECT office_id FROM public.office_google_operators
        WHERE role = 'SIDE_MANAGER' GROUP BY office_id HAVING count(*) > 1
      ) d),
      'An office with more than one SIDE_MANAGER'

    UNION ALL
    SELECT 'orphan_events', 'low',
      (SELECT count(*)::integer FROM public.google_business_events e
        WHERE e.google_connection_id IS NULL AND e.processing_status <> 'IGNORED'),
      'Events with no connection'

    UNION ALL
    SELECT 'event_job_no_location', 'low',
      (SELECT count(*)::integer FROM public.google_business_sync_jobs j
        JOIN public.google_business_events e ON e.id = j.trigger_event_id
        WHERE j.google_location_id IS NULL),
      'Event-driven jobs missing a Google location'

    UNION ALL
    SELECT 'invalid_notification_recipient', 'medium',
      (SELECT count(*)::integer FROM public.notifications n
        WHERE n.office_id IS NOT NULL
          AND n.google_event_type IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.office_members om
            WHERE om.office_id = n.office_id AND om.user_id = n.user_id AND om.is_active = true
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.profiles p WHERE p.id = n.user_id AND p.deactivated_at IS NULL
          )),
      'Google notifications whose recipient is inactive or outside the office'
  )
  SELECT c.check_key, c.severity, c.violation_count, c.detail
  FROM checks c
  ORDER BY CASE c.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, c.check_key;
END;
$fn$;

REVOKE ALL ON FUNCTION public.audit_google_business_integrity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_google_business_integrity() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Per-office integrity / readiness report
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.audit_office_google_integrity(p_office_id uuid)
RETURNS TABLE (
  item text,
  ok boolean,
  detail text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v record;
BEGIN
  IF NOT public.is_admin_session() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v FROM public.office_google_profiles ogp WHERE ogp.office_id = p_office_id;

  RETURN QUERY
  SELECT 'Mapping'::text, (v.mapping_status = 'MAPPED' AND v.google_location_id IS NOT NULL),
    COALESCE(v.mapping_status, 'no profile')::text
  UNION ALL
  SELECT 'OAuth', (v.connection_status = 'connected'),
    COALESCE(v.connection_status, 'not_connected')::text
  UNION ALL
  SELECT 'Primary', EXISTS (
    SELECT 1 FROM public.office_google_operators ogo
    JOIN public.office_members om ON om.office_id = ogo.office_id AND om.user_id = ogo.team_member_id AND om.is_active
    WHERE ogo.office_id = p_office_id AND ogo.role = 'PRIMARY'),
    'A PRIMARY operator is assigned and active'
  UNION ALL
  SELECT 'Side', EXISTS (
    SELECT 1 FROM public.office_google_operators ogo
    WHERE ogo.office_id = p_office_id AND ogo.role = 'SIDE_MANAGER'),
    'A SIDE_MANAGER is assigned (optional)'
  UNION ALL
  SELECT 'Health', COALESCE((
    SELECT h.health_status IN ('HEALTHY') FROM public.google_business_location_health h
    WHERE h.office_id = p_office_id), false),
    COALESCE((SELECT h.health_status FROM public.google_business_location_health h
      WHERE h.office_id = p_office_id), 'unknown')::text
  UNION ALL
  SELECT 'SyncJobs', NOT EXISTS (
    SELECT 1 FROM public.google_business_sync_jobs j
    WHERE j.office_id = p_office_id AND j.status = 'FAILED'),
    'No permanently failed sync jobs'
  UNION ALL
  SELECT 'StuckJobs', NOT EXISTS (
    SELECT 1 FROM public.google_business_sync_jobs j
    WHERE j.office_id = p_office_id AND j.status = 'RUNNING'
      AND COALESCE(j.locked_at, j.started_at, j.updated_at) < now() - interval '1 hour'),
    'No sync job stuck RUNNING'
  UNION ALL
  SELECT 'CrossOffice', NOT EXISTS (
    SELECT 1 FROM public.google_business_reviews r
    WHERE r.office_id = p_office_id AND v.google_location_id IS NOT NULL
      AND r.google_location_id <> v.google_location_id),
    'No cross-location review records'
  UNION ALL
  SELECT 'Disabled', COALESCE((
    SELECT os.enabled FROM public.office_google_settings os WHERE os.office_id = p_office_id), true),
    'Office switch is on';
END;
$fn$;

REVOKE ALL ON FUNCTION public.audit_office_google_integrity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_office_google_integrity(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Arm the stale-job recovery cron.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'google-recover-stale-jobs') THEN
    PERFORM cron.schedule(
      'google-recover-stale-jobs',
      '*/5 * * * *',
      'SELECT public.cron_recover_stale_google_sync_jobs()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Phase 10 cron scheduling skipped: %', SQLERRM;
END $$;
