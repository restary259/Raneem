-- ---------------------------------------------------------------------------
-- Google location sync: preserve connection ownership
--
-- Discovery called admin_sync_google_locations with p_connection_id = NULL, so
-- every cached google_business_locations row lost its google_connection_id even
-- though it came from a real DARB Google connection. Resolve the active
-- connection inside the function when the caller does not name one.
--
-- The parameter list is unchanged (no new overload); only the body resolves NULL.
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
  v_connection_id uuid := p_connection_id;
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

  -- Prefer the most recent connected connection, else the most recent row, so
  -- ownership is preserved even before a connection is explicitly marked
  -- connected. Mirrors admin_update_google_connection's single-connection model.
  IF v_connection_id IS NULL THEN
    SELECT id INTO v_connection_id
    FROM public.google_business_connections
    WHERE provider = 'google_business_profile'
    ORDER BY (connection_status = 'connected') DESC, created_at DESC
    LIMIT 1;
  END IF;

  INSERT INTO public.google_business_locations AS l (
    google_connection_id, google_account_id, google_location_id,
    google_location_resource_name, store_code, location_name,
    primary_category, address_json, phone, website_url, place_id, maps_url,
    verification_state, location_state, raw_location_json,
    first_seen_at, last_seen_at, updated_at
  )
  SELECT
    v_connection_id,
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
    jsonb_build_object('count', v_count, 'connection_id', v_connection_id)
  );

  RETURN v_count;
END;
$fn$;
