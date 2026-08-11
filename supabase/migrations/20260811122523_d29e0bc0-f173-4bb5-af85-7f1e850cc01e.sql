-- 1) profiles: restrict self insert/update policies to authenticated and block privileged columns at INSERT
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
  AND COALESCE(is_master_partner, false) = false
  AND COALESCE(is_manager, false) = false
  AND master_partner_id IS NULL
  AND COALESCE(commission_amount, 0) = 0
  AND COALESCE(referral_code_enabled, false) = false
  AND deleted_at IS NULL
  AND iban_confirmed_at IS NULL
);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id AND deleted_at IS NULL)
WITH CHECK (auth.uid() = id);

-- Also guard referral_code_enabled at INSERT inside the trigger (defense in depth)
CREATE OR REPLACE FUNCTION public.restrict_profiles_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    NEW.is_master_partner := false;
    NEW.master_partner_id := NULL;
    NEW.is_manager := false;
    NEW.referral_code_enabled := false;
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
    IF NEW.is_master_partner IS DISTINCT FROM OLD.is_master_partner THEN
      RAISE EXCEPTION 'Non-admin users cannot change is_master_partner';
    END IF;
    IF NEW.master_partner_id IS DISTINCT FROM OLD.master_partner_id THEN
      RAISE EXCEPTION 'Non-admin users cannot change master_partner_id';
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

-- 2) user_roles: tighten team visibility of student roles
CREATE OR REPLACE FUNCTION public.team_can_view_student_role(_student_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _student_user_id IS NOT NULL
     AND public.has_role(auth.uid(), 'team_member')
     AND EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.deleted_at IS NULL
     )
     AND EXISTS (
       SELECT 1
       FROM public.cases c
       WHERE c.assigned_to = auth.uid()
         AND c.student_user_id = _student_user_id
         AND COALESCE(c.archived, false) = false
     );
$function$;

DROP POLICY IF EXISTS "Team can view assigned student roles" ON public.user_roles;
CREATE POLICY "Team can view assigned student roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  role = 'student'::app_role
  AND public.team_can_view_student_role(user_id)
);