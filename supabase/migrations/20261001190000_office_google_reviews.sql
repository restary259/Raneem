-- ===========================================================================
-- PHASE 5 — Google Reviews Center + Reply Management
--
-- The first phase where DARB performs a *visible* Google Business action. Phase
-- 4 decided WHO may operate a location; Phase 5 decides HOW they manage that
-- location's reviews.
--
-- What this migration adds:
--   1. google_business_reviews — the local cache of Google reviews, keyed by
--      (google_location_id, google_review_id) so a re-sync can never duplicate.
--   2. Review freshness + summary columns on office_google_profiles, plus an
--      advisory sync lock so one office cannot stampede the Google API.
--   3. A review-ownership validator: a review's (office_id, google_location_id)
--      must match the office mapping, so a forged office_id is rejected at the
--      data layer as well as in the RPC.
--   4. Read RPCs (list / summary / detail) that filter and paginate server-side.
--   5. Write RPCs that persist the result of a Google reply AFTER Google has
--      accepted it — DARB never marks a review replied before Google confirms.
--   6. Notifications for newly-seen reviews, scoped to Admin + that office's
--      Primary + Side Manager (never the whole team).
--
-- Timestamp is newer than 20261001180000 (Phase 4) so this authorizer wins on a
-- fresh deploy.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Review cache
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.google_business_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  google_connection_id UUID,
  google_account_id TEXT NOT NULL,
  google_location_id TEXT NOT NULL,
  google_review_id TEXT NOT NULL,
  google_review_resource_name TEXT NOT NULL,
  reviewer_display_name TEXT,
  reviewer_profile_photo_url TEXT,
  reviewer_is_anonymous BOOLEAN NOT NULL DEFAULT false,
  star_rating INTEGER NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
  comment TEXT,
  review_create_time TIMESTAMPTZ,
  review_update_time TIMESTAMPTZ,
  reply_comment TEXT,
  reply_update_time TIMESTAMPTZ,
  reply_state TEXT,
  reply_policy_violation TEXT,
  -- DARB's own lifecycle. Never merged with Google's raw replyState: a Google
  -- enum can change meaning without DARB's product state changing.
  darb_reply_status TEXT NOT NULL DEFAULT 'UNANSWERED'
    CHECK (darb_reply_status IN ('UNANSWERED','ANSWERED','REPLY_PENDING','REPLY_REJECTED','SYNC_ERROR')),
  -- A review Google stops returning is marked unavailable, never deleted, so
  -- DARB keeps its reply history and audit trail.
  visibility_state TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (visibility_state IN ('ACTIVE','NOT_FOUND','REMOVED','STALE')),
  google_review_url TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT google_business_reviews_location_review_key
    UNIQUE (google_location_id, google_review_id)
);

CREATE INDEX IF NOT EXISTS idx_google_reviews_office_updated
  ON public.google_business_reviews (office_id, review_update_time DESC);
CREATE INDEX IF NOT EXISTS idx_google_reviews_office_rating
  ON public.google_business_reviews (office_id, star_rating);
CREATE INDEX IF NOT EXISTS idx_google_reviews_office_reply_state
  ON public.google_business_reviews (office_id, darb_reply_status);
CREATE INDEX IF NOT EXISTS idx_google_reviews_office_visibility
  ON public.google_business_reviews (office_id, visibility_state);
CREATE INDEX IF NOT EXISTS idx_google_reviews_location
  ON public.google_business_reviews (google_location_id);

-- A review may only exist under the office that maps its Google location. This
-- is the data-layer half of "review ownership validation" — a forged office_id
-- is rejected even if some future caller bypasses the RPC.
CREATE OR REPLACE FUNCTION public.validate_google_review()
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
    RAISE EXCEPTION 'Review location does not belong to this office mapping'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.validate_google_review() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_google_review() TO service_role;

DROP TRIGGER IF EXISTS trg_validate_google_review ON public.google_business_reviews;
CREATE TRIGGER trg_validate_google_review
BEFORE INSERT OR UPDATE OF office_id, google_location_id
ON public.google_business_reviews
FOR EACH ROW EXECUTE FUNCTION public.validate_google_review();

