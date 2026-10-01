-- ===========================================================================
-- PHASE 4 — Primary + Side Manager Delegation
--
-- Turns the Google connection from "Admin connected a location" into "the
-- correct DARB people can operate that location". No Google write happens here;
-- this phase only decides WHO is allowed to operate an office's Google
-- presence.
--
-- What this migration adds (Phase 1 already shipped the operator table, the
-- one-PRIMARY / one-SIDE_MANAGER indexes, the same-office/active trigger and
-- the assign/remove RPCs):
--   1. Two finer-grained actions: GOOGLE_MANAGE_SUPPORTED_CONTENT (Primary and
--      Side) and GOOGLE_REMOVE_SIDE_MANAGER (Primary and Admin only).
--   2. remove_google_operator() now authorizes SIDE_MANAGER removal with the
--      dedicated action instead of borrowing GOOGLE_ASSIGN_SIDE_MANAGER.
--   3. Operator changes emit DARB notifications to the affected member.
--   4. A deferred transfer guard: moving a Google operator to another office
--      (while they remain an active team member) is blocked, so an office can
--      never be orphaned. Deactivation stays allowed — the assignment remains
--      for history but authorization fails immediately.
--   5. list_my_google_offices(): the office-scoped surface for Primary / Side.
--
-- Timestamp is newer than 20261001170000 (Phase 3) so this authorizer
-- definition wins on a fresh deploy.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Authorizer — add the Phase 4 actions
--
-- Redefines the Phase 3 function: same body, plus
--   * GOOGLE_MANAGE_SUPPORTED_CONTENT -> shared operational (Primary + Side)
--   * GOOGLE_REMOVE_SIDE_MANAGER      -> delegation (Primary + Admin only)
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
    -- Phase 4 operational
    'GOOGLE_MANAGE_SUPPORTED_CONTENT',
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

  -- Background/service callers (Edge Functions) act as the system. Browser
  -- roles can never present the service_role JWT.
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  -- A browser caller may only ask about their own access; otherwise this
  -- function would be an oracle for another user's office membership.
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  -- Admin may do everything, but only with a full admin session (admin role
  -- AND AAL2 MFA) and only for a real, non-deleted office.
  IF public.is_admin_session() THEN
    RETURN EXISTS (
      SELECT 1 FROM public.offices o
      WHERE o.id = p_office_id AND o.deleted_at IS NULL
    );
  END IF;

  -- Every non-admin action requires live, active membership of this office.
  -- This is what revokes a deactivated member's access immediately: their
  -- office_members row is deactivated, so membership fails here.
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

  -- Admin-only actions: never granted to a PRIMARY or SIDE_MANAGER.
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

  -- Delegation: only the PRIMARY (or Admin above) may appoint or remove the
  -- Side Manager. A Side Manager can never delegate.
  IF p_action IN ('GOOGLE_ASSIGN_SIDE_MANAGER','GOOGLE_REMOVE_SIDE_MANAGER') THEN
    RETURN v_operator_role = 'PRIMARY';
  END IF;

  -- Shared operational actions: PRIMARY or SIDE_MANAGER.
  RETURN COALESCE(v_operator_role IN ('PRIMARY','SIDE_MANAGER'), false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.authorize_google_office_action(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_google_office_action(uuid, uuid, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. remove_google_operator — use the dedicated removal action
--
-- Phase 1 authorized SIDE_MANAGER removal with GOOGLE_ASSIGN_SIDE_MANAGER.
-- Phase 4 splits it so a future narrowing of one action cannot silently widen
-- the other. PRIMARY removal stays Admin-only.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.remove_google_operator(
  p_office_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_action text;
BEGIN
  IF p_role NOT IN ('PRIMARY','SIDE_MANAGER') THEN
    RAISE EXCEPTION 'Invalid operator role';
  END IF;

  IF p_role = 'PRIMARY' THEN
    IF NOT public.is_admin_session() THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
    v_action := 'ADMIN_REMOVED_PRIMARY';
  ELSE
    IF NOT public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_REMOVE_SIDE_MANAGER') THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
    v_action := 'SIDE_MANAGER_REMOVED';
  END IF;

  SELECT to_jsonb(ogo.*) INTO v_before
  FROM public.office_google_operators ogo
  WHERE ogo.office_id = p_office_id AND ogo.role = p_role;

  IF v_before IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.office_google_operators
  WHERE office_id = p_office_id AND role = p_role;

  INSERT INTO public.google_business_activity (
    office_id, actor_user_id,
    actor_role,
    action, resource_type, resource_id, before_data
  )
  VALUES (
    p_office_id, v_actor,
    CASE WHEN public.is_admin_session() THEN 'admin' ELSE 'PRIMARY' END,
    v_action, 'office_google_operator', (v_before->>'id'), v_before
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.remove_google_operator(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_google_operator(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Notifications — tell the affected member about their Google assignment
--
-- Fires on every operator INSERT/DELETE/reassignment. Never notifies the actor
-- about their own action (emit_notification skips self-notifications).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_google_operator_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_office_name text;
  v_actor uuid := auth.uid();
  v_office_id uuid := COALESCE(NEW.office_id, OLD.office_id);
BEGIN
  SELECT COALESCE(NULLIF(o.name_en, ''), o.name_ar, 'Office')
  INTO v_office_name
  FROM public.offices o
  WHERE o.id = v_office_id;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'PRIMARY' THEN
      PERFORM public.emit_notification(
        NEW.team_member_id, v_actor, 'google_business',
        'You are now the Primary Google Operator',
        'أنت الآن المشرف الأساسي على Google',
        'You are now the Primary Google Operator for ' || v_office_name || ' office.',
        'أنت الآن المشرف الأساسي على حساب Google لمكتب ' || v_office_name || '.',
        NULL, '/team/google', NULL
      );
    ELSE
      PERFORM public.emit_notification(
        NEW.team_member_id, v_actor, 'google_business',
        'You were assigned as Side Manager',
        'تم تعيينك مديراً مساعداً',
        'You were assigned as Side Manager for ' || v_office_name || ' office.',
        'تم تعيينك مديراً مساعداً لحساب Google لمكتب ' || v_office_name || '.',
        NULL, '/team/google', NULL
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.emit_notification(
      OLD.team_member_id, v_actor, 'google_business',
      'Google Business access removed',
      'تم إلغاء صلاحية Google',
      'Your Google Business access for ' || v_office_name || ' office has been removed.',
      'تم إلغاء صلاحيتك على حساب Google لمكتب ' || v_office_name || '.',
      NULL, '/team/google', NULL
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.team_member_id IS DISTINCT FROM OLD.team_member_id THEN
    PERFORM public.emit_notification(
      OLD.team_member_id, v_actor, 'google_business',
      'Google Business access removed',
      'تم إلغاء صلاحية Google',
      'Your Google Business access for ' || v_office_name || ' office has been removed.',
      'تم إلغاء صلاحيتك على حساب Google لمكتب ' || v_office_name || '.',
      NULL, '/team/google', NULL
    );
    PERFORM public.emit_notification(
      NEW.team_member_id, v_actor, 'google_business',
      CASE WHEN NEW.role = 'PRIMARY'
        THEN 'You are now the Primary Google Operator'
        ELSE 'You were assigned as Side Manager' END,
      CASE WHEN NEW.role = 'PRIMARY'
        THEN 'أنت الآن المشرف الأساسي على Google'
        ELSE 'تم تعيينك مديراً مساعداً' END,
      'You are now a Google operator for ' || v_office_name || ' office.',
      'أنت الآن مشرف على حساب Google لمكتب ' || v_office_name || '.',
      NULL, '/team/google', NULL
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$fn$;

REVOKE ALL ON FUNCTION public.notify_google_operator_event() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_google_operator_event() TO service_role;

DROP TRIGGER IF EXISTS trg_notify_google_operator_event ON public.office_google_operators;
CREATE TRIGGER trg_notify_google_operator_event
AFTER INSERT OR UPDATE OR DELETE ON public.office_google_operators
FOR EACH ROW EXECUTE FUNCTION public.notify_google_operator_event();

-- ---------------------------------------------------------------------------
-- 4. Transfer guard — an office can never be orphaned
--
-- Deferred CONSTRAINT trigger on office_members. At commit time, if a Google
-- operator's office membership is no longer active BUT the person is still an
-- active team member, the change is a *transfer* and is blocked (RULE: assign
-- another Primary before moving them).
--
-- Plain deactivation (profile deactivated / role removed) is allowed: the
-- person is no longer an active team member, so is_active_team_member() is
-- false and this guard stays silent. The assignment row remains for history,
-- and authorization already fails (see the authorizer's membership check).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_google_operator_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_orphan record;
BEGIN
  FOR v_orphan IN
    SELECT ogo.office_id, ogo.team_member_id, ogo.role
    FROM public.office_google_operators ogo
    WHERE NOT EXISTS (
      SELECT 1 FROM public.office_members om
      WHERE om.office_id = ogo.office_id
        AND om.user_id = ogo.team_member_id
        AND om.is_active = true
    )
    -- Still an active team member somewhere => transfer, not deactivation.
    AND public.is_active_team_member(ogo.team_member_id)
  LOOP
    RAISE EXCEPTION
      'Cannot move a Google operator to another office until their Google assignment is resolved (office %, role %)',
      v_orphan.office_id, v_orphan.role
      USING ERRCODE = 'check_violation';
  END LOOP;

  RETURN NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.guard_google_operator_transfer() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_google_operator_transfer() TO service_role;

DROP TRIGGER IF EXISTS trg_guard_google_operator_transfer ON public.office_members;
CREATE CONSTRAINT TRIGGER trg_guard_google_operator_transfer
AFTER INSERT OR UPDATE OR DELETE ON public.office_members
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.guard_google_operator_transfer();

-- ---------------------------------------------------------------------------
-- 5. Read RPC — the caller's own Google offices (Primary / Side surface)
--
-- Office-scoped: returns only offices where the caller currently holds an
-- operator role AND is an active team member. A deactivated member gets no
-- rows, so their dashboard goes empty immediately. Admin is not special-cased
-- here — Admin uses the admin surface.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_my_google_offices()
RETURNS TABLE (
  office_id uuid,
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

-- ---------------------------------------------------------------------------
-- 6. Notification category mapping — recognise the google_business source
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 8. Operator-active flags on the office mapping read
--
-- The Office page must show "⚠ Inactive" next to an operator whose team member
-- was deactivated. The assignment row stays for history, but the UI needs to
-- know the person is no longer live. Redefines the Phase 3 function with the
-- same signature plus two booleans at the end.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_office_google_mapping(uuid);

CREATE FUNCTION public.get_office_google_mapping(p_office_id uuid)
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
    -- "active" here means: still an active team member AND still active in this
    -- office. That is exactly what the authorizer requires for access.
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
-- 9. Read RPC — eligible operators for an office (server-filtered)
--
-- The Primary/Side assignment selector must only ever contain active team
-- members of THIS office. The filter lives here, not in the browser, so a
-- forged client call cannot surface another office's staff.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_office_google_operator_candidates(p_office_id uuid)
RETURNS TABLE (
  team_member_id uuid,
  full_name text,
  operator_role text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT (
    public.is_admin_session()
    OR public.authorize_google_office_action(auth.uid(), p_office_id, 'GOOGLE_ASSIGN_SIDE_MANAGER')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    om.user_id,
    p.full_name,
    ogo.role AS operator_role
  FROM public.office_members om
  JOIN public.profiles p ON p.id = om.user_id
  LEFT JOIN public.office_google_operators ogo
    ON ogo.office_id = om.office_id AND ogo.team_member_id = om.user_id
  WHERE om.office_id = p_office_id
    AND om.is_active = true
    AND public.is_active_team_member(om.user_id)
  ORDER BY p.full_name;
END;
$fn$;

REVOKE ALL ON FUNCTION public.list_office_google_operator_candidates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_office_google_operator_candidates(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 10. Verification queries (manual, for the deploy checklist)
-- ---------------------------------------------------------------------------
-- A) Side manager cannot delegate:
--    SET ROLE authenticated; SELECT public.assign_google_side_manager(:berlin, :daniel);
--    -> must raise Forbidden when the caller is the Side Manager.
-- B) Transfer guard: move the Berlin Primary to Hamburg -> must raise
--    'Cannot move a Google operator to another office ...'.
-- C) Deactivation: deactivate the Primary's profile -> allowed; then any
--    authorize_google_office_action(...) for them returns false.
-- ===========================================================================
