-- Phase 6 follow-up: let the requester (or an office operator / Admin) cancel
-- their own still-pending high-risk change request.
--
-- Why this exists: `google_profile_change_requests_one_pending_idx` allows at
-- most one PENDING request per (office, field). Before this RPC, only an Admin
-- could decide a request, so a member who submitted one — and then changed
-- their mind — left the field locked against everyone until an Admin happened
-- to triage it. Cancelling flips the row to CANCELLED, which drops it out of
-- the partial index and frees the field for a fresh request immediately.
--
-- Scope: PENDING -> CANCELLED only. Approval / rejection stays Admin-only
-- (`decide_google_profile_change_request`); this RPC never publishes anything
-- to Google, so it needs no connector credentials.

CREATE OR REPLACE FUNCTION public.cancel_google_profile_change_request(
  p_office_id uuid,
  p_request_id uuid
)
RETURNS TABLE (id uuid, status text, field text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
#variable_conflict use_column
DECLARE
  v_actor uuid := auth.uid();
  v_req public.google_profile_change_requests%ROWTYPE;
  v_role text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Lock the row so a concurrent decide/cancel cannot race on the status check.
  SELECT * INTO v_req
  FROM public.google_profile_change_requests
  WHERE id = p_request_id AND office_id = p_office_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Change request not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_req.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Only a pending change request can be cancelled'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Who may cancel: the requester themselves, an Admin session, or an operator
  -- of the office (PRIMARY / SIDE_MANAGER) whose queue it is.
  SELECT ogo.role INTO v_role
  FROM public.office_google_operators ogo
  WHERE ogo.office_id = p_office_id AND ogo.team_member_id = v_actor;

  IF NOT (
    public.is_admin_session()
    OR v_req.requested_by = v_actor
    OR public.authorize_google_office_action(v_actor, p_office_id, 'GOOGLE_REQUEST_HIGH_RISK')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.google_profile_change_requests
  SET status = 'CANCELLED',
      decided_by = v_actor,
      decided_at = now(),
      decision_note = 'Cancelled by requester',
      updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.google_business_activity (
    office_id, google_location_id, actor_user_id, actor_role,
    action, resource_type, resource_id, after_data
  )
  VALUES (
    p_office_id, v_req.google_location_id, v_actor,
    CASE WHEN public.is_admin_session() THEN 'admin' ELSE COALESCE(v_role, 'system') END,
    'GOOGLE_PROFILE_CHANGE_CANCELLED', 'change_request', p_request_id::text,
    jsonb_build_object('field', v_req.field, 'reason', 'cancelled_by_requester')
  );

  -- Tell the Admins the queue item is gone so nobody opens a stale request.
  PERFORM public.emit_notification(
    admins.admin_id, NULL, 'google_business',
    'Google profile change cancelled',
    'تم إلغاء تعديل ملف Google',
    'A pending Google profile change was cancelled by its requester.',
    'تم إلغاء تعديل معلّق على ملف Google من قِبل مقدّم الطلب.',
    NULL, '/team/google/profile',
    'google_change_cancelled:' || p_request_id::text || ':' || admins.admin_id::text
  )
  FROM (
    SELECT ur.user_id AS admin_id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'admin'::public.app_role
      AND p.deleted_at IS NULL AND p.deactivated_at IS NULL
  ) admins;

  RETURN QUERY SELECT p_request_id, 'CANCELLED'::text, v_req.field;
END;
$fn$;

REVOKE ALL ON FUNCTION public.cancel_google_profile_change_request(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_google_profile_change_request(uuid, uuid) TO authenticated, service_role;
