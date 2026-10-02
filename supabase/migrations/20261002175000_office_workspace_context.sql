-- Office workspace context RPC.
--
-- The office workspace header (admin and team) needs one office identity plus
-- its team assignment and Google health without the caller stitching together
-- offices + office_members + profiles + office_google_profiles by hand. This
-- function is the single server-side authorization check every office route
-- reuses: the caller must be an admin or an active member of *that* office.

CREATE OR REPLACE FUNCTION public.get_office_workspace(p_office_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_is_admin boolean := public.is_admin_session();
  v_is_member boolean;
  v_office public.offices;
  v_primary_id uuid;
  v_primary_name text;
  v_side_id uuid;
  v_side_name text;
  v_ogp public.office_google_profiles;
  v_member_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_office
  FROM public.offices o
  WHERE o.id = p_office_id AND o.deleted_at IS NULL;

  IF v_office.id IS NULL THEN
    RAISE EXCEPTION 'Office not found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.office_members om
    WHERE om.office_id = p_office_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
  ) INTO v_is_member;

  IF NOT (v_is_admin OR v_is_member) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT count(*) INTO v_member_count
  FROM public.office_members om
  WHERE om.office_id = p_office_id AND om.is_active = true;

  SELECT om.user_id, p.full_name
  INTO v_primary_id, v_primary_name
  FROM public.office_members om
  LEFT JOIN public.profiles p ON p.id = om.user_id
  WHERE om.office_id = p_office_id
    AND om.is_active = true
    AND (om.is_primary = true OR om.membership_type = 'owner')
  ORDER BY om.is_primary DESC, om.priority ASC
  LIMIT 1;

  SELECT om.user_id, p.full_name
  INTO v_side_id, v_side_name
  FROM public.office_members om
  LEFT JOIN public.profiles p ON p.id = om.user_id
  WHERE om.office_id = p_office_id
    AND om.is_active = true
    AND om.membership_type IN ('operator', 'backup', 'staff')
    AND om.user_id IS DISTINCT FROM v_primary_id
  ORDER BY om.priority ASC
  LIMIT 1;

  IF v_is_admin THEN
    SELECT * INTO v_ogp FROM public.office_google_profiles WHERE office_id = p_office_id;
  ELSE
    SELECT * INTO v_ogp
    FROM public.office_google_profiles ogp
    WHERE ogp.office_id = p_office_id
      AND public.authorize_google_office_action(
        auth.uid(), ogp.office_id, 'GOOGLE_VIEW'
      );
  END IF;

  RETURN jsonb_build_object(
    'office', jsonb_build_object(
      'id', v_office.id,
      'slug', v_office.slug,
      'name', COALESCE(NULLIF(v_office.name_en, ''), v_office.name_ar),
      'name_ar', v_office.name_ar,
      'name_he', v_office.name_he,
      'country', v_office.country,
      'city', v_office.city,
      'address_line_1', v_office.address_line_1,
      'phone', v_office.phone,
      'email', v_office.email,
      'map_url', v_office.map_url,
      'timezone', v_office.timezone,
      'is_active', v_office.is_active,
      'booking_enabled', v_office.booking_enabled
    ),
    'membership', jsonb_build_object(
      'is_admin', v_is_admin,
      'is_member', v_is_member,
      'member_count', v_member_count
    ),
    'team', jsonb_build_object(
      'primary_id', v_primary_id,
      'primary_name', v_primary_name,
      'side_id', v_side_id,
      'side_name', v_side_name
    ),
    'google', CASE
      WHEN v_ogp.office_id IS NULL THEN jsonb_build_object('connected', false)
      ELSE jsonb_build_object(
        'connected', true,
        'mapping_status', v_ogp.mapping_status,
        'connection_status', v_ogp.connection_status,
        'google_location_name', v_ogp.google_location_name,
        'google_maps_url', v_ogp.google_maps_url
      )
    END
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_office_workspace(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_office_workspace(uuid) TO authenticated, service_role;

-- The office list for the team workspace (`/team/offices`). Admins see every
-- active office; members see only offices they belong to.
CREATE OR REPLACE FUNCTION public.list_my_offices()
RETURNS TABLE (
  office_id uuid,
  slug text,
  name text,
  city text,
  country text,
  timezone text,
  is_active boolean,
  booking_enabled boolean,
  map_url text,
  primary_name text,
  member_count integer,
  google_connected boolean
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
      o.id,
      o.slug,
      COALESCE(NULLIF(o.name_en, ''), o.name_ar),
      o.city,
      o.country,
      o.timezone,
      o.is_active,
      o.booking_enabled,
      o.map_url,
      COALESCE(pr.full_name, pr2.full_name),
      (SELECT count(*)::integer FROM public.office_members om
        WHERE om.office_id = o.id AND om.is_active = true),
      (ogp.office_id IS NOT NULL AND ogp.mapping_status = 'MAPPED')
    FROM public.offices o
    LEFT JOIN public.office_google_profiles ogp ON ogp.office_id = o.id
    LEFT JOIN LATERAL (
      SELECT p.full_name FROM public.office_members om
      LEFT JOIN public.profiles p ON p.id = om.user_id
      WHERE om.office_id = o.id AND om.is_active = true
        AND (om.is_primary = true OR om.membership_type = 'owner')
      ORDER BY om.is_primary DESC, om.priority ASC LIMIT 1
    ) pr ON true
    LEFT JOIN LATERAL (
      SELECT p.full_name FROM public.office_members om
      LEFT JOIN public.profiles p ON p.id = om.user_id
      WHERE om.office_id = o.id AND om.is_active = true
        AND om.membership_type IN ('operator','backup','staff')
      ORDER BY om.priority ASC LIMIT 1
    ) pr2 ON true
    WHERE o.deleted_at IS NULL
    ORDER BY o.display_order, o.name_en;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.slug,
    COALESCE(NULLIF(o.name_en, ''), o.name_ar),
    o.city,
    o.country,
    o.timezone,
    o.is_active,
    o.booking_enabled,
    o.map_url,
    pr.full_name,
    (SELECT count(*)::integer FROM public.office_members om
      WHERE om.office_id = o.id AND om.is_active = true),
    (ogp.office_id IS NOT NULL AND ogp.mapping_status = 'MAPPED')
  FROM public.office_members me
  JOIN public.offices o ON o.id = me.office_id AND o.deleted_at IS NULL
  LEFT JOIN public.office_google_profiles ogp ON ogp.office_id = o.id
  LEFT JOIN LATERAL (
    SELECT p.full_name FROM public.office_members om
    LEFT JOIN public.profiles p ON p.id = om.user_id
    WHERE om.office_id = o.id AND om.is_active = true
      AND (om.is_primary = true OR om.membership_type = 'owner')
    ORDER BY om.is_primary DESC, om.priority ASC LIMIT 1
  ) pr ON true
  WHERE me.user_id = auth.uid() AND me.is_active = true
  ORDER BY o.display_order, o.name_en;
END;
$fn$;

REVOKE ALL ON FUNCTION public.list_my_offices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_offices() TO authenticated, service_role;

-- The office team roster (admin-or-member gated, same check as the workspace).
CREATE OR REPLACE FUNCTION public.get_office_team(p_office_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  membership_type text,
  is_primary boolean,
  is_active boolean,
  priority integer
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
  SELECT
    om.user_id,
    p.full_name,
    om.membership_type,
    om.is_primary,
    om.is_active,
    om.priority
  FROM public.office_members om
  LEFT JOIN public.profiles p ON p.id = om.user_id
  WHERE om.office_id = p_office_id
  ORDER BY om.is_active DESC, om.is_primary DESC, om.priority ASC;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_office_team(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_office_team(uuid) TO authenticated, service_role;