-- ---------------------------------------------------------------------------
-- 2. Review freshness + summary on the office mapping
--
-- Google returns averageRating / totalReviewCount alongside reviews.list, so
-- the authoritative numbers are stored here. The per-star histogram is derived
-- from the cached rows by get_office_google_review_summary().
-- ---------------------------------------------------------------------------

ALTER TABLE public.office_google_profiles
  ADD COLUMN IF NOT EXISTS review_average_rating NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS review_total_count INTEGER,
  ADD COLUMN IF NOT EXISTS review_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_last_successful_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_sync_error_code TEXT,
  ADD COLUMN IF NOT EXISTS review_sync_error_message TEXT,
  ADD COLUMN IF NOT EXISTS review_sync_locked_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 3. Authorizer — add GOOGLE_SYNC_REVIEWS
--
-- Full redefinition (Phase 4 body) plus one operational action. Kept as one
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
    'GOOGLE_MANAGE_SUPPORTED_CONTENT',
    -- Phase 5 operational
    'GOOGLE_SYNC_REVIEWS',
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
-- 4. Sync lock — one sync per office at a time
--
-- Returns true when the caller now owns the lock. A lock older than the stale
-- window is reclaimable, so a crashed sync cannot wedge the office forever.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.acquire_google_review_sync_lock(
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
  -- Same gate as the sync itself: a caller who cannot sync must not be able to
  -- lock (or wedge) another office's sync by id.
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_SYNC_REVIEWS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.office_google_profiles
  SET review_sync_locked_at = now(),
      updated_at = now()
  WHERE office_id = p_office_id
    AND (
      review_sync_locked_at IS NULL
      OR review_sync_locked_at < now() - make_interval(secs => GREATEST(p_stale_after_seconds, 30))
    )
  RETURNING true INTO v_acquired;

  RETURN COALESCE(v_acquired, false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.acquire_google_review_sync_lock(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acquire_google_review_sync_lock(uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.release_google_review_sync_lock(p_office_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_SYNC_REVIEWS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.office_google_profiles
  SET review_sync_locked_at = NULL,
      updated_at = now()
  WHERE office_id = p_office_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.release_google_review_sync_lock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_google_review_sync_lock(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Ownership resolver
--
-- DARB review id -> the office/location it actually belongs to. Raises when the
-- review belongs to a different office than the one the caller claims, so a
-- cross-office id can never be acted on. Returns no row when the review does not
-- exist (the caller decides whether that is a 404).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_google_review_office(
  p_office_id uuid,
  p_review_id uuid
)
RETURNS TABLE (
  review_id uuid,
  office_id uuid,
  google_account_id text,
  google_location_id text,
  google_review_id text,
  google_review_resource_name text,
  reply_comment text,
  darb_reply_status text
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

  SELECT r.office_id INTO v_office_id
  FROM public.google_business_reviews r
  WHERE r.id = p_review_id;

  IF v_office_id IS NULL THEN
    RETURN;
  END IF;

  IF v_office_id <> p_office_id THEN
    RAISE EXCEPTION 'Review does not belong to this office'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT r.id, r.office_id, r.google_account_id, r.google_location_id,
         r.google_review_id, r.google_review_resource_name,
         r.reply_comment, r.darb_reply_status
  FROM public.google_business_reviews r
  WHERE r.id = p_review_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.resolve_google_review_office(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_google_review_office(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Read RPC — paginated, server-filtered review list
--
-- Filtering and pagination happen here, never in React: the UI stays fast with
-- 10 reviews or 10,000. `total_count` is the count matching the filter, so the
-- caller can render "x of y" without a second query.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_office_google_reviews(
  p_office_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_rating integer DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'recent',
  p_include_hidden boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  office_id uuid,
  google_review_id text,
  google_location_id text,
  reviewer_display_name text,
  reviewer_profile_photo_url text,
  reviewer_is_anonymous boolean,
  star_rating integer,
  comment text,
  review_create_time timestamptz,
  review_update_time timestamptz,
  reply_comment text,
  reply_update_time timestamptz,
  reply_state text,
  reply_policy_violation text,
  darb_reply_status text,
  visibility_state text,
  google_review_url text,
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
    SELECT r.*
    FROM public.google_business_reviews r
    WHERE r.office_id = p_office_id
      AND (p_include_hidden OR r.visibility_state = 'ACTIVE')
      AND (p_rating IS NULL OR r.star_rating = p_rating)
      AND (
        p_status IS NULL OR p_status = 'all'
        OR (p_status = 'unanswered' AND r.darb_reply_status = 'UNANSWERED')
        OR (p_status = 'replied'    AND r.darb_reply_status = 'ANSWERED')
        OR (p_status = 'pending'    AND r.darb_reply_status = 'REPLY_PENDING')
        OR (p_status = 'rejected'   AND r.darb_reply_status = 'REPLY_REJECTED')
      )
      AND (
        v_search IS NULL
        OR r.comment ILIKE '%' || v_search || '%'
        OR r.reviewer_display_name ILIKE '%' || v_search || '%'
      )
  ),
  counted AS (
    SELECT count(*) AS total FROM filtered
  )
  SELECT
    f.id, f.office_id, f.google_review_id, f.google_location_id,
    f.reviewer_display_name, f.reviewer_profile_photo_url, f.reviewer_is_anonymous,
    f.star_rating, f.comment, f.review_create_time, f.review_update_time,
    f.reply_comment, f.reply_update_time, f.reply_state, f.reply_policy_violation,
    f.darb_reply_status, f.visibility_state, f.google_review_url, f.last_synced_at,
    c.total
  FROM filtered f CROSS JOIN counted c
  ORDER BY
    CASE WHEN p_sort = 'rating_desc' THEN f.star_rating END DESC NULLS LAST,
    CASE WHEN p_sort = 'rating_asc'  THEN f.star_rating END ASC NULLS LAST,
    CASE WHEN p_sort = 'oldest'      THEN f.review_update_time END ASC NULLS LAST,
    f.review_update_time DESC NULLS LAST,
    f.created_at DESC
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 20), 100), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$fn$;

REVOKE ALL ON FUNCTION public.list_office_google_reviews(uuid, integer, integer, integer, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_office_google_reviews(uuid, integer, integer, integer, text, text, text, boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Read RPC — summary (Google's authoritative numbers + cached histogram)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_office_google_review_summary(p_office_id uuid)
RETURNS TABLE (
  office_id uuid,
  average_rating numeric,
  total_count integer,
  cached_count bigint,
  unanswered_count bigint,
  rating_1 bigint,
  rating_2 bigint,
  rating_3 bigint,
  rating_4 bigint,
  rating_5 bigint,
  review_last_synced_at timestamptz,
  review_last_successful_sync_at timestamptz,
  review_sync_error_code text,
  review_sync_error_message text,
  mapping_status text,
  connection_status text,
  verification_status text,
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
    ogp.review_average_rating,
    ogp.review_total_count,
    COALESCE(agg.cached_count, 0),
    COALESCE(agg.unanswered_count, 0),
    COALESCE(agg.rating_1, 0),
    COALESCE(agg.rating_2, 0),
    COALESCE(agg.rating_3, 0),
    COALESCE(agg.rating_4, 0),
    COALESCE(agg.rating_5, 0),
    ogp.review_last_synced_at,
    ogp.review_last_successful_sync_at,
    ogp.review_sync_error_code,
    ogp.review_sync_error_message,
    ogp.mapping_status,
    ogp.connection_status,
    ogp.verification_status,
    ogp.google_location_name,
    ogp.google_maps_url
  FROM public.office_google_profiles ogp
  LEFT JOIN (
    SELECT
      r.office_id,
      count(*) AS cached_count,
      count(*) FILTER (WHERE r.darb_reply_status = 'UNANSWERED') AS unanswered_count,
      count(*) FILTER (WHERE r.star_rating = 1) AS rating_1,
      count(*) FILTER (WHERE r.star_rating = 2) AS rating_2,
      count(*) FILTER (WHERE r.star_rating = 3) AS rating_3,
      count(*) FILTER (WHERE r.star_rating = 4) AS rating_4,
      count(*) FILTER (WHERE r.star_rating = 5) AS rating_5
    FROM public.google_business_reviews r
    WHERE r.visibility_state = 'ACTIVE'
    GROUP BY r.office_id
  ) agg ON agg.office_id = ogp.office_id
  WHERE ogp.office_id = p_office_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_office_google_review_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_office_google_review_summary(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Read RPC — one review + its DARB activity trail
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_office_google_review(
  p_office_id uuid,
  p_review_id uuid
)
RETURNS TABLE (
  id uuid,
  office_id uuid,
  google_review_id text,
  google_location_id text,
  reviewer_display_name text,
  reviewer_profile_photo_url text,
  reviewer_is_anonymous boolean,
  star_rating integer,
  comment text,
  review_create_time timestamptz,
  review_update_time timestamptz,
  reply_comment text,
  reply_update_time timestamptz,
  reply_state text,
  reply_policy_violation text,
  darb_reply_status text,
  visibility_state text,
  google_review_url text,
  last_synced_at timestamptz,
  activity jsonb
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

  SELECT r.office_id INTO v_office_id
  FROM public.google_business_reviews r WHERE r.id = p_review_id;

  IF v_office_id IS NULL THEN
    RETURN;
  END IF;

  IF v_office_id <> p_office_id THEN
    RAISE EXCEPTION 'Review does not belong to this office'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    r.id, r.office_id, r.google_review_id, r.google_location_id,
    r.reviewer_display_name, r.reviewer_profile_photo_url, r.reviewer_is_anonymous,
    r.star_rating, r.comment, r.review_create_time, r.review_update_time,
    r.reply_comment, r.reply_update_time, r.reply_state, r.reply_policy_violation,
    r.darb_reply_status, r.visibility_state, r.google_review_url, r.last_synced_at,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
          'action', a.action,
          'actor_role', a.actor_role,
          'actor_user_id', a.actor_user_id,
          'actor_name', p.full_name,
          'created_at', a.created_at
        ) ORDER BY a.created_at DESC)
       FROM public.google_business_activity a
       LEFT JOIN public.profiles p ON p.id = a.actor_user_id
       WHERE a.resource_type = 'review' AND a.resource_id = r.id::text),
      '[]'::jsonb
    )
  FROM public.google_business_reviews r
  WHERE r.id = p_review_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_office_google_review(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_office_google_review(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9. Notifications — new review -> Admin + this office's Primary + Side
--
-- Scoped deliberately: a Google review belongs to one location -> one office,
-- so the whole DARB team must not be notified. dedupe_key keeps a re-sync from
-- re-notifying the same review.
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
  v_recipient uuid;
BEGIN
  SELECT COALESCE(NULLIF(o.name_en, ''), o.name_ar, 'Office')
  INTO v_office_name
  FROM public.offices o WHERE o.id = p_office_id;

  -- This office's operators.
  FOR v_recipient IN
    SELECT ogo.team_member_id
    FROM public.office_google_operators ogo
    WHERE ogo.office_id = p_office_id
  LOOP
    PERFORM public.emit_notification(
      v_recipient, NULL, 'google_review',
      'New Google review',
      'تقييم جديد على Google',
      v_stars || ' ' || v_reviewer || ' left a new review for ' || v_office_name || '.',
      v_stars || ' ' || v_reviewer || ' ترك تقييماً جديداً لمكتب ' || v_office_name || '.',
      NULL, '/team/google/reviews',
      -- The recipient is part of the key: emit_notification's unique index is
      -- on dedupe_key alone, so a shared key would let only the first recipient
      -- win and silently drop everyone else.
      v_dedupe_prefix || ':' || v_recipient::text
    );
  END LOOP;

  -- Admins monitor every office.
  FOR v_recipient IN
    SELECT ur.user_id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'admin'::public.app_role
      AND p.deleted_at IS NULL AND p.deactivated_at IS NULL
  LOOP
    PERFORM public.emit_notification(
      v_recipient, NULL, 'google_review',
      'New Google review',
      'تقييم جديد على Google',
      v_stars || ' ' || v_reviewer || ' left a new review for ' || v_office_name || '.',
      v_stars || ' ' || v_reviewer || ' ترك تقييماً جديداً لمكتب ' || v_office_name || '.',
      NULL, '/team/google/reviews',
      v_dedupe_prefix || ':' || v_recipient::text
    );
  END LOOP;
END;
$fn$;

REVOKE ALL ON FUNCTION public.notify_new_google_review(uuid, uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_new_google_review(uuid, uuid, integer, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 10. Write RPC — persist a sync snapshot
--
-- Called by server code after Google's reviews.list succeeded. Upserts every
-- returned review, marks the office's other cached reviews as NOT_FOUND (never
-- deletes them), stores the authoritative summary, releases the lock and
-- notifies only on genuinely new reviews.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_sync_google_reviews(
  p_office_id uuid,
  p_reviews jsonb,
  p_average_rating numeric DEFAULT NULL,
  p_total_count integer DEFAULT NULL
)
RETURNS TABLE (inserted integer, updated integer, marked_not_found integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_location_id text;
  v_account_id text;
  v_item jsonb;
  v_review_id uuid;
  v_is_new boolean;
  v_before_status text;
  v_ins integer := 0;
  v_upd integer := 0;
  v_nf integer := 0;
  v_seen text[] := ARRAY[]::text[];
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_SYNC_REVIEWS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF jsonb_typeof(p_reviews) <> 'array' THEN
    RAISE EXCEPTION 'p_reviews must be a JSON array';
  END IF;

  -- The office mapping is the authority for which location these belong to.
  SELECT ogp.google_location_id, ogp.google_account_id
  INTO v_location_id, v_account_id
  FROM public.office_google_profiles ogp
  WHERE ogp.office_id = p_office_id
    AND ogp.mapping_status = 'MAPPED'
    AND ogp.google_location_id IS NOT NULL;

  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'Office has no mapped Google location';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_reviews)
  LOOP
    IF (v_item->>'google_review_id') IS NULL OR (v_item->>'google_review_id') = '' THEN
      CONTINUE;
    END IF;
    IF (v_item->>'star_rating') IS NULL THEN
      CONTINUE;
    END IF;
    v_seen := v_seen || (v_item->>'google_review_id');

    SELECT r.id, r.darb_reply_status
    INTO v_review_id, v_before_status
    FROM public.google_business_reviews r
    WHERE r.google_location_id = v_location_id
      AND r.google_review_id = v_item->>'google_review_id';

    v_is_new := v_review_id IS NULL;

    INSERT INTO public.google_business_reviews (
      office_id, google_account_id, google_location_id,
      google_review_id, google_review_resource_name,
      reviewer_display_name, reviewer_profile_photo_url, reviewer_is_anonymous,
      star_rating, comment, review_create_time, review_update_time,
      reply_comment, reply_update_time, reply_state, reply_policy_violation,
      darb_reply_status, visibility_state, google_review_url, last_synced_at
    )
    VALUES (
      p_office_id,
      COALESCE(v_item->>'google_account_id', v_account_id),
      v_location_id,
      v_item->>'google_review_id',
      COALESCE(v_item->>'google_review_resource_name',
               'accounts/' || COALESCE(v_account_id,'') || '/locations/' || v_location_id
               || '/reviews/' || (v_item->>'google_review_id')),
      v_item->>'reviewer_display_name',
      v_item->>'reviewer_profile_photo_url',
      COALESCE((v_item->>'reviewer_is_anonymous')::boolean, false),
      GREATEST(LEAST((v_item->>'star_rating')::integer, 5), 1),
      v_item->>'comment',
      NULLIF(v_item->>'review_create_time','')::timestamptz,
      NULLIF(v_item->>'review_update_time','')::timestamptz,
      v_item->>'reply_comment',
      NULLIF(v_item->>'reply_update_time','')::timestamptz,
      v_item->>'reply_state',
      v_item->>'reply_policy_violation',
      CASE
        WHEN v_item->>'reply_comment' IS NULL OR v_item->>'reply_comment' = '' THEN 'UNANSWERED'
        WHEN v_item->>'reply_state' = 'REJECTED' THEN 'REPLY_REJECTED'
        WHEN v_item->>'reply_state' = 'PENDING' THEN 'REPLY_PENDING'
        ELSE 'ANSWERED'
      END,
      'ACTIVE',
      v_item->>'google_review_url',
      now()
    )
    ON CONFLICT (google_location_id, google_review_id) DO UPDATE
    SET office_id = EXCLUDED.office_id,
        google_account_id = EXCLUDED.google_account_id,
        google_review_resource_name = EXCLUDED.google_review_resource_name,
        reviewer_display_name = EXCLUDED.reviewer_display_name,
        reviewer_profile_photo_url = EXCLUDED.reviewer_profile_photo_url,
        reviewer_is_anonymous = EXCLUDED.reviewer_is_anonymous,
        star_rating = EXCLUDED.star_rating,
        comment = EXCLUDED.comment,
        review_create_time = COALESCE(EXCLUDED.review_create_time, public.google_business_reviews.review_create_time),
        review_update_time = COALESCE(EXCLUDED.review_update_time, public.google_business_reviews.review_update_time),
        -- A reply Google now reports wins; otherwise keep DARB's optimistic
        -- REPLY_PENDING so a just-published reply is not erased by a sync that
        -- predates Google's propagation.
        reply_comment = CASE
          WHEN EXCLUDED.reply_comment IS NOT NULL AND EXCLUDED.reply_comment <> ''
            THEN EXCLUDED.reply_comment
          WHEN public.google_business_reviews.darb_reply_status = 'REPLY_PENDING'
            THEN public.google_business_reviews.reply_comment
          ELSE EXCLUDED.reply_comment END,
        reply_update_time = COALESCE(EXCLUDED.reply_update_time, public.google_business_reviews.reply_update_time),
        reply_state = COALESCE(EXCLUDED.reply_state, public.google_business_reviews.reply_state),
        reply_policy_violation = COALESCE(EXCLUDED.reply_policy_violation, public.google_business_reviews.reply_policy_violation),
        darb_reply_status = CASE
          WHEN EXCLUDED.reply_comment IS NOT NULL AND EXCLUDED.reply_comment <> '' THEN EXCLUDED.darb_reply_status
          WHEN public.google_business_reviews.darb_reply_status = 'REPLY_PENDING'
            THEN public.google_business_reviews.darb_reply_status
          ELSE EXCLUDED.darb_reply_status END,
        visibility_state = 'ACTIVE',
        google_review_url = COALESCE(EXCLUDED.google_review_url, public.google_business_reviews.google_review_url),
        last_synced_at = now(),
        updated_at = now()
    RETURNING id INTO v_review_id;

    IF v_is_new THEN
      v_ins := v_ins + 1;
      PERFORM public.notify_new_google_review(
        p_office_id, v_review_id,
        (v_item->>'star_rating')::integer,
        v_item->>'reviewer_display_name'
      );
    ELSE
      v_upd := v_upd + 1;
    END IF;
  END LOOP;

  -- Reviews this location previously had but Google no longer returns are
  -- marked unavailable, never deleted.
  UPDATE public.google_business_reviews r
  SET visibility_state = 'NOT_FOUND',
      updated_at = now()
  WHERE r.office_id = p_office_id
    AND r.google_location_id = v_location_id
    AND r.visibility_state = 'ACTIVE'
    AND NOT (r.google_review_id = ANY (v_seen));
  GET DIAGNOSTICS v_nf = ROW_COUNT;

  UPDATE public.office_google_profiles
  SET review_average_rating = COALESCE(p_average_rating, review_average_rating),
      review_total_count = COALESCE(p_total_count, review_total_count),
      review_last_synced_at = now(),
      review_last_successful_sync_at = now(),
      review_sync_error_code = NULL,
      review_sync_error_message = NULL,
      review_sync_locked_at = NULL,
      updated_at = now()
  WHERE office_id = p_office_id;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, resource_id, after_data
  )
  VALUES (
    p_office_id, v_location_id, v_actor,
    CASE WHEN public.is_admin_session() THEN 'admin' ELSE 'PRIMARY' END,
    'GOOGLE_REVIEW_SYNCED', 'review', NULL,
    jsonb_build_object('inserted', v_ins, 'updated', v_upd,
                       'marked_not_found', v_nf,
                       'average_rating', p_average_rating, 'total_count', p_total_count)
  );

  RETURN QUERY SELECT v_ins, v_upd, v_nf;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_sync_google_reviews(uuid, jsonb, numeric, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_sync_google_reviews(uuid, jsonb, numeric, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 11. Write RPC — record a sync failure
--
-- The failing sync rolls back its own audit insert, so this is a separate call
-- the server makes after the failure. Cached reviews are untouched.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_mark_google_review_sync_error(
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
    OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_SYNC_REVIEWS')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.office_google_profiles
  SET review_sync_error_code = left(COALESCE(p_error_code, 'error'), 64),
      review_sync_error_message = left(COALESCE(p_error_message, 'Sync failed'), 500),
      review_sync_locked_at = NULL,
      updated_at = now()
  WHERE office_id = p_office_id;

  INSERT INTO public.google_business_activity (
    office_id, actor_user_id, actor_role, action, resource_type, after_data
  )
  VALUES (
    p_office_id, v_actor,
    CASE WHEN public.is_admin_session() THEN 'admin' ELSE 'PRIMARY' END,
    'GOOGLE_REVIEW_ACTION_FAILED', 'review',
    jsonb_build_object('operation', 'sync',
                       'code', left(COALESCE(p_error_code,'error'), 64),
                       'message', left(COALESCE(p_error_message,'Sync failed'), 500))
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_mark_google_review_sync_error(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_google_review_sync_error(uuid, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 12. Write RPC — persist the result of a Google reply operation
--
-- This runs only AFTER Google accepted (or rejected) the write. It re-resolves
-- ownership, re-checks the 4096-byte Google limit server-side, and writes the
-- audit event. `p_action` is the DARB action, not a client-supplied role.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_apply_google_review_reply(
  p_office_id uuid,
  p_review_id uuid,
  p_action text,
  p_reply_comment text DEFAULT NULL,
  p_google_reply_state text DEFAULT NULL,
  p_policy_violation text DEFAULT NULL,
  p_google_status integer DEFAULT NULL
)
RETURNS TABLE (darb_reply_status text, reply_comment text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_office_id uuid;
  v_before text;
  v_new_status text;
  v_audit_action text;
BEGIN
  IF p_action NOT IN ('CREATED','UPDATED','DELETED') THEN
    RAISE EXCEPTION 'Invalid reply action';
  END IF;

  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_REPLY_REVIEW')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Google's limit is 4096 BYTES, not characters. Arabic/emoji cost more than
  -- one byte each, so octet_length is the correct measure. Re-checked here so a
  -- forged client cannot exceed it.
  IF p_action IN ('CREATED','UPDATED')
     AND octet_length(COALESCE(p_reply_comment, '')) > 4096 THEN
    RAISE EXCEPTION 'Reply exceeds Google''s 4096-byte limit'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_action IN ('CREATED','UPDATED')
     AND NULLIF(btrim(COALESCE(p_reply_comment, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Reply cannot be empty' USING ERRCODE = 'check_violation';
  END IF;

  SELECT r.office_id, r.reply_comment
  INTO v_office_id, v_before
  FROM public.google_business_reviews r
  WHERE r.id = p_review_id
  FOR UPDATE;

  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'Review not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_office_id <> p_office_id THEN
    RAISE EXCEPTION 'Review does not belong to this office'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_action = 'DELETED' THEN
    v_new_status := 'UNANSWERED';
    v_audit_action := 'GOOGLE_REVIEW_REPLY_DELETED';
    UPDATE public.google_business_reviews
    SET reply_comment = NULL,
        reply_update_time = NULL,
        reply_state = NULL,
        reply_policy_violation = NULL,
        darb_reply_status = v_new_status,
        updated_at = now()
    WHERE id = p_review_id;
  ELSIF p_google_reply_state = 'REJECTED' THEN
    -- Google rejected it: keep the text so the operator can edit and retry, but
    -- never present it as published.
    v_new_status := 'REPLY_REJECTED';
    v_audit_action := CASE WHEN p_action = 'CREATED'
      THEN 'GOOGLE_REVIEW_REPLY_CREATED' ELSE 'GOOGLE_REVIEW_REPLY_UPDATED' END;
    UPDATE public.google_business_reviews
    SET reply_comment = p_reply_comment,
        reply_update_time = now(),
        reply_state = COALESCE(p_google_reply_state, reply_state),
        reply_policy_violation = p_policy_violation,
        darb_reply_status = v_new_status,
        updated_at = now()
    WHERE id = p_review_id;
  ELSE
    -- Accepted. Google may still hold it for moderation (minutes to days), so
    -- the operator sees "pending Google review" until a later sync confirms.
    v_new_status := CASE WHEN p_google_reply_state = 'PENDING'
      THEN 'REPLY_PENDING' ELSE 'ANSWERED' END;
    v_audit_action := CASE WHEN p_action = 'CREATED'
      THEN 'GOOGLE_REVIEW_REPLY_CREATED' ELSE 'GOOGLE_REVIEW_REPLY_UPDATED' END;
    UPDATE public.google_business_reviews
    SET reply_comment = p_reply_comment,
        reply_update_time = now(),
        reply_state = COALESCE(p_google_reply_state, reply_state),
        reply_policy_violation = NULL,
        darb_reply_status = v_new_status,
        updated_at = now()
    WHERE id = p_review_id;
  END IF;

  INSERT INTO public.google_business_activity (
    office_id, actor_user_id, actor_role, action, resource_type, resource_id,
    before_data, after_data
  )
  VALUES (
    p_office_id, v_actor,
    CASE WHEN public.is_admin_session() THEN 'admin' ELSE 'PRIMARY' END,
    v_audit_action, 'review', p_review_id::text,
    -- Compact: lengths + state, not the full customer text duplicated in logs.
    jsonb_build_object('had_reply', v_before IS NOT NULL,
                       'reply_bytes', octet_length(COALESCE(v_before, ''))),
    jsonb_build_object('darb_reply_status', v_new_status,
                       'google_reply_state', p_google_reply_state,
                       'google_status', p_google_status,
                       'reply_bytes', octet_length(COALESCE(p_reply_comment, '')))
  );

  RETURN QUERY
  SELECT r.darb_reply_status, r.reply_comment
  FROM public.google_business_reviews r WHERE r.id = p_review_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_apply_google_review_reply(uuid, uuid, text, text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_apply_google_review_reply(uuid, uuid, text, text, text, text, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 13. Row Level Security + privileges
--
-- Same shape as Phase 1: reads inherit the office's access rules, writes are
-- RPC-only. No browser role holds INSERT/UPDATE/DELETE on the review cache, so
-- a direct write cannot forge a reply.
-- ---------------------------------------------------------------------------

ALTER TABLE public.google_business_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Office members read google reviews" ON public.google_business_reviews;
CREATE POLICY "Office members read google reviews"
ON public.google_business_reviews FOR SELECT TO authenticated
USING (
  public.is_admin_session()
  OR EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.office_id = google_business_reviews.office_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
  )
);

REVOKE ALL ON public.google_business_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.google_business_reviews TO authenticated;
GRANT ALL ON public.google_business_reviews TO service_role;

-- ---------------------------------------------------------------------------
-- 14. Verification queries (manual, for the deploy checklist)
-- ---------------------------------------------------------------------------
-- A) Cross-office: SELECT public.get_office_google_review(:berlin, :hamburg_review)
--    -> must raise 'Review does not belong to this office'.
-- B) Size: admin_apply_google_review_reply(... p_reply_comment => repeat('a',4097))
--    -> must raise the 4096-byte error.
-- C) Sync lock: two concurrent acquire_google_review_sync_lock(:berlin) calls
--    -> exactly one returns true.
-- ===========================================================================
