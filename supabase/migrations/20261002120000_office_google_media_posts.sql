-- ===========================================================================
-- PHASE 7 — Google Business Photos + Google Posts
--
-- Phase 6 let an operator edit the profile. Phase 7 adds the visual/content
-- layer of the location: business media (photos) and Local Posts.
--
-- Design decisions worth calling out:
--
--   * Two separate caches, `google_business_media` and `google_business_posts`,
--     each keyed by (google_location_id, google_<resource>_id) so a re-sync can
--     never duplicate a row.
--
--   * Business media and customer-contributed media share ONE table but are
--     separated by `media_origin` ('BUSINESS' | 'CUSTOMER'). Customer media is
--     VIEW ONLY: no RPC will ever delete or edit a CUSTOMER row, and the UI is
--     told which rows are read-only. This is the "customer media must be
--     separate" requirement without a second, drift-prone table.
--
--   * DARB's friendly category and Google's category are distinct columns
--     (`darb_category` vs `media_category`). "Team" is a DARB label; Google
--     only ever sees COVER/ADDITIONAL/LOGO/EXTERIOR/INTERIOR/FOOD_AND_DRINK/
--     MENU/TEAM/OTHER (or ADDITIONAL for the unsupported ones).
--
--   * Google is the source of truth. Sync upserts and marks rows Google no
--     longer returns (NOT_FOUND / DELETED_EXTERNALLY) instead of deleting them,
--     so DARB keeps its audit trail.
--
--   * Every write is persisted only AFTER Google confirmed it. A failed publish
--     leaves the local draft intact (status FAILED), never a false PUBLISHED.
--
--   * Irreversible actions (delete post, delete media, publish) are guarded at
--     the RPC: publish locking + idempotency receipts live in the database, so
--     a double tap or a retried request cannot double-publish or double-delete.
--
-- Timestamp is newer than 20261001200000 (Phase 6) so this authorizer wins.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Authorizer — add Phase 7 actions
--
-- Redefines `google_actor_can` and `authorize_google_office_action` (Phase 6
-- bodies) with three new actions. The generic GOOGLE_MANAGE_MEDIA and
-- GOOGLE_MANAGE_POSTS (already operator-held since Phase 1) gate the media and
-- post write paths; the new actions gate sync and the admin-only customer-media
-- moderation surface.
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 2. Media cache
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.google_business_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  google_connection_id UUID,
  google_account_id TEXT,
  google_location_id TEXT NOT NULL,
  google_media_id TEXT NOT NULL,
  google_media_resource_name TEXT NOT NULL,
  -- Google's raw media format (PHOTO / VIDEO).
  media_format TEXT,
  -- Google's category. NULL when Google does not expose one for the item.
  media_category TEXT,
  -- DARB's friendly label (cover/logo/exterior/interior/team/other). Never sent
  -- to Google verbatim; mapped to media_category at publish time.
  darb_category TEXT,
  -- BUSINESS = DARB/business uploaded; CUSTOMER = contributed by a customer.
  -- Customer media is VIEW ONLY.
  media_origin TEXT NOT NULL DEFAULT 'BUSINESS'
    CHECK (media_origin IN ('BUSINESS','CUSTOMER')),
  google_source_url TEXT,
  google_thumbnail_url TEXT,
  google_full_url TEXT,
  description TEXT,
  width INTEGER,
  height INTEGER,
  attribution TEXT,
  -- Google's processing/lifecycle state, plus DARB's own terminal states.
  media_state TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (media_state IN ('SUBMITTED','PROCESSING','PUBLISHED','FAILED','REJECTED','NOT_FOUND','DELETED')),
  -- The private staging object the bytes came from (business uploads only).
  storage_path TEXT,
  -- Client-supplied id used to dedupe a double-submitted upload.
  upload_operation_id TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  CONSTRAINT google_business_media_location_media_key
    UNIQUE (google_location_id, google_media_id)
);

CREATE INDEX IF NOT EXISTS idx_google_media_office_created
  ON public.google_business_media (office_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_media_office_category
  ON public.google_business_media (office_id, darb_category);
CREATE INDEX IF NOT EXISTS idx_google_media_office_origin
  ON public.google_business_media (office_id, media_origin);
CREATE INDEX IF NOT EXISTS idx_google_media_office_state
  ON public.google_business_media (office_id, media_state);
CREATE INDEX IF NOT EXISTS idx_google_media_location
  ON public.google_business_media (google_location_id);
CREATE INDEX IF NOT EXISTS idx_google_media_operation
  ON public.google_business_media (office_id, upload_operation_id);

-- A media row may only exist under the office that maps its Google location.
-- The data-layer half of media ownership: a forged office_id is rejected even
-- if a future caller bypasses the RPC.
CREATE OR REPLACE FUNCTION public.validate_google_media()
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
    RAISE EXCEPTION 'Media location does not belong to this office mapping'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.validate_google_media() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_google_media() TO service_role;

DROP TRIGGER IF EXISTS trg_validate_google_media ON public.google_business_media;
CREATE TRIGGER trg_validate_google_media
BEFORE INSERT OR UPDATE OF office_id, google_location_id
ON public.google_business_media
FOR EACH ROW EXECUTE FUNCTION public.validate_google_media();

-- Upload dedupe receipts. A double tap replays the same operation id and the
-- RPC returns the first result instead of uploading a second copy to Google.
CREATE TABLE IF NOT EXISTS public.google_media_upload_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  state TEXT NOT NULL DEFAULT 'IN_PROGRESS'
    CHECK (state IN ('IN_PROGRESS','PUBLISHED','FAILED')),
  media_id UUID REFERENCES public.google_business_media(id) ON DELETE SET NULL,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT google_media_upload_receipts_key UNIQUE (office_id, operation_id)
);

-- ---------------------------------------------------------------------------
-- 3. Media/posts freshness on the office mapping
-- ---------------------------------------------------------------------------

ALTER TABLE public.office_google_profiles
  ADD COLUMN IF NOT EXISTS media_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS media_last_successful_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS media_sync_error_code TEXT,
  ADD COLUMN IF NOT EXISTS media_sync_error_message TEXT,
  ADD COLUMN IF NOT EXISTS media_sync_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posts_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posts_last_successful_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posts_sync_error_code TEXT,
  ADD COLUMN IF NOT EXISTS posts_sync_error_message TEXT,
  ADD COLUMN IF NOT EXISTS posts_sync_locked_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 4. Posts cache
--
-- One unified table for drafts and published posts (status = DRAFT / PUBLISHED
-- / ...), so the history stays connected and a failed publish keeps its draft.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.google_business_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  google_connection_id UUID,
  google_account_id TEXT,
  google_location_id TEXT,
  google_post_id TEXT,
  google_post_resource_name TEXT,
  -- Google Local Post topic type: STANDARD / EVENT / OFFER / (CTA uses STANDARD
  -- + callToAction). Product posts are deliberately NOT offered.
  topic_type TEXT NOT NULL DEFAULT 'STANDARD'
    CHECK (topic_type IN ('STANDARD','EVENT','OFFER')),
  language_code TEXT NOT NULL DEFAULT 'en',
  summary TEXT,
  -- Call-to-action
  cta_type TEXT CHECK (cta_type IN ('LEARN_MORE','SIGN_UP','BOOK','CALL','ORDER','SHOP')),
  cta_url TEXT,
  -- Event
  event_title TEXT,
  event_start TIMESTAMPTZ,
  event_end TIMESTAMPTZ,
  -- Offer
  offer_coupon_code TEXT,
  offer_url TEXT,
  offer_terms TEXT,
  -- Post media: DARB media ids (validated same-office) whose approved public
  -- URL is handed to Google. Google requires a URL for Local Post media.
  media_ids UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
  -- The exact URLs supplied to Google, kept so a post can be re-published and
  -- audited without re-deriving them.
  media_urls TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  google_state TEXT,
  search_url TEXT,
  -- DARB lifecycle. Google's own enum is never merged in.
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','PUBLISHING','PUBLISHED','UPDATE_PENDING','DELETE_PENDING','DELETED','DELETED_EXTERNALLY','FAILED')),
  last_error_code TEXT,
  last_error_message TEXT,
  published_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  -- Optimistic concurrency: a stale editor cannot silently overwrite.
  version INTEGER NOT NULL DEFAULT 1,
  google_update_time TIMESTAMPTZ,
  last_synced_hash TEXT,
  -- Publish/delete locking + idempotency so a double tap cannot double-publish.
  publish_locked_at TIMESTAMPTZ,
  delete_locked_at TIMESTAMPTZ,
  publish_operation_id TEXT,
  delete_operation_id TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_google_posts_office_created
  ON public.google_business_posts (office_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_posts_office_status
  ON public.google_business_posts (office_id, status);
CREATE INDEX IF NOT EXISTS idx_google_posts_office_published
  ON public.google_business_posts (office_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_posts_location
  ON public.google_business_posts (google_location_id);
CREATE INDEX IF NOT EXISTS idx_google_posts_publish_op
  ON public.google_business_posts (office_id, publish_operation_id);
CREATE INDEX IF NOT EXISTS idx_google_posts_delete_op
  ON public.google_business_posts (office_id, delete_operation_id);
-- One DARB post per Google post, so a sync cannot duplicate a published post.
CREATE UNIQUE INDEX IF NOT EXISTS google_business_posts_google_post_key
  ON public.google_business_posts (google_location_id, google_post_id)
  WHERE google_post_id IS NOT NULL;

-- A post may only exist under the office that maps its Google location. A DRAFT
-- may exist before a location is mapped (google_location_id NULL) — the RPC
-- still refuses to publish it until the mapping exists.
CREATE OR REPLACE FUNCTION public.validate_google_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.google_location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.office_google_profiles ogp
    WHERE ogp.office_id = NEW.office_id
      AND ogp.google_location_id = NEW.google_location_id
  ) THEN
    RAISE EXCEPTION 'Post location does not belong to this office mapping'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.validate_google_post() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_google_post() TO service_role;

DROP TRIGGER IF EXISTS trg_validate_google_post ON public.google_business_posts;
CREATE TRIGGER trg_validate_google_post
BEFORE INSERT OR UPDATE OF office_id, google_location_id
ON public.google_business_posts
FOR EACH ROW EXECUTE FUNCTION public.validate_google_post();

-- Publish/delete idempotency receipts. The unique key is per office + operation
-- id, so a retried request returns the first result instead of publishing twice.
CREATE TABLE IF NOT EXISTS public.google_post_operation_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.google_business_posts(id) ON DELETE SET NULL,
  operation TEXT NOT NULL CHECK (operation IN ('PUBLISH','DELETE','UPDATE')),
  operation_id TEXT NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_hash TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT google_post_operation_receipts_key
    UNIQUE (office_id, operation, operation_id)
);

