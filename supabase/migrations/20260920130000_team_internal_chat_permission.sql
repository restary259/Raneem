-- Optional communication capability for team members.
-- This is intentionally separate from profiles.is_manager: enabling this flag
-- must never grant pipeline, assignment, or other management permissions.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS internal_team_chat_enabled boolean NOT NULL DEFAULT false;

-- Keep this feature flag admin-only without replacing the existing global
-- profile-write guard. A dedicated trigger protects only this new field.
CREATE OR REPLACE FUNCTION public.protect_internal_team_chat_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_jwt_role text;
  v_privileged boolean;
BEGIN
  BEGIN
    v_jwt_role := current_setting('request.jwt.claims', true)::json->>'role';
  EXCEPTION WHEN others THEN
    v_jwt_role := NULL;
  END;

  v_privileged :=
    public.has_role(auth.uid(), 'admin'::app_role)
    OR v_jwt_role = 'service_role'
    OR session_user IN ('service_role', 'postgres', 'supabase_admin');

  IF NOT v_privileged THEN
    IF TG_OP = 'INSERT' THEN
      NEW.internal_team_chat_enabled := false;
    ELSIF TG_OP = 'UPDATE'
      AND NEW.internal_team_chat_enabled IS DISTINCT FROM OLD.internal_team_chat_enabled
    THEN
      RAISE EXCEPTION 'Only administrators can change internal_team_chat_enabled';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.protect_internal_team_chat_flag() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_internal_team_chat_flag() TO service_role;

DROP TRIGGER IF EXISTS protect_internal_team_chat_flag ON public.profiles;
CREATE TRIGGER protect_internal_team_chat_flag
BEFORE INSERT OR UPDATE OF internal_team_chat_enabled
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_internal_team_chat_flag();

-- Server-side capability predicate. A regular team member can only use the
-- new peer-team chat when an admin explicitly enabled the profile flag.
CREATE OR REPLACE FUNCTION public.has_internal_team_chat_access(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(p_user, 'admin'::app_role)
    OR (
      public.has_role(p_user, 'team_member'::app_role)
      AND COALESCE(
        (SELECT p.internal_team_chat_enabled
           FROM public.profiles p
          WHERE p.id = p_user
            AND p.deleted_at IS NULL),
        false
      )
    )
$$;

REVOKE ALL ON FUNCTION public.has_internal_team_chat_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_internal_team_chat_access(uuid) TO authenticated, service_role;

-- Dedicated directory for peer-to-peer team chat. The existing
-- get_staff_directory() behavior is left unchanged for admin/manager flows.
CREATE OR REPLACE FUNCTION public.get_team_chat_directory()
RETURNS TABLE(id uuid, full_name text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT p.id, p.full_name, ur.role::text
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'team_member'
    AND p.deleted_at IS NULL
    AND p.deactivated_at IS NULL
    AND p.id <> auth.uid()
    AND public.has_internal_team_chat_access(auth.uid())
  ORDER BY lower(p.full_name), p.id
$function$;

REVOKE ALL ON FUNCTION public.get_team_chat_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_chat_directory() TO authenticated, service_role;

-- Start or reuse a one-to-one peer team-member chat. This is deliberately
-- separate from start_direct_thread() so existing admin/manager/partner/agent
-- routing remains unchanged.
CREATE OR REPLACE FUNCTION public.start_team_chat_thread(p_other_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_other_is_team boolean;
  v_thread uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_internal_team_chat_access(v_me)
     OR NOT public.has_role(v_me, 'team_member'::app_role)
  THEN
    RAISE EXCEPTION 'Internal team chat is not enabled for this account';
  END IF;

  IF p_other_user IS NULL OR p_other_user = v_me THEN
    RAISE EXCEPTION 'Pick another team member';
  END IF;

  SELECT public.has_role(p_other_user, 'team_member'::app_role)
    INTO v_other_is_team;

  IF NOT COALESCE(v_other_is_team, false) THEN
    RAISE EXCEPTION 'You can only start team chat with another team member';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_other_user
      AND (deleted_at IS NOT NULL OR deactivated_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'The selected team member is unavailable';
  END IF;

  -- Reuse any existing one-to-one direct thread between this exact pair.
  -- This avoids duplicate threads for pairs that already had a permitted
  -- admin/manager relationship.
  SELECT p1.thread_id
    INTO v_thread
  FROM public.direct_thread_participants p1
  JOIN public.direct_thread_participants p2
    ON p2.thread_id = p1.thread_id
  JOIN public.direct_threads dt
    ON dt.id = p1.thread_id
  WHERE p1.user_id = v_me
    AND p2.user_id = p_other_user
  LIMIT 1;

  IF v_thread IS NOT NULL THEN
    RETURN v_thread;
  END IF;

  INSERT INTO public.direct_threads (created_by, purpose)
  VALUES (v_me, 'team_chat')
  RETURNING id INTO v_thread;

  INSERT INTO public.direct_thread_participants (thread_id, user_id)
  VALUES (v_thread, v_me),
         (v_thread, p_other_user);

  RETURN v_thread;
END;
$function$;

REVOKE ALL ON FUNCTION public.start_team_chat_thread(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_team_chat_thread(uuid) TO authenticated, service_role;

-- Direct messages themselves remain participant-scoped. No new RLS bypass is
-- introduced by this migration.
