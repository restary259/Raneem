-- Optional communication capability for team members.
-- This is intentionally separate from profiles.is_manager: enabling this flag
-- must never grant pipeline, assignment, or other management permissions.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS internal_team_chat_enabled boolean NOT NULL DEFAULT false;

-- Keep this feature flag admin-only, matching the existing profile permission
-- guard used for whatsapp_inbox_enabled and other privileged toggles.
CREATE OR REPLACE FUNCTION public.restrict_profiles_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_jwt_role text;
BEGIN
  BEGIN
    v_jwt_role := current_setting('request.jwt.claims', true)::json->>'role';
  EXCEPTION WHEN others THEN
    v_jwt_role := NULL;
  END;

  IF public.has_role(auth.uid(), 'admin')
     OR v_jwt_role = 'service_role'
     OR session_user IN ('service_role', 'postgres', 'supabase_admin')
  THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.commission_amount := 0;
    NEW.student_status := 'not_applied';
    NEW.visa_status := 'not_applied';
    NEW.must_change_password := false;
    NEW.case_id := NULL;
    NEW.linked_case_id := NULL;
    NEW.deleted_at := NULL;
    NEW.iban_confirmed_at := NULL;
    NEW.is_manager := false;
    NEW.referral_code_enabled := false;
    NEW.apply_form_enabled := false;
    NEW.whatsapp_inbox_enabled := false;
    NEW.internal_team_chat_enabled := false;
    NEW.deactivated_by := NULL;
    NEW.deactivated_reason := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.commission_amount IS DISTINCT FROM OLD.commission_amount THEN
      RAISE EXCEPTION 'Non-admin users cannot change commission_amount';
    END IF;
    IF NEW.student_status IS DISTINCT FROM OLD.student_status THEN
      RAISE EXCEPTION 'Non-admin users cannot change student_status';
    END IF;
    IF NEW.visa_status IS DISTINCT FROM OLD.visa_status THEN
      RAISE EXCEPTION 'Non-admin users cannot change visa_status';
    END IF;
    IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
      RAISE EXCEPTION 'Non-admin users cannot change must_change_password';
    END IF;
    IF NEW.case_id IS DISTINCT FROM OLD.case_id THEN
      RAISE EXCEPTION 'Non-admin users cannot change case_id';
    END IF;
    IF NEW.linked_case_id IS DISTINCT FROM OLD.linked_case_id THEN
      RAISE EXCEPTION 'Non-admin users cannot change linked_case_id';
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'Non-admin users cannot change deleted_at';
    END IF;
    IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
      RAISE EXCEPTION 'Non-admin users cannot change referral_code';
    END IF;
    IF NEW.referral_code_enabled IS DISTINCT FROM OLD.referral_code_enabled THEN
      RAISE EXCEPTION 'Non-admin users cannot change referral_code_enabled';
    END IF;
    IF NEW.apply_form_enabled IS DISTINCT FROM OLD.apply_form_enabled THEN
      RAISE EXCEPTION 'Non-admin users cannot change apply_form_enabled';
    END IF;
    IF NEW.whatsapp_inbox_enabled IS DISTINCT FROM OLD.whatsapp_inbox_enabled THEN
      RAISE EXCEPTION 'Non-admin users cannot change whatsapp_inbox_enabled';
    END IF;
    IF NEW.internal_team_chat_enabled IS DISTINCT FROM OLD.internal_team_chat_enabled THEN
      RAISE EXCEPTION 'Non-admin users cannot change internal_team_chat_enabled';
    END IF;
    IF NEW.is_manager IS DISTINCT FROM OLD.is_manager THEN
      RAISE EXCEPTION 'Non-admin users cannot change is_manager';
    END IF;
    IF NEW.deactivated_by IS DISTINCT FROM OLD.deactivated_by
       OR NEW.deactivated_reason IS DISTINCT FROM OLD.deactivated_reason THEN
      RAISE EXCEPTION 'Non-admin users cannot change account deactivation fields';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Non-admin users cannot change the profile id';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Non-admin users cannot change email';
    END IF;
    IF NEW.iban_confirmed_at IS DISTINCT FROM OLD.iban_confirmed_at THEN
      RAISE EXCEPTION 'Non-admin users cannot change iban_confirmed_at';
    END IF;
    IF OLD.iban_confirmed_at IS NOT NULL AND (
         NEW.iban IS DISTINCT FROM OLD.iban
      OR NEW.bank_name IS DISTINCT FROM OLD.bank_name
      OR NEW.bank_branch IS DISTINCT FROM OLD.bank_branch
      OR NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number
    ) THEN
      RAISE EXCEPTION 'Confirmed bank details can only be changed by an admin';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.restrict_profiles_write() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restrict_profiles_write() TO authenticated, service_role;

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
