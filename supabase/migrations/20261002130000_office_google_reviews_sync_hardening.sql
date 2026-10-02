-- Phase 5 sync hardening (Aikido follow-up): admin_sync_google_reviews was
-- GRANTed to `authenticated`, so any logged-in user could call it directly with
-- a forged review snapshot and forge review rows / NOT_FOUND sweeps. It now
-- follows the same trust boundary as the Phase 7 sync RPCs: service-role only,
-- with the authenticated actor passed explicitly and authorized against that
-- actor. An incomplete pagination walk must not drive the NOT_FOUND sweep.
--
-- The signature changes, so the old overload is dropped to avoid leaving a
-- permissive (uuid, jsonb, numeric, integer) variant in place.
--
-- MANUAL DEPLOY: run after 20261002120000_office_google_media_posts.sql.

DROP FUNCTION IF EXISTS public.admin_sync_google_reviews(uuid, jsonb, numeric, integer);

CREATE OR REPLACE FUNCTION public.admin_sync_google_reviews(
  p_office_id uuid,
  p_reviews jsonb,
  p_average_rating numeric DEFAULT NULL,
  p_total_count integer DEFAULT NULL,
  -- False when the caller's pagination walk was capped with a token remaining.
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
  v_review_id uuid;
  v_is_new boolean;
  v_before_status text;
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

  IF NOT public.google_actor_can(p_office_id, v_actor, 'GOOGLE_SYNC_REVIEWS') THEN
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
  -- marked unavailable, never deleted. Only a COMPLETE walk may drive this
  -- sweep: a capped prefix would mark live reviews as gone.
  IF COALESCE(p_complete, true) THEN
    UPDATE public.google_business_reviews r
    SET visibility_state = 'NOT_FOUND',
        updated_at = now()
    WHERE r.office_id = p_office_id
      AND r.google_location_id = v_location_id
      AND r.visibility_state = 'ACTIVE'
      AND NOT (r.google_review_id = ANY (v_seen));
    GET DIAGNOSTICS v_nf = ROW_COUNT;
  END IF;

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
    COALESCE(public.google_actor_role(p_office_id, v_actor), 'PRIMARY'),
    'GOOGLE_REVIEW_SYNCED', 'review', NULL,
    jsonb_build_object('inserted', v_ins, 'updated', v_upd,
                       'marked_not_found', v_nf,
                       'average_rating', p_average_rating, 'total_count', p_total_count)
  );

  RETURN QUERY SELECT v_ins, v_upd, v_nf;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_sync_google_reviews(uuid, jsonb, numeric, integer, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sync_google_reviews(uuid, jsonb, numeric, integer, boolean, uuid) TO service_role;
