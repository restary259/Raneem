-- ============================================================================
-- Google kill switch: singleton + fail closed (audit P1)
--
-- `google_business_settings` models the global switch as the row whose
-- `google_connection_id IS NULL`, with `UNIQUE (google_connection_id)` as the
-- guard. In PostgreSQL a plain UNIQUE constraint treats NULLs as distinct, so
-- it does *not* stop a second global row. And `get_google_business_settings`
-- COALESCEd a missing row to `true`, so an absent/corrupted global config made
-- the emergency switch fail open (Google operations stayed enabled).
--
-- This migration:
--   1. Collapses any duplicate global rows to one (keeping the most recently
--      updated, most restrictive switch state) and adds a partial unique index
--      that actually enforces a single global row.
--   2. Makes the resolver fail closed: no authoritative global row means Google
--      reads/writes/config/events are denied, while cached DARB reads (VIEW)
--      stay available.
--
-- Timestamp is newer than every function it redefines.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enforce a single global row.
-- ---------------------------------------------------------------------------

-- Fold duplicates onto the surviving row. A disabled switch anywhere must not
-- be lost (fail closed), so aggregate with AND.
WITH ranked AS (
  SELECT id,
         row_number() OVER (ORDER BY updated_at DESC NULLS LAST, created_at DESC) AS rn,
         bool_and(global_enabled)  OVER () AS all_global,
         bool_and(read_enabled)    OVER () AS all_read,
         bool_and(write_enabled)   OVER () AS all_write
  FROM public.google_business_settings
  WHERE google_connection_id IS NULL
)
UPDATE public.google_business_settings s
SET global_enabled = ranked.all_global,
    read_enabled   = ranked.all_read,
    write_enabled  = ranked.all_write,
    updated_at     = now()
FROM ranked
WHERE s.id = ranked.id
  AND ranked.rn = 1;

DELETE FROM public.google_business_settings
WHERE google_connection_id IS NULL
  AND id NOT IN (
    SELECT id FROM public.google_business_settings
    WHERE google_connection_id IS NULL
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_google_settings_global
  ON public.google_business_settings ((1))
  WHERE google_connection_id IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Fail closed when the global row is absent.
-- ---------------------------------------------------------------------------

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
  v_g boolean;
  v_r boolean;
  v_w boolean;
  v_found boolean := false;
  v_os record;
BEGIN
  -- Missing global config must deny (fail closed), never grant.
  SELECT s.global_enabled, s.read_enabled, s.write_enabled
  INTO v_g, v_r, v_w
  FROM public.google_business_settings s
  WHERE s.google_connection_id IS NULL;

  IF NOT FOUND THEN
    v_g := false;
    v_r := false;
    v_w := false;
  END IF;

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

  IF NOT COALESCE(v.global_enabled, false) THEN
    RETURN false;
  END IF;

  CASE p_kind
    WHEN 'READ' THEN RETURN COALESCE(v.read_enabled, false);
    WHEN 'WRITE' THEN RETURN COALESCE(v.write_enabled, false);
    WHEN 'CONFIG' THEN RETURN COALESCE(v.global_enabled, false);
    WHEN 'EVENT' THEN RETURN true;
    ELSE RETURN false;
  END CASE;
END;
$fn$;

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
    COALESCE(v.global_enabled, false),
    COALESCE(v.read_enabled, false),
    COALESCE(v.write_enabled, false),
    v.updated_at,
    v.reason,
    (SELECT count(*)::integer FROM public.office_google_settings os WHERE os.enabled = false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_google_business_settings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_google_business_settings(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.google_business_operation_allowed(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.google_business_operation_allowed(uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_get_google_business_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_google_business_settings() TO authenticated, service_role;
