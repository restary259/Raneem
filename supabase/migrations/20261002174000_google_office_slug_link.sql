-- Expose the office slug alongside the Google office list.
--
-- The office workspace deep-links Google Business under `/team/offices/<slug>/google/…`
-- and `/admin/offices/<slug>/google/…`. The Google pages resolve their office
-- from that slug, so the list RPC that feeds their office switcher needs to
-- return the slug too.

CREATE OR REPLACE FUNCTION public.list_my_google_offices()
RETURNS TABLE (
  office_id uuid,
  office_slug text,
  office_name text,
  operator_role text,
  mapping_status text,
  connection_status text,
  google_location_name text,
  google_maps_url text,
  primary_operator_id uuid,
  primary_operator_name text,
  side_manager_id uuid,
  side_manager_name text,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_team_member(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.slug,
    COALESCE(NULLIF(o.name_en, ''), o.name_ar),
    ogo.role,
    ogp.mapping_status,
    ogp.connection_status,
    ogp.google_location_name,
    ogp.google_maps_url,
    primary_op.team_member_id,
    primary_profile.full_name,
    side_op.team_member_id,
    side_profile.full_name,
    COALESCE(ogp.updated_at, ogo.updated_at)
  FROM public.office_google_operators ogo
  JOIN public.offices o
    ON o.id = ogo.office_id AND o.deleted_at IS NULL
  LEFT JOIN public.office_google_profiles ogp ON ogp.office_id = ogo.office_id
  LEFT JOIN public.office_google_operators primary_op
    ON primary_op.office_id = ogo.office_id AND primary_op.role = 'PRIMARY'
  LEFT JOIN public.profiles primary_profile ON primary_profile.id = primary_op.team_member_id
  LEFT JOIN public.office_google_operators side_op
    ON side_op.office_id = ogo.office_id AND side_op.role = 'SIDE_MANAGER'
  LEFT JOIN public.profiles side_profile ON side_profile.id = side_op.team_member_id
  WHERE ogo.team_member_id = auth.uid()
  ORDER BY o.name_en;
END;
$fn$;

REVOKE ALL ON FUNCTION public.list_my_google_offices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_google_offices() TO authenticated, service_role;

-- Same slug addition for the Insights office selector.
CREATE OR REPLACE FUNCTION public.list_google_performance_offices()
RETURNS TABLE (
  office_id uuid,
  office_slug text,
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
      o.slug,
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
    o.slug,
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

-- Resolve an office slug to its id for the workspace routes. Read-only and
-- scoped to active offices; the UI still relies on RLS for the actual data, so
-- this is a lookup helper, not an authorization bypass.
CREATE OR REPLACE FUNCTION public.resolve_office_slug(p_slug text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT o.id
  FROM public.offices o
  WHERE o.slug = lower(btrim(p_slug))
    AND o.deleted_at IS NULL
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public.resolve_office_slug(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_office_slug(text) TO authenticated, service_role;