-- ---------------------------------------------------------------------------
-- 5. Canonical post content hash
--
-- jsonb text output is canonical, so md5 of it is a stable fingerprint of the
-- editable post content. Used to tell an external Google edit from a DARB edit.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.google_post_hash(p_content jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT md5(COALESCE(p_content, '{}'::jsonb)::text);
$fn$;

REVOKE ALL ON FUNCTION public.google_post_hash(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.google_post_hash(jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Sync locks — media and posts each get an advisory, self-expiring lock
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.acquire_google_media_sync_lock(
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
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_SYNC_MEDIA')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.office_google_profiles
  SET media_sync_locked_at = now(), updated_at = now()
  WHERE office_id = p_office_id
    AND (
      media_sync_locked_at IS NULL
      OR media_sync_locked_at < now() - make_interval(secs => GREATEST(p_stale_after_seconds, 30))
    )
  RETURNING true INTO v_acquired;

  RETURN COALESCE(v_acquired, false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.acquire_google_media_sync_lock(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acquire_google_media_sync_lock(uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.release_google_media_sync_lock(p_office_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_SYNC_MEDIA')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.office_google_profiles
  SET media_sync_locked_at = NULL, updated_at = now()
  WHERE office_id = p_office_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.release_google_media_sync_lock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_google_media_sync_lock(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.acquire_google_posts_sync_lock(
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
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_SYNC_POSTS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.office_google_profiles
  SET posts_sync_locked_at = now(), updated_at = now()
  WHERE office_id = p_office_id
    AND (
      posts_sync_locked_at IS NULL
      OR posts_sync_locked_at < now() - make_interval(secs => GREATEST(p_stale_after_seconds, 30))
    )
  RETURNING true INTO v_acquired;

  RETURN COALESCE(v_acquired, false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.acquire_google_posts_sync_lock(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acquire_google_posts_sync_lock(uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.release_google_posts_sync_lock(p_office_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_SYNC_POSTS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.office_google_profiles
  SET posts_sync_locked_at = NULL, updated_at = now()
  WHERE office_id = p_office_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.release_google_posts_sync_lock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_google_posts_sync_lock(uuid) TO authenticated, service_role;


-- DARB friendly category is a closed set; Google's own category is free text.
ALTER TABLE public.google_business_media
  DROP CONSTRAINT IF EXISTS google_business_media_darb_category_check;
ALTER TABLE public.google_business_media
  ADD CONSTRAINT google_business_media_darb_category_check
  CHECK (darb_category IS NULL OR darb_category IN
    ('cover','logo','exterior','interior','team','other'));

-- ---------------------------------------------------------------------------
-- 7. Read RPCs — media list + summary (server-filtered, server-paginated)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_office_google_media(
  p_office_id uuid,
  p_category text DEFAULT NULL,
  p_origin text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 60,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  office_id uuid,
  google_media_id text,
  google_location_id text,
  media_format text,
  media_category text,
  darb_category text,
  media_origin text,
  google_source_url text,
  google_thumbnail_url text,
  google_full_url text,
  description text,
  width integer,
  height integer,
  attribution text,
  media_state text,
  created_at timestamptz,
  last_synced_at timestamptz,
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
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_VIEW')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT m.*
    FROM public.google_business_media m
    WHERE m.office_id = p_office_id
      AND m.media_state <> 'DELETED'
      AND (p_category IS NULL OR p_category = 'all' OR m.darb_category = p_category)
      AND (p_origin IS NULL OR p_origin = 'all' OR m.media_origin = p_origin)
      AND (
        v_search IS NULL
        OR m.description ILIKE '%' || v_search || '%'
        OR m.attribution ILIKE '%' || v_search || '%'
      )
  ),
  counted AS (SELECT count(*) AS total FROM filtered)
  SELECT
    f.id, f.office_id, f.google_media_id, f.google_location_id,
    f.media_format, f.media_category, f.darb_category, f.media_origin,
    f.google_source_url, f.google_thumbnail_url, f.google_full_url,
    f.description, f.width, f.height, f.attribution, f.media_state,
    f.created_at, f.last_synced_at, c.total
  FROM filtered f CROSS JOIN counted c
  ORDER BY f.created_at DESC, f.id
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 60), 200), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$fn$;

REVOKE ALL ON FUNCTION public.list_office_google_media(uuid, text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_office_google_media(uuid, text, text, text, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_office_google_media_summary(p_office_id uuid)
RETURNS TABLE (
  office_id uuid,
  business_count bigint,
  customer_count bigint,
  cover_count bigint,
  logo_count bigint,
  exterior_count bigint,
  interior_count bigint,
  team_count bigint,
  other_count bigint,
  media_last_synced_at timestamptz,
  media_last_successful_sync_at timestamptz,
  media_sync_error_code text,
  media_sync_error_message text,
  mapping_status text,
  connection_status text,
  google_location_name text,
  google_maps_url text
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
    COALESCE(agg.business_count, 0),
    COALESCE(agg.customer_count, 0),
    COALESCE(agg.cover_count, 0),
    COALESCE(agg.logo_count, 0),
    COALESCE(agg.exterior_count, 0),
    COALESCE(agg.interior_count, 0),
    COALESCE(agg.team_count, 0),
    COALESCE(agg.other_count, 0),
    ogp.media_last_synced_at,
    ogp.media_last_successful_sync_at,
    ogp.media_sync_error_code,
    ogp.media_sync_error_message,
    ogp.mapping_status,
    ogp.connection_status,
    ogp.google_location_name,
    ogp.google_maps_url
  FROM public.office_google_profiles ogp
  LEFT JOIN (
    SELECT
      m.office_id,
      count(*) FILTER (WHERE m.media_origin = 'BUSINESS') AS business_count,
      count(*) FILTER (WHERE m.media_origin = 'CUSTOMER') AS customer_count,
      count(*) FILTER (WHERE m.darb_category = 'cover') AS cover_count,
      count(*) FILTER (WHERE m.darb_category = 'logo') AS logo_count,
      count(*) FILTER (WHERE m.darb_category = 'exterior') AS exterior_count,
      count(*) FILTER (WHERE m.darb_category = 'interior') AS interior_count,
      count(*) FILTER (WHERE m.darb_category = 'team') AS team_count,
      count(*) FILTER (WHERE m.darb_category = 'other') AS other_count
    FROM public.google_business_media m
    WHERE m.media_state <> 'DELETED'
    GROUP BY m.office_id
  ) agg ON agg.office_id = ogp.office_id
  WHERE ogp.office_id = p_office_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_office_google_media_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_office_google_media_summary(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Media ownership resolver — a DARB media id must belong to the office
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_google_media_office(
  p_office_id uuid,
  p_media_id uuid
)
RETURNS TABLE (
  media_id uuid,
  office_id uuid,
  google_account_id text,
  google_location_id text,
  google_media_id text,
  google_media_resource_name text,
  media_origin text,
  media_state text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_office_id uuid;
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_VIEW')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT m.office_id INTO v_office_id
  FROM public.google_business_media m WHERE m.id = p_media_id;

  IF v_office_id IS NULL THEN
    RETURN;
  END IF;

  IF v_office_id <> p_office_id THEN
    RAISE EXCEPTION 'Media does not belong to this office'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT m.id, m.office_id, m.google_account_id, m.google_location_id,
         m.google_media_id, m.google_media_resource_name,
         m.media_origin, m.media_state
  FROM public.google_business_media m
  WHERE m.id = p_media_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.resolve_google_media_office(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_google_media_office(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9. Media upload — dedupe receipts
--
-- The server calls begin_google_media_upload BEFORE talking to Google. A double
-- tap or a retried request replays the same operation id and gets back the
-- already-published media instead of uploading a second copy.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.begin_google_media_upload(
  p_office_id uuid,
  p_operation_id text,
  p_request_hash text
)
RETURNS TABLE (status text, media jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_receipt public.google_media_upload_receipts%ROWTYPE;
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_MANAGE_MEDIA')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_operation_id IS NULL OR length(btrim(p_operation_id)) < 8 THEN
    RAISE EXCEPTION 'A valid upload_operation_id is required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_receipt
  FROM public.google_media_upload_receipts r
  WHERE r.office_id = p_office_id AND r.operation_id = p_operation_id;

  IF FOUND THEN
    IF v_receipt.state = 'PUBLISHED' THEN
      RETURN QUERY SELECT 'published'::text, v_receipt.result;
      RETURN;
    END IF;
    -- A very recent in-flight attempt is treated as in progress; an old one
    -- (a crashed upload) is reclaimable.
    IF v_receipt.state = 'IN_PROGRESS'
       AND v_receipt.updated_at > now() - interval '2 minutes' THEN
      RETURN QUERY SELECT 'in_progress'::text, NULL::jsonb;
      RETURN;
    END IF;
    UPDATE public.google_media_upload_receipts
    SET state = 'IN_PROGRESS', actor_user_id = v_actor,
        updated_at = now()
    WHERE id = v_receipt.id;
    RETURN QUERY SELECT 'new'::text, NULL::jsonb;
    RETURN;
  END IF;

  INSERT INTO public.google_media_upload_receipts (
    office_id, operation_id, actor_user_id, state
  ) VALUES (p_office_id, p_operation_id, v_actor, 'IN_PROGRESS');

  RETURN QUERY SELECT 'new'::text, NULL::jsonb;
END;
$fn$;

REVOKE ALL ON FUNCTION public.begin_google_media_upload(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_google_media_upload(uuid, text, text) TO authenticated, service_role;

-- Persist a media row AFTER Google accepted the upload. The office mapping is
-- the authority for the location; a forged google_location_id is ignored.
CREATE OR REPLACE FUNCTION public.record_google_media_upload(
  p_office_id uuid,
  p_operation_id text,
  p_media jsonb,
  -- Trusted server callers pass the authenticated actor explicitly.
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS TABLE (media_id uuid, media_state text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := COALESCE(p_actor_user_id, auth.uid());
  v_location_id text;
  v_account_id text;
  v_media_id uuid;
  v_state text;
  v_row jsonb;
BEGIN
  -- Recording a Google media upload asserts "Google accepted this". That
  -- assertion must come from the connector, so this RPC is service-role only.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT public.google_actor_can(p_office_id, v_actor, 'GOOGLE_MANAGE_MEDIA') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT ogp.google_location_id, ogp.google_account_id
  INTO v_location_id, v_account_id
  FROM public.office_google_profiles ogp
  WHERE ogp.office_id = p_office_id
    AND ogp.mapping_status = 'MAPPED'
    AND ogp.google_location_id IS NOT NULL;

  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'Office has no mapped Google location';
  END IF;

  IF (p_media->>'google_media_id') IS NULL
     OR (p_media->>'google_media_id') = '' THEN
    RAISE EXCEPTION 'google_media_id is required';
  END IF;

  v_state := COALESCE(NULLIF(p_media->>'media_state',''), 'PUBLISHED');

  INSERT INTO public.google_business_media (
    office_id, google_account_id, google_location_id,
    google_media_id, google_media_resource_name,
    media_format, media_category, darb_category, media_origin,
    google_source_url, google_thumbnail_url, google_full_url,
    description, width, height, attribution, media_state,
    storage_path, upload_operation_id, created_by, last_synced_at
  ) VALUES (
    p_office_id, v_account_id, v_location_id,
    p_media->>'google_media_id',
    COALESCE(p_media->>'google_media_resource_name',
             'accounts/' || v_account_id || '/locations/' || v_location_id ||
             '/media/' || (p_media->>'google_media_id')),
    NULLIF(p_media->>'media_format',''),
    NULLIF(p_media->>'media_category',''),
    NULLIF(p_media->>'darb_category',''),
    COALESCE(NULLIF(p_media->>'media_origin',''), 'BUSINESS'),
    NULLIF(p_media->>'google_source_url',''),
    NULLIF(p_media->>'google_thumbnail_url',''),
    NULLIF(p_media->>'google_full_url',''),
    NULLIF(p_media->>'description',''),
    NULLIF(p_media->>'width','')::integer,
    NULLIF(p_media->>'height','')::integer,
    NULLIF(p_media->>'attribution',''),
    v_state,
    NULLIF(p_media->>'storage_path',''),
    p_operation_id, v_actor, now()
  )
  ON CONFLICT (google_location_id, google_media_id) DO UPDATE
    SET media_state = EXCLUDED.media_state,
        media_category = EXCLUDED.media_category,
        darb_category = COALESCE(EXCLUDED.darb_category, public.google_business_media.darb_category),
        google_source_url = COALESCE(EXCLUDED.google_source_url, public.google_business_media.google_source_url),
        google_thumbnail_url = COALESCE(EXCLUDED.google_thumbnail_url, public.google_business_media.google_thumbnail_url),
        google_full_url = COALESCE(EXCLUDED.google_full_url, public.google_business_media.google_full_url),
        width = COALESCE(EXCLUDED.width, public.google_business_media.width),
        height = COALESCE(EXCLUDED.height, public.google_business_media.height),
        updated_at = now(),
        last_synced_at = now()
  RETURNING id INTO v_media_id;

  SELECT jsonb_build_object(
    'id', v_media_id,
    'google_media_id', p_media->>'google_media_id',
    'media_state', v_state,
    'darb_category', p_media->>'darb_category'
  ) INTO v_row;

  UPDATE public.google_media_upload_receipts
  SET state = 'PUBLISHED', media_id = v_media_id, result = v_row,
      updated_at = now()
  WHERE office_id = p_office_id AND operation_id = p_operation_id;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, resource_id, after_data
  ) VALUES (
    p_office_id, v_location_id, v_actor,
    COALESCE(public.google_actor_role(p_office_id, v_actor), 'admin'),
    'GOOGLE_MEDIA_UPLOADED', 'media', v_media_id::text,
    jsonb_build_object(
      'google_media_id', p_media->>'google_media_id',
      'darb_category', p_media->>'darb_category',
      'media_state', v_state
    )
  );

  RETURN QUERY SELECT v_media_id, v_state;
END;
$fn$;

REVOKE ALL ON FUNCTION public.record_google_media_upload(uuid, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_google_media_upload(uuid, text, jsonb, uuid) TO service_role;

-- The upload failed after begin: release the receipt so a retry is allowed.
CREATE OR REPLACE FUNCTION public.fail_google_media_upload(
  p_office_id uuid,
  p_operation_id text,
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
    OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_MANAGE_MEDIA')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.google_media_upload_receipts
  SET state = 'FAILED',
      result = jsonb_build_object(
        'code', left(COALESCE(p_error_code,'error'), 64),
        'message', left(COALESCE(p_error_message,'Upload failed'), 500)),
      updated_at = now()
  WHERE office_id = p_office_id AND operation_id = p_operation_id;

  INSERT INTO public.google_business_activity (
    office_id, actor_user_id, actor_role, action, resource_type, after_data
  ) VALUES (
    p_office_id, v_actor,
    COALESCE(public.google_actor_role(p_office_id, v_actor), 'admin'),
    'GOOGLE_MEDIA_UPLOAD_FAILED', 'media',
    jsonb_build_object(
      'operation_id', p_operation_id,
      'code', left(COALESCE(p_error_code,'error'), 64),
      'message', left(COALESCE(p_error_message,'Upload failed'), 500))
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.fail_google_media_upload(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fail_google_media_upload(uuid, text, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 12. Post field validation (mirrors the client; the server is authoritative)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.google_post_field_error(p_post jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
  v_topic text := COALESCE(p_post->>'topic_type', 'STANDARD');
  v_lang text := COALESCE(p_post->>'language_code', 'en');
  v_cta text := NULLIF(p_post->>'cta_type', '');
  v_cta_url text := NULLIF(p_post->>'cta_url', '');
  v_summary text := COALESCE(p_post->>'summary', '');
  v_start timestamptz;
  v_end timestamptz;
  v_offer_url text := NULLIF(p_post->>'offer_url', '');
BEGIN
  IF v_topic NOT IN ('STANDARD','EVENT','OFFER') THEN
    RETURN 'invalid_topic_type';
  END IF;

  IF v_lang !~ '^[a-z]{2}(-[A-Za-z]{2,})?$' THEN
    RETURN 'invalid_language';
  END IF;

  IF length(v_summary) > 1500 THEN
    RETURN 'summary_too_long';
  END IF;

  IF v_cta IS NOT NULL AND v_cta NOT IN
     ('LEARN_MORE','SIGN_UP','BOOK','CALL','ORDER','SHOP') THEN
    RETURN 'invalid_cta_type';
  END IF;

  -- A URL-bearing CTA must carry a real HTTPS URL; CALL uses the location's
  -- phone instead, so it must NOT carry one.
  IF v_cta IS NOT NULL AND v_cta <> 'CALL' THEN
    IF v_cta_url IS NULL OR v_cta_url !~ '^https://[^[:space:]]+$' THEN
      RETURN 'cta_url_required';
    END IF;
  ELSIF v_cta = 'CALL' AND v_cta_url IS NOT NULL THEN
    RETURN 'cta_url_not_allowed';
  END IF;

  IF v_topic = 'EVENT' THEN
    IF COALESCE(btrim(p_post->>'event_title'), '') = '' THEN
      RETURN 'event_title_required';
    END IF;
    IF (p_post->>'event_start') IS NULL OR (p_post->>'event_end') IS NULL THEN
      RETURN 'event_time_required';
    END IF;
    BEGIN
      v_start := (p_post->>'event_start')::timestamptz;
      v_end := (p_post->>'event_end')::timestamptz;
    EXCEPTION WHEN others THEN
      RETURN 'event_time_invalid';
    END;
    IF v_start >= v_end THEN
      RETURN 'event_time_order';
    END IF;
  END IF;

  IF v_topic = 'OFFER' THEN
    IF COALESCE(btrim(p_post->>'offer_coupon_code'), '') = ''
       AND v_offer_url IS NULL
       AND COALESCE(btrim(p_post->>'offer_terms'), '') = '' THEN
      RETURN 'offer_details_required';
    END IF;
    IF v_offer_url IS NOT NULL AND v_offer_url !~ '^https://[^[:space:]]+$' THEN
      RETURN 'offer_url_invalid';
    END IF;
  END IF;

  RETURN NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.google_post_field_error(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.google_post_field_error(jsonb) TO authenticated, service_role;

-- Validate the media ids attached to a post: every one must be a BUSINESS photo
-- belonging to the SAME office. Returns the ordered URL list to hand to Google.
CREATE OR REPLACE FUNCTION public.resolve_google_post_media_urls(
  p_office_id uuid,
  p_media_ids uuid[]
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_ids uuid[] := COALESCE(p_media_ids, ARRAY[]::uuid[]);
  v_distinct integer;
  v_found integer;
  v_bad integer;
BEGIN
  IF array_length(v_ids, 1) IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;

  SELECT count(DISTINCT x) INTO v_distinct FROM unnest(v_ids) x;
  IF v_distinct <> array_length(v_ids, 1) THEN
    RAISE EXCEPTION 'Duplicate media ids are not allowed'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT count(*) INTO v_found
  FROM public.google_business_media m
  WHERE m.id = ANY (v_ids) AND m.office_id = p_office_id;

  IF v_found <> array_length(v_ids, 1) THEN
    RAISE EXCEPTION 'Media does not belong to this office'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT count(*) INTO v_bad
  FROM public.google_business_media m
  WHERE m.id = ANY (v_ids)
    AND m.media_origin <> 'BUSINESS';

  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Customer media cannot be used in a post'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN ARRAY(
    SELECT COALESCE(m.google_full_url, m.google_source_url)
    FROM public.google_business_media m
    WHERE m.id = ANY (v_ids)
    ORDER BY array_position(v_ids, m.id)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.resolve_google_post_media_urls(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_google_post_media_urls(uuid, uuid[]) TO authenticated, service_role;

-- The editable-content fingerprint of a post, used for stale-edit detection.
CREATE OR REPLACE FUNCTION public.google_post_content(p_post jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'topic_type', COALESCE(p_post->>'topic_type','STANDARD'),
    'language_code', COALESCE(p_post->>'language_code','en'),
    'summary', COALESCE(p_post->>'summary',''),
    'cta_type', p_post->>'cta_type',
    'cta_url', p_post->>'cta_url',
    'event_title', p_post->>'event_title',
    'event_start', p_post->>'event_start',
    'event_end', p_post->>'event_end',
    'offer_coupon_code', p_post->>'offer_coupon_code',
    'offer_url', p_post->>'offer_url',
    'offer_terms', p_post->>'offer_terms',
    'media_ids', COALESCE(p_post->'media_ids', '[]'::jsonb)
  );
$fn$;

REVOKE ALL ON FUNCTION public.google_post_content(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.google_post_content(jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 13. Post read RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_office_google_posts(
  p_office_id uuid,
  p_status text DEFAULT NULL,
  p_topic_type text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  office_id uuid,
  google_post_id text,
  google_location_id text,
  topic_type text,
  language_code text,
  summary text,
  cta_type text,
  cta_url text,
  event_title text,
  event_start timestamptz,
  event_end timestamptz,
  offer_coupon_code text,
  offer_url text,
  offer_terms text,
  media_ids uuid[],
  media_urls text[],
  google_state text,
  search_url text,
  status text,
  last_error_code text,
  last_error_message text,
  published_at timestamptz,
  deleted_at timestamptz,
  version integer,
  google_update_time timestamptz,
  created_by uuid,
  created_by_name text,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  last_synced_at timestamptz,
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
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_VIEW')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT p.*
    FROM public.google_business_posts p
    WHERE p.office_id = p_office_id
      AND (
        p_status IS NULL OR p_status = 'all'
        OR (p_status = 'published' AND p.status = 'PUBLISHED')
        OR (p_status = 'drafts' AND p.status IN ('DRAFT','FAILED'))
        OR (p_status = 'failed' AND p.status = 'FAILED')
        OR (p_status = 'deleted' AND p.status IN ('DELETED','DELETED_EXTERNALLY'))
      )
      AND (p_topic_type IS NULL OR p_topic_type = 'all' OR p.topic_type = p_topic_type)
      AND (
        v_search IS NULL
        OR p.summary ILIKE '%' || v_search || '%'
        OR p.event_title ILIKE '%' || v_search || '%'
      )
  ),
  counted AS (SELECT count(*) AS total FROM filtered)
  SELECT
    f.id, f.office_id, f.google_post_id, f.google_location_id,
    f.topic_type, f.language_code, f.summary, f.cta_type, f.cta_url,
    f.event_title, f.event_start, f.event_end,
    f.offer_coupon_code, f.offer_url, f.offer_terms,
    f.media_ids, f.media_urls, f.google_state, f.search_url, f.status,
    f.last_error_code, f.last_error_message, f.published_at, f.deleted_at,
    f.version, f.google_update_time, f.created_by, creator.full_name,
    f.updated_by, f.created_at, f.updated_at, f.last_synced_at, c.total
  FROM filtered f CROSS JOIN counted c
  LEFT JOIN public.profiles creator ON creator.id = f.created_by
  ORDER BY f.created_at DESC, f.id
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 30), 100), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$fn$;

REVOKE ALL ON FUNCTION public.list_office_google_posts(uuid, text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_office_google_posts(uuid, text, text, text, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_office_google_posts_summary(p_office_id uuid)
RETURNS TABLE (
  office_id uuid,
  draft_count bigint,
  published_count bigint,
  failed_count bigint,
  deleted_count bigint,
  posts_last_synced_at timestamptz,
  posts_last_successful_sync_at timestamptz,
  posts_sync_error_code text,
  posts_sync_error_message text,
  mapping_status text,
  connection_status text,
  google_location_name text,
  google_maps_url text
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
    COALESCE(agg.draft_count, 0),
    COALESCE(agg.published_count, 0),
    COALESCE(agg.failed_count, 0),
    COALESCE(agg.deleted_count, 0),
    ogp.posts_last_synced_at,
    ogp.posts_last_successful_sync_at,
    ogp.posts_sync_error_code,
    ogp.posts_sync_error_message,
    ogp.mapping_status,
    ogp.connection_status,
    ogp.google_location_name,
    ogp.google_maps_url
  FROM public.office_google_profiles ogp
  LEFT JOIN (
    SELECT
      p.office_id,
      count(*) FILTER (WHERE p.status IN ('DRAFT')) AS draft_count,
      count(*) FILTER (WHERE p.status = 'PUBLISHED') AS published_count,
      count(*) FILTER (WHERE p.status = 'FAILED') AS failed_count,
      count(*) FILTER (WHERE p.status IN ('DELETED','DELETED_EXTERNALLY')) AS deleted_count
    FROM public.google_business_posts p
    GROUP BY p.office_id
  ) agg ON agg.office_id = ogp.office_id
  WHERE ogp.office_id = p_office_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_office_google_posts_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_office_google_posts_summary(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_google_post_office(
  p_office_id uuid,
  p_post_id uuid
)
RETURNS TABLE (
  post_id uuid,
  office_id uuid,
  google_account_id text,
  google_location_id text,
  google_post_id text,
  google_post_resource_name text,
  status text,
  version integer,
  topic_type text,
  language_code text,
  summary text,
  cta_type text,
  cta_url text,
  event_title text,
  event_start timestamptz,
  event_end timestamptz,
  offer_coupon_code text,
  offer_url text,
  offer_terms text,
  media_ids uuid[],
  media_urls text[],
  publish_operation_id text,
  delete_operation_id text,
  published_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_office_id uuid;
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_VIEW')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT p.office_id INTO v_office_id
  FROM public.google_business_posts p WHERE p.id = p_post_id;

  IF v_office_id IS NULL THEN
    RETURN;
  END IF;

  IF v_office_id <> p_office_id THEN
    RAISE EXCEPTION 'Post does not belong to this office'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT p.id, p.office_id, p.google_account_id, p.google_location_id,
         p.google_post_id, p.google_post_resource_name, p.status, p.version,
         p.topic_type, p.language_code, p.summary, p.cta_type, p.cta_url,
         p.event_title, p.event_start, p.event_end,
         p.offer_coupon_code, p.offer_url, p.offer_terms,
         p.media_ids, p.media_urls,
         p.publish_operation_id, p.delete_operation_id, p.published_at
  FROM public.google_business_posts p
  WHERE p.id = p_post_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.resolve_google_post_office(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_google_post_office(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 10. Media delete — business media only, after Google confirms
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_mark_google_media_deleted(
  p_office_id uuid,
  p_media_id uuid,
  p_google_status integer DEFAULT 200,
  -- Trusted server callers pass the authenticated actor explicitly.
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS TABLE (media_id uuid, media_state text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := COALESCE(p_actor_user_id, auth.uid());
  v_origin text;
  v_google_media_id text;
  v_location_id text;
BEGIN
  -- Recording a Google media deletion asserts "Google removed this". That
  -- assertion must come from the connector, so this RPC is service-role only.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT public.google_actor_can(p_office_id, v_actor, 'GOOGLE_MANAGE_MEDIA') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT m.media_origin, m.google_media_id, m.google_location_id
  INTO v_origin, v_google_media_id, v_location_id
  FROM public.google_business_media m
  WHERE m.id = p_media_id AND m.office_id = p_office_id;

  IF v_google_media_id IS NULL THEN
    RAISE EXCEPTION 'Media not found' USING ERRCODE = 'no_data_found';
  END IF;

  -- Customer-contributed media is never managed by DARB, even by an Admin.
  IF v_origin = 'CUSTOMER' THEN
    RAISE EXCEPTION 'Customer media cannot be deleted from DARB'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.google_business_media
  SET media_state = 'DELETED', updated_at = now()
  WHERE id = p_media_id AND office_id = p_office_id;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, resource_id, after_data
  ) VALUES (
    p_office_id, v_location_id, v_actor,
    COALESCE(public.google_actor_role(p_office_id, v_actor), 'admin'),
    'GOOGLE_MEDIA_DELETED', 'media', p_media_id::text,
    jsonb_build_object('google_media_id', v_google_media_id,
                       'google_status', COALESCE(p_google_status, 200))
  );

  RETURN QUERY SELECT p_media_id, 'DELETED'::text;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_mark_google_media_deleted(uuid, uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_google_media_deleted(uuid, uuid, integer, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 11. Media sync — upsert Google's media, mark what Google no longer returns
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_sync_google_media(
  p_office_id uuid,
  p_media jsonb,
  -- False when the caller's pagination walk was capped with a token remaining.
  -- An incomplete set must never drive the "Google no longer returns it" sweep.
  p_complete boolean DEFAULT true,
  -- Trusted server callers pass the authenticated actor explicitly.
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS TABLE (inserted integer, updated integer, marked_not_found integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := COALESCE(p_actor_user_id, auth.uid());
  v_location_id text;
  v_account_id text;
  v_item jsonb;
  v_existing uuid;
  v_media_id uuid;
  v_ins integer := 0;
  v_upd integer := 0;
  v_nf integer := 0;
  v_seen text[] := ARRAY[]::text[];
BEGIN
  -- This RPC persists a caller-supplied Google snapshot, so only the
  -- service-role connector may call it; the connector passes the authenticated
  -- actor as p_actor_user_id. Authorization still runs against that actor.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT public.google_actor_can(p_office_id, v_actor, 'GOOGLE_SYNC_MEDIA') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF jsonb_typeof(p_media) <> 'array' THEN
    RAISE EXCEPTION 'p_media must be a JSON array';
  END IF;

  SELECT ogp.google_location_id, ogp.google_account_id
  INTO v_location_id, v_account_id
  FROM public.office_google_profiles ogp
  WHERE ogp.office_id = p_office_id
    AND ogp.mapping_status = 'MAPPED'
    AND ogp.google_location_id IS NOT NULL;

  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'Office has no mapped Google location';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_media)
  LOOP
    IF (v_item->>'google_media_id') IS NULL OR (v_item->>'google_media_id') = '' THEN
      CONTINUE;
    END IF;
    v_seen := v_seen || (v_item->>'google_media_id');

    SELECT m.id INTO v_existing
    FROM public.google_business_media m
    WHERE m.google_location_id = v_location_id
      AND m.google_media_id = v_item->>'google_media_id';

    IF v_existing IS NULL THEN
      INSERT INTO public.google_business_media (
        office_id, google_account_id, google_location_id,
        google_media_id, google_media_resource_name,
        media_format, media_category, darb_category, media_origin,
        google_source_url, google_thumbnail_url, google_full_url,
        description, width, height, attribution, media_state, last_synced_at
      ) VALUES (
        p_office_id, v_account_id, v_location_id,
        v_item->>'google_media_id',
        COALESCE(v_item->>'google_media_resource_name',
                 'accounts/' || v_account_id || '/locations/' || v_location_id ||
                 '/media/' || (v_item->>'google_media_id')),
        NULLIF(v_item->>'media_format',''),
        NULLIF(v_item->>'media_category',''),
        NULLIF(v_item->>'darb_category',''),
        COALESCE(NULLIF(v_item->>'media_origin',''), 'BUSINESS'),
        NULLIF(v_item->>'google_source_url',''),
        NULLIF(v_item->>'google_thumbnail_url',''),
        NULLIF(v_item->>'google_full_url',''),
        NULLIF(v_item->>'description',''),
        NULLIF(v_item->>'width','')::integer,
        NULLIF(v_item->>'height','')::integer,
        NULLIF(v_item->>'attribution',''),
        COALESCE(NULLIF(v_item->>'media_state',''), 'PUBLISHED'),
        now()
      )
      RETURNING id INTO v_media_id;
      v_ins := v_ins + 1;
    ELSE
      UPDATE public.google_business_media m
      SET media_format = COALESCE(NULLIF(v_item->>'media_format',''), m.media_format),
          media_category = COALESCE(NULLIF(v_item->>'media_category',''), m.media_category),
          darb_category = COALESCE(NULLIF(v_item->>'darb_category',''), m.darb_category),
          google_source_url = COALESCE(NULLIF(v_item->>'google_source_url',''), m.google_source_url),
          google_thumbnail_url = COALESCE(NULLIF(v_item->>'google_thumbnail_url',''), m.google_thumbnail_url),
          google_full_url = COALESCE(NULLIF(v_item->>'google_full_url',''), m.google_full_url),
          width = COALESCE(NULLIF(v_item->>'width','')::integer, m.width),
          height = COALESCE(NULLIF(v_item->>'height','')::integer, m.height),
          attribution = COALESCE(NULLIF(v_item->>'attribution',''), m.attribution),
          -- Never resurrect a row DARB marked deleted locally.
          media_state = CASE
            WHEN m.media_state = 'DELETED' THEN m.media_state
            ELSE COALESCE(NULLIF(v_item->>'media_state',''), 'PUBLISHED')
          END,
          last_synced_at = now(),
          updated_at = now()
      WHERE m.id = v_existing;
      v_upd := v_upd + 1;
    END IF;
  END LOOP;

  -- Media Google no longer returns: mark NOT_FOUND (never delete). Only a
  -- COMPLETE walk may drive this sweep — a capped prefix would flag real media.
  IF COALESCE(p_complete, true) THEN
    UPDATE public.google_business_media
    SET media_state = 'NOT_FOUND', updated_at = now()
    WHERE office_id = p_office_id
      AND google_location_id = v_location_id
      AND media_state IN ('PUBLISHED','PROCESSING','SUBMITTED')
      AND NOT (google_media_id = ANY (v_seen));
    GET DIAGNOSTICS v_nf = ROW_COUNT;
  END IF;

  UPDATE public.office_google_profiles
  SET media_last_synced_at = now(),
      media_last_successful_sync_at = now(),
      media_sync_error_code = NULL,
      media_sync_error_message = NULL,
      media_sync_locked_at = NULL,
      updated_at = now()
  WHERE office_id = p_office_id;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, after_data
  ) VALUES (
    p_office_id, v_location_id, v_actor,
    COALESCE(public.google_actor_role(p_office_id, v_actor), 'admin'),
    'GOOGLE_MEDIA_SYNCED', 'media',
    jsonb_build_object('inserted', v_ins, 'updated', v_upd, 'marked_not_found', v_nf)
  );

  RETURN QUERY SELECT v_ins, v_upd, v_nf;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_sync_google_media(uuid, jsonb, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sync_google_media(uuid, jsonb, boolean, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_mark_google_media_sync_error(
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
    OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_SYNC_MEDIA')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.office_google_profiles
  SET media_sync_error_code = left(COALESCE(p_error_code, 'error'), 64),
      media_sync_error_message = left(COALESCE(p_error_message, 'Sync failed'), 500),
      media_sync_locked_at = NULL,
      updated_at = now()
  WHERE office_id = p_office_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_mark_google_media_sync_error(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_google_media_sync_error(uuid, text, text) TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 14. Post draft create / update
--
-- A draft never touches Google. It is office-scoped (office_id + the mapped
-- google_location_id are resolved server-side) and version-guarded so a stale
-- editor cannot silently overwrite another operator's change.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_google_post_draft(
  p_office_id uuid,
  p_post jsonb
)
RETURNS TABLE (post_id uuid, status text, version integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_location_id text;
  v_account_id text;
  v_err text;
  v_post_id uuid;
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_MANAGE_POSTS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_err := public.google_post_field_error(p_post);
  IF v_err IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid post: %', v_err
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT ogp.google_location_id, ogp.google_account_id
  INTO v_location_id, v_account_id
  FROM public.office_google_profiles ogp
  WHERE ogp.office_id = p_office_id;

  -- Validate any attached media before the row exists.
  PERFORM public.resolve_google_post_media_urls(
    p_office_id, COALESCE(
      (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(COALESCE(p_post->'media_ids','[]'::jsonb)) x),
      ARRAY[]::uuid[]));

  INSERT INTO public.google_business_posts (
    office_id, google_account_id, google_location_id,
    topic_type, language_code, summary, cta_type, cta_url,
    event_title, event_start, event_end,
    offer_coupon_code, offer_url, offer_terms,
    media_ids, status, version, created_by, updated_by, last_synced_hash
  ) VALUES (
    p_office_id, v_account_id, v_location_id,
    COALESCE(p_post->>'topic_type','STANDARD'),
    COALESCE(p_post->>'language_code','en'),
    NULLIF(p_post->>'summary',''),
    NULLIF(p_post->>'cta_type',''),
    NULLIF(p_post->>'cta_url',''),
    NULLIF(p_post->>'event_title',''),
    NULLIF(p_post->>'event_start','')::timestamptz,
    NULLIF(p_post->>'event_end','')::timestamptz,
    NULLIF(p_post->>'offer_coupon_code',''),
    NULLIF(p_post->>'offer_url',''),
    NULLIF(p_post->>'offer_terms',''),
    COALESCE(
      (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(COALESCE(p_post->'media_ids','[]'::jsonb)) x),
      ARRAY[]::uuid[]),
    'DRAFT', 1, v_actor, v_actor,
    public.google_post_hash(public.google_post_content(p_post))
  )
  RETURNING id INTO v_post_id;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, resource_id, after_data
  ) VALUES (
    p_office_id, v_location_id, v_actor,
    COALESCE(public.google_actor_role(p_office_id, v_actor), 'admin'),
    'GOOGLE_POST_DRAFT_CREATED', 'post', v_post_id::text,
    jsonb_build_object('topic_type', p_post->>'topic_type')
  );

  RETURN QUERY SELECT v_post_id, 'DRAFT'::text, 1;
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_google_post_draft(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_google_post_draft(uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_google_post_draft(
  p_office_id uuid,
  p_post_id uuid,
  p_post jsonb,
  p_expected_version integer DEFAULT NULL
)
RETURNS TABLE (post_id uuid, status text, version integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_office_id uuid;
  v_status text;
  v_version integer;
  v_new_version integer;
  v_location_id text;
  v_err text;
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_MANAGE_POSTS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT p.office_id, p.status, p.version, p.google_location_id
  INTO v_office_id, v_status, v_version, v_location_id
  FROM public.google_business_posts p
  WHERE p.id = p_post_id;

  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'Post not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_office_id <> p_office_id THEN
    RAISE EXCEPTION 'Post does not belong to this office'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- A publish in flight will write Google's id and content hash back onto this
  -- row; an edit now would race it and be silently overwritten, so refuse it.
  IF v_status IN ('DELETE_PENDING','DELETED','PUBLISHING') THEN
    RAISE EXCEPTION 'A post cannot be edited while it is being published or deleted'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Optimistic concurrency: a stale editor is told to refresh, not to clobber.
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_version THEN
    RAISE EXCEPTION 'Post was modified by someone else (expected version %)', p_expected_version
      USING ERRCODE = 'serialization_failure';
  END IF;

  v_err := public.google_post_field_error(p_post);
  IF v_err IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid post: %', v_err
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM public.resolve_google_post_media_urls(
    p_office_id, COALESCE(
      (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(COALESCE(p_post->'media_ids','[]'::jsonb)) x),
      ARRAY[]::uuid[]));

  v_new_version := v_version + 1;

  UPDATE public.google_business_posts
  SET topic_type = COALESCE(p_post->>'topic_type', topic_type),
      language_code = COALESCE(p_post->>'language_code', language_code),
      summary = NULLIF(p_post->>'summary',''),
      cta_type = NULLIF(p_post->>'cta_type',''),
      cta_url = NULLIF(p_post->>'cta_url',''),
      event_title = NULLIF(p_post->>'event_title',''),
      event_start = NULLIF(p_post->>'event_start','')::timestamptz,
      event_end = NULLIF(p_post->>'event_end','')::timestamptz,
      offer_coupon_code = NULLIF(p_post->>'offer_coupon_code',''),
      offer_url = NULLIF(p_post->>'offer_url',''),
      offer_terms = NULLIF(p_post->>'offer_terms',''),
      media_ids = COALESCE(
        (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(COALESCE(p_post->'media_ids','[]'::jsonb)) x),
        ARRAY[]::uuid[]),
      version = v_new_version,
      updated_by = v_actor,
      updated_at = now(),
      last_synced_hash = public.google_post_hash(public.google_post_content(p_post))
  WHERE id = p_post_id AND office_id = p_office_id;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, resource_id, after_data
  ) VALUES (
    p_office_id, v_location_id, v_actor,
    COALESCE(public.google_actor_role(p_office_id, v_actor), 'admin'),
    'GOOGLE_POST_UPDATED', 'post', p_post_id::text,
    jsonb_build_object('version', v_new_version)
  );

  RETURN QUERY SELECT p_post_id, v_status, v_new_version;
END;
$fn$;

REVOKE ALL ON FUNCTION public.update_google_post_draft(uuid, uuid, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_google_post_draft(uuid, uuid, jsonb, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 15. Post publish locking + idempotency
-- ---------------------------------------------------------------------------

-- Reserve a publish attempt. Returns true when the caller now owns the lock.
CREATE OR REPLACE FUNCTION public.acquire_google_post_publish_lock(
  p_office_id uuid,
  p_post_id uuid,
  p_operation_id text,
  p_stale_after_seconds integer DEFAULT 120
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_acquired boolean;
  v_office_id uuid;
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_MANAGE_POSTS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT p.office_id INTO v_office_id
  FROM public.google_business_posts p WHERE p.id = p_post_id;

  IF v_office_id IS NULL OR v_office_id <> p_office_id THEN
    RAISE EXCEPTION 'Post does not belong to this office'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.google_business_posts
  SET publish_locked_at = now(),
      publish_operation_id = p_operation_id,
      status = CASE WHEN status IN ('DRAFT','PUBLISHING') THEN 'PUBLISHING' ELSE status END,
      updated_at = now()
  WHERE id = p_post_id
    AND office_id = p_office_id
    -- A live publish/delete is never stolen. A PUBLISHING row whose lock has
    -- gone stale (the connector crashed after Google accepted but before the
    -- result was recorded) IS reclaimable, so the post cannot wedge forever.
    AND status NOT IN ('DELETE_PENDING','DELETED')
    AND (
      publish_locked_at IS NULL
      OR publish_locked_at < now() - make_interval(secs => GREATEST(p_stale_after_seconds, 30))
    )
  RETURNING true INTO v_acquired;

  RETURN COALESCE(v_acquired, false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.acquire_google_post_publish_lock(uuid, uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acquire_google_post_publish_lock(uuid, uuid, text, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.release_google_post_publish_lock(p_office_id uuid, p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_MANAGE_POSTS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.google_business_posts
  SET publish_locked_at = NULL, updated_at = now()
  WHERE id = p_post_id AND office_id = p_office_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.release_google_post_publish_lock(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_google_post_publish_lock(uuid, uuid) TO authenticated, service_role;

-- Idempotency check. Returns the receipt result when this operation already
-- ran, so a double tap / retry does not publish a second Google post.
CREATE OR REPLACE FUNCTION public.check_google_post_operation(
  p_office_id uuid,
  p_operation text,
  p_operation_id text
)
RETURNS TABLE (found boolean, result jsonb)
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

  IF p_operation_id IS NULL OR length(btrim(p_operation_id)) < 8 THEN
    RETURN QUERY SELECT false, NULL::jsonb;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT true, r.result
  FROM public.google_post_operation_receipts r
  WHERE r.office_id = p_office_id
    AND r.operation = p_operation
    AND r.operation_id = p_operation_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::jsonb;
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.check_google_post_operation(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_google_post_operation(uuid, text, text) TO authenticated, service_role;

-- Persist a successful publish AFTER Google accepted the create/patch.
CREATE OR REPLACE FUNCTION public.admin_apply_google_post_publish(
  p_office_id uuid,
  p_post_id uuid,
  p_google_post_id text,
  p_google_post_resource_name text,
  p_google_state text,
  p_operation_id text,
  p_request_hash text,
  p_media_urls text[] DEFAULT ARRAY[]::text[],
  p_search_url text DEFAULT NULL,
  p_google_update_time timestamptz DEFAULT NULL,
  -- Trusted server callers pass the authenticated actor explicitly.
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS TABLE (post_id uuid, status text, version integer, published_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := COALESCE(p_actor_user_id, auth.uid());
  v_office_id uuid;
  v_status text;
  v_version integer;
  v_location_id text;
  v_lock_operation text;
  v_published timestamptz := now();
  v_result jsonb;
BEGIN
  -- Recording a successful publish asserts "Google accepted this create/patch".
  -- That assertion must come from the connector, so this RPC is service-role
  -- only; an Admin's own in-browser session cannot forge a published post.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT public.google_actor_can(p_office_id, v_actor, 'GOOGLE_MANAGE_POSTS') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT p.office_id, p.status, p.version, p.google_location_id, p.publish_operation_id
  INTO v_office_id, v_status, v_version, v_location_id, v_lock_operation
  FROM public.google_business_posts p WHERE p.id = p_post_id;

  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'Post not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_office_id <> p_office_id THEN
    RAISE EXCEPTION 'Post does not belong to this office'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- A success may only be recorded for the publish operation that holds the
  -- lock. A late/duplicate call for an older operation is refused so it cannot
  -- stamp a Google id onto a post another operation has since taken over.
  IF v_lock_operation IS DISTINCT FROM p_operation_id THEN
    RAISE EXCEPTION 'Publish lock is held by a different operation'
      USING ERRCODE = 'serialization_failure';
  END IF;

  UPDATE public.google_business_posts
  SET google_post_id = p_google_post_id,
      google_post_resource_name = p_google_post_resource_name,
      google_state = p_google_state,
      google_update_time = COALESCE(p_google_update_time, now()),
      status = 'PUBLISHED',
      published_at = COALESCE(published_at, v_published),
      last_error_code = NULL,
      last_error_message = NULL,
      media_urls = COALESCE(p_media_urls, ARRAY[]::text[]),
      search_url = COALESCE(p_search_url, search_url),
      publish_locked_at = NULL,
      publish_operation_id = p_operation_id,
      updated_by = v_actor,
      updated_at = now(),
      last_synced_at = now()
  WHERE id = p_post_id AND office_id = p_office_id;

  v_result := jsonb_build_object(
    'post_id', p_post_id,
    'status', 'PUBLISHED',
    'google_post_id', p_google_post_id
  );

  INSERT INTO public.google_post_operation_receipts (
    office_id, post_id, operation, operation_id, actor_user_id, request_hash, result
  ) VALUES (
    p_office_id, p_post_id, 'PUBLISH', p_operation_id, v_actor,
    COALESCE(p_request_hash, ''), v_result
  )
  ON CONFLICT (office_id, operation, operation_id) DO NOTHING;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, resource_id, after_data
  ) VALUES (
    p_office_id, v_location_id, v_actor,
    COALESCE(public.google_actor_role(p_office_id, v_actor), 'admin'),
    CASE WHEN v_status = 'PUBLISHED' THEN 'GOOGLE_POST_UPDATED' ELSE 'GOOGLE_POST_CREATED' END,
    'post', p_post_id::text,
    jsonb_build_object('google_post_id', p_google_post_id,
                       'google_state', p_google_state)
  );

  RETURN QUERY SELECT p_post_id, 'PUBLISHED'::text, v_version, v_published;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_apply_google_post_publish(uuid, uuid, text, text, text, text, text, text[], text, timestamptz, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_apply_google_post_publish(uuid, uuid, text, text, text, text, text, text[], text, timestamptz, uuid) TO service_role;

-- Persist a failed publish: the draft is retained, status FAILED, lock released.
CREATE OR REPLACE FUNCTION public.admin_mark_google_post_publish_failed(
  p_office_id uuid,
  p_post_id uuid,
  p_error_code text,
  p_error_message text,
  -- Trusted server callers pass the authenticated actor explicitly.
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := COALESCE(p_actor_user_id, auth.uid());
  v_location_id text;
BEGIN
  -- Recording a publish outcome asserts "Google rejected/accepted this". That
  -- assertion must come from the connector, so this RPC is service-role only.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT public.google_actor_can(p_office_id, v_actor, 'GOOGLE_MANAGE_POSTS') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT p.google_location_id INTO v_location_id
  FROM public.google_business_posts p
  WHERE p.id = p_post_id AND p.office_id = p_office_id;

  IF v_location_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.google_business_posts p
    WHERE p.id = p_post_id AND p.office_id = p_office_id
  ) THEN
    RAISE EXCEPTION 'Post not found' USING ERRCODE = 'no_data_found';
  END IF;

  UPDATE public.google_business_posts
  SET status = 'FAILED',
      last_error_code = left(COALESCE(p_error_code,'error'), 64),
      last_error_message = left(COALESCE(p_error_message,'Publish failed'), 500),
      publish_locked_at = NULL,
      updated_by = v_actor,
      updated_at = now()
  WHERE id = p_post_id AND office_id = p_office_id;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, resource_id, after_data
  ) VALUES (
    p_office_id, v_location_id, v_actor,
    COALESCE(public.google_actor_role(p_office_id, v_actor), 'admin'),
    'GOOGLE_POST_PUBLISH_FAILED', 'post', p_post_id::text,
    jsonb_build_object('code', left(COALESCE(p_error_code,'error'), 64),
                       'message', left(COALESCE(p_error_message,'Publish failed'), 500))
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_mark_google_post_publish_failed(uuid, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_google_post_publish_failed(uuid, uuid, text, text, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 16. Post delete — after Google confirms
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.acquire_google_post_delete_lock(
  p_office_id uuid,
  p_post_id uuid,
  p_stale_after_seconds integer DEFAULT 120
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_acquired boolean;
  v_office_id uuid;
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_MANAGE_POSTS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT p.office_id INTO v_office_id
  FROM public.google_business_posts p WHERE p.id = p_post_id;

  IF v_office_id IS NULL OR v_office_id <> p_office_id THEN
    RAISE EXCEPTION 'Post does not belong to this office'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.google_business_posts
  SET delete_locked_at = now(),
      status = CASE WHEN status = 'PUBLISHED' THEN 'DELETE_PENDING' ELSE status END,
      updated_at = now()
  WHERE id = p_post_id
    AND office_id = p_office_id
    AND status NOT IN ('DELETE_PENDING','DELETED')
    AND (
      delete_locked_at IS NULL
      OR delete_locked_at < now() - make_interval(secs => GREATEST(p_stale_after_seconds, 30))
    )
  RETURNING true INTO v_acquired;

  RETURN COALESCE(v_acquired, false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.acquire_google_post_delete_lock(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acquire_google_post_delete_lock(uuid, uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.release_google_post_delete_lock(p_office_id uuid, p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_MANAGE_POSTS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.google_business_posts
  SET delete_locked_at = NULL, updated_at = now()
  WHERE id = p_post_id AND office_id = p_office_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.release_google_post_delete_lock(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_google_post_delete_lock(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_mark_google_post_deleted(
  p_office_id uuid,
  p_post_id uuid,
  p_operation_id text DEFAULT NULL,
  p_google_status integer DEFAULT 200,
  -- Trusted server callers pass the authenticated actor explicitly.
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS TABLE (post_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := COALESCE(p_actor_user_id, auth.uid());
  v_office_id uuid;
  v_location_id text;
  v_was_draft boolean;
  v_result jsonb;
BEGIN
  -- Recording a Google post deletion asserts "Google removed this". That
  -- assertion must come from the connector, so this RPC is service-role only.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT public.google_actor_can(p_office_id, v_actor, 'GOOGLE_MANAGE_POSTS') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT p.office_id, p.google_location_id, (p.status = 'DRAFT')
  INTO v_office_id, v_location_id, v_was_draft
  FROM public.google_business_posts p WHERE p.id = p_post_id;

  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'Post not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_office_id <> p_office_id THEN
    RAISE EXCEPTION 'Post does not belong to this office'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.google_business_posts
  SET status = 'DELETED',
      deleted_at = now(),
      delete_locked_at = NULL,
      delete_operation_id = p_operation_id,
      updated_by = v_actor,
      updated_at = now()
  WHERE id = p_post_id AND office_id = p_office_id;

  v_result := jsonb_build_object('post_id', p_post_id, 'status', 'DELETED');

  IF p_operation_id IS NOT NULL THEN
    INSERT INTO public.google_post_operation_receipts (
      office_id, post_id, operation, operation_id, actor_user_id, request_hash, result
    ) VALUES (
      p_office_id, p_post_id, 'DELETE', p_operation_id, v_actor, '', v_result
    )
    ON CONFLICT (office_id, operation, operation_id) DO NOTHING;
  END IF;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, resource_id, after_data
  ) VALUES (
    p_office_id, v_location_id, v_actor,
    COALESCE(public.google_actor_role(p_office_id, v_actor), 'admin'),
    'GOOGLE_POST_DELETED', 'post', p_post_id::text,
    jsonb_build_object('was_draft', v_was_draft,
                       'google_status', COALESCE(p_google_status, 200))
  );

  RETURN QUERY SELECT p_post_id, 'DELETED'::text;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_mark_google_post_deleted(uuid, uuid, text, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_google_post_deleted(uuid, uuid, text, integer, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 17. Posts sync — upsert Google's posts, mark externally-deleted ones
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_sync_google_posts(
  p_office_id uuid,
  p_posts jsonb,
  -- False when the caller's pagination walk was capped with a token remaining.
  -- An incomplete set must never drive the "Google no longer returns it" sweep.
  p_complete boolean DEFAULT true,
  -- Trusted server callers pass the authenticated actor explicitly.
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS TABLE (inserted integer, updated integer, marked_deleted integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := COALESCE(p_actor_user_id, auth.uid());
  v_location_id text;
  v_account_id text;
  v_item jsonb;
  v_existing uuid;
  v_post_id uuid;
  v_ins integer := 0;
  v_upd integer := 0;
  v_del integer := 0;
  v_seen text[] := ARRAY[]::text[];
  v_existing public.google_business_posts%ROWTYPE;
  v_incoming_hash text;
  v_local_authoritative boolean;
BEGIN
  -- This RPC persists a caller-supplied Google snapshot, so only the
  -- service-role connector may call it; the connector passes the authenticated
  -- actor as p_actor_user_id. Authorization still runs against that actor.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT public.google_actor_can(p_office_id, v_actor, 'GOOGLE_SYNC_POSTS') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF jsonb_typeof(p_posts) <> 'array' THEN
    RAISE EXCEPTION 'p_posts must be a JSON array';
  END IF;

  SELECT ogp.google_location_id, ogp.google_account_id
  INTO v_location_id, v_account_id
  FROM public.office_google_profiles ogp
  WHERE ogp.office_id = p_office_id
    AND ogp.mapping_status = 'MAPPED'
    AND ogp.google_location_id IS NOT NULL;

  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'Office has no mapped Google location';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_posts)
  LOOP
    IF (v_item->>'google_post_id') IS NULL OR (v_item->>'google_post_id') = '' THEN
      CONTINUE;
    END IF;
    v_seen := v_seen || (v_item->>'google_post_id');

    SELECT p.* INTO v_existing
    FROM public.google_business_posts p
    WHERE p.google_location_id = v_location_id
      AND p.google_post_id = v_item->>'google_post_id';

    IF v_existing.id IS NULL THEN
      INSERT INTO public.google_business_posts (
        office_id, google_account_id, google_location_id,
        google_post_id, google_post_resource_name,
        topic_type, language_code, summary, cta_type, cta_url,
        event_title, event_start, event_end,
        offer_coupon_code, offer_url, offer_terms,
        media_urls, google_state, search_url,
        status, published_at, google_update_time, last_synced_at,
        last_synced_hash
      ) VALUES (
        p_office_id, v_account_id, v_location_id,
        v_item->>'google_post_id',
        COALESCE(v_item->>'google_post_resource_name',
                 'accounts/' || v_account_id || '/locations/' || v_location_id ||
                 '/localPosts/' || (v_item->>'google_post_id')),
        COALESCE(NULLIF(v_item->>'topic_type',''), 'STANDARD'),
        COALESCE(NULLIF(v_item->>'language_code',''), 'en'),
        NULLIF(v_item->>'summary',''),
        NULLIF(v_item->>'cta_type',''),
        NULLIF(v_item->>'cta_url',''),
        NULLIF(v_item->>'event_title',''),
        NULLIF(v_item->>'event_start','')::timestamptz,
        NULLIF(v_item->>'event_end','')::timestamptz,
        NULLIF(v_item->>'offer_coupon_code',''),
        NULLIF(v_item->>'offer_url',''),
        NULLIF(v_item->>'offer_terms',''),
        COALESCE(
          (SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(v_item->'media_urls','[]'::jsonb)) x),
          ARRAY[]::text[]),
        NULLIF(v_item->>'google_state',''),
        NULLIF(v_item->>'search_url',''),
        'PUBLISHED',
        COALESCE(NULLIF(v_item->>'published_at','')::timestamptz, now()),
        NULLIF(v_item->>'google_update_time','')::timestamptz,
        now(),
        public.google_post_hash(public.google_post_content(v_item))
      )
      RETURNING id INTO v_post_id;
      v_ins := v_ins + 1;
    ELSE
      -- DARB may hold an un-pushed local edit (a FAILED publish, or a draft of a
      -- published post). Never let Google's older copy silently overwrite it:
      -- only adopt Google's content when DARB has not diverged from what it last
      -- synced. `google_post_content` ignores `version`, so `last_synced_hash`
      -- is the identity of "what DARB last saw".
      v_incoming_hash := public.google_post_hash(public.google_post_content(v_item));
      v_local_authoritative :=
        v_existing.last_synced_hash IS NOT NULL
        AND public.google_post_hash(public.google_post_content(
              jsonb_build_object(
                'topic_type', v_existing.topic_type,
                'language_code', v_existing.language_code,
                'summary', v_existing.summary,
                'cta_type', v_existing.cta_type,
                'cta_url', v_existing.cta_url,
                'event_title', v_existing.event_title,
                'event_start', v_existing.event_start,
                'event_end', v_existing.event_end,
                'offer_coupon_code', v_existing.offer_coupon_code,
                'offer_url', v_existing.offer_url,
                'offer_terms', v_existing.offer_terms,
                'media_ids', to_jsonb(v_existing.media_ids)
              ))) <> v_existing.last_synced_hash;

      UPDATE public.google_business_posts p
      SET topic_type = CASE WHEN v_local_authoritative THEN p.topic_type
                            ELSE COALESCE(NULLIF(v_item->>'topic_type',''), p.topic_type) END,
          language_code = CASE WHEN v_local_authoritative THEN p.language_code
                               ELSE COALESCE(NULLIF(v_item->>'language_code',''), p.language_code) END,
          summary = CASE WHEN v_local_authoritative THEN p.summary
                         ELSE COALESCE(NULLIF(v_item->>'summary',''), p.summary) END,
          cta_type = CASE WHEN v_local_authoritative THEN p.cta_type
                          ELSE COALESCE(NULLIF(v_item->>'cta_type',''), p.cta_type) END,
          cta_url = CASE WHEN v_local_authoritative THEN p.cta_url
                         ELSE COALESCE(NULLIF(v_item->>'cta_url',''), p.cta_url) END,
          event_title = CASE WHEN v_local_authoritative THEN p.event_title
                             ELSE COALESCE(NULLIF(v_item->>'event_title',''), p.event_title) END,
          event_start = CASE WHEN v_local_authoritative THEN p.event_start
                             ELSE COALESCE(NULLIF(v_item->>'event_start','')::timestamptz, p.event_start) END,
          event_end = CASE WHEN v_local_authoritative THEN p.event_end
                           ELSE COALESCE(NULLIF(v_item->>'event_end','')::timestamptz, p.event_end) END,
          offer_coupon_code = CASE WHEN v_local_authoritative THEN p.offer_coupon_code
                                   ELSE COALESCE(NULLIF(v_item->>'offer_coupon_code',''), p.offer_coupon_code) END,
          offer_url = CASE WHEN v_local_authoritative THEN p.offer_url
                           ELSE COALESCE(NULLIF(v_item->>'offer_url',''), p.offer_url) END,
          offer_terms = CASE WHEN v_local_authoritative THEN p.offer_terms
                             ELSE COALESCE(NULLIF(v_item->>'offer_terms',''), p.offer_terms) END,
          media_urls = CASE WHEN v_local_authoritative THEN p.media_urls
                            ELSE COALESCE(
                              (SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(v_item->'media_urls','[]'::jsonb)) x),
                              p.media_urls) END,
          google_state = COALESCE(NULLIF(v_item->>'google_state',''), p.google_state),
          search_url = COALESCE(NULLIF(v_item->>'search_url',''), p.search_url),
          -- A locally-FAILED publish must not read PUBLISHED just because Google
          -- still returns the old post; only a non-divergent row is reconciled.
          status = CASE
            WHEN p.status = 'DELETED' THEN p.status
            WHEN v_local_authoritative AND p.status = 'FAILED' THEN 'FAILED'
            ELSE 'PUBLISHED'
          END,
          google_update_time = COALESCE(NULLIF(v_item->>'google_update_time','')::timestamptz, p.google_update_time),
          last_synced_at = now(),
          updated_at = now(),
          -- When DARB holds the newer content, keep the baseline so the conflict
          -- stays detectable (and republishable) until it is resolved.
          last_synced_hash = CASE WHEN v_local_authoritative THEN p.last_synced_hash
                                  ELSE v_incoming_hash END
      WHERE p.id = v_existing.id;
      v_upd := v_upd + 1;
    END IF;
  END LOOP;

  -- Posts Google no longer returns: mark DELETED_EXTERNALLY (never delete).
  -- Only a COMPLETE walk may drive this sweep — a capped prefix would mark real
  -- posts externally deleted.
  IF COALESCE(p_complete, true) THEN
    UPDATE public.google_business_posts
    SET status = 'DELETED_EXTERNALLY', deleted_at = now(), updated_at = now()
    WHERE office_id = p_office_id
      AND google_location_id = v_location_id
      AND status = 'PUBLISHED'
      AND google_post_id IS NOT NULL
      AND NOT (google_post_id = ANY (v_seen));
    GET DIAGNOSTICS v_del = ROW_COUNT;
  END IF;

  UPDATE public.office_google_profiles
  SET posts_last_synced_at = now(),
      posts_last_successful_sync_at = now(),
      posts_sync_error_code = NULL,
      posts_sync_error_message = NULL,
      posts_sync_locked_at = NULL,
      updated_at = now()
  WHERE office_id = p_office_id;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, after_data
  ) VALUES (
    p_office_id, v_location_id, v_actor,
    COALESCE(public.google_actor_role(p_office_id, v_actor), 'admin'),
    'GOOGLE_POST_SYNCED', 'post',
    jsonb_build_object('inserted', v_ins, 'updated', v_upd, 'marked_deleted', v_del)
  );

  RETURN QUERY SELECT v_ins, v_upd, v_del;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_sync_google_posts(uuid, jsonb, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sync_google_posts(uuid, jsonb, boolean, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_mark_google_posts_sync_error(
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
    OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_SYNC_POSTS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.office_google_profiles
  SET posts_sync_error_code = left(COALESCE(p_error_code, 'error'), 64),
      posts_sync_error_message = left(COALESCE(p_error_message, 'Sync failed'), 500),
      posts_sync_locked_at = NULL,
      updated_at = now()
  WHERE office_id = p_office_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_mark_google_posts_sync_error(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_google_posts_sync_error(uuid, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 18. RLS + grants
--
-- Mirrors Phase 5: no browser role holds INSERT/UPDATE/DELETE on the caches.
-- Writes are RPC-only; reads go through the office-scoped read RPCs (which are
-- SECURITY DEFINER and enforce the authorizer). A table-level SELECT is granted
-- so the read RPCs can be exercised, but the tables carry RLS.
-- ---------------------------------------------------------------------------

ALTER TABLE public.google_business_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_business_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_media_upload_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_post_operation_receipts ENABLE ROW LEVEL SECURITY;

-- SELECT for the office's members (or admins). Reads are still normally done
-- through the RPCs; this keeps the direct-select surface consistent with the
-- reviews cache and lets an admin inspect a row.
DROP POLICY IF EXISTS "Members can read office google media" ON public.google_business_media;
CREATE POLICY "Members can read office google media"
  ON public.google_business_media FOR SELECT
  USING (
    public.is_admin_session()
    OR EXISTS (
      SELECT 1 FROM public.office_members om
      WHERE om.office_id = google_business_media.office_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
    )
  );

DROP POLICY IF EXISTS "Members can read office google posts" ON public.google_business_posts;
CREATE POLICY "Members can read office google posts"
  ON public.google_business_posts FOR SELECT
  USING (
    public.is_admin_session()
    OR EXISTS (
      SELECT 1 FROM public.office_members om
      WHERE om.office_id = google_business_posts.office_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
    )
  );

REVOKE ALL ON public.google_business_media FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.google_business_media TO authenticated;
GRANT ALL ON public.google_business_media TO service_role;

REVOKE ALL ON public.google_business_posts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.google_business_posts TO authenticated;
GRANT ALL ON public.google_business_posts TO service_role;

-- Receipts are server-only: no browser read, no browser write.
REVOKE ALL ON public.google_media_upload_receipts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.google_media_upload_receipts TO service_role;

REVOKE ALL ON public.google_post_operation_receipts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.google_post_operation_receipts TO service_role;

-- ---------------------------------------------------------------------------
-- 19. Storage — private staging bucket for Google media
--
-- Bytes are staged here before a server-side byte upload to Google. The bucket
-- is PRIVATE (the bytes are the business's originals, not a public asset), so
-- only the office's members may write under their office prefix.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'google-business',
  'google-business',
  FALSE,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- A member may read/write only under their own office's prefix. The path is
-- validated server-side before it is ever used, but the storage policy is the
-- second layer: a forged path to another office's prefix is rejected here too.
DROP POLICY IF EXISTS "Members can read own office google-business" ON storage.objects;
CREATE POLICY "Members can read own office google-business"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'google-business'
    AND (
      public.is_admin_session()
      OR EXISTS (
        SELECT 1 FROM public.office_members om
        WHERE om.user_id = auth.uid()
          AND om.is_active = true
          AND om.office_id::text = (storage.foldername(name))[1]
      )
    )
  );

DROP POLICY IF EXISTS "Members can upload own office google-business" ON storage.objects;
CREATE POLICY "Members can upload own office google-business"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'google-business'
    AND EXISTS (
      SELECT 1 FROM public.office_members om
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
        AND om.office_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Members can delete own office google-business" ON storage.objects;
CREATE POLICY "Members can delete own office google-business"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'google-business'
    AND (
      public.is_admin_session()
      OR EXISTS (
        SELECT 1 FROM public.office_members om
        WHERE om.user_id = auth.uid()
          AND om.is_active = true
          AND om.office_id::text = (storage.foldername(name))[1]
      )
    )
  );

