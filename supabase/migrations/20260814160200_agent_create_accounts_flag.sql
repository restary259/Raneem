-- ════════════════════════════════════════════════════════════════════════
-- Agent manual account-creation permission flag.
--
-- Mirrors agent_can_invite_directly: an admin-controlled boolean that lets
-- an Agent create partner/ambassador accounts directly (with a temp password)
-- instead of sending an email invitation. The edge function
-- agent-create-account gates on this server-side.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agent_can_create_accounts boolean NOT NULL DEFAULT false;

-- Re-create restrict_profiles_write to guard the new column (admin-only).
-- The function is recreated in full because ALTER FUNCTION cannot patch a
-- single column check. Behaviour is identical to the previous version plus
-- the new agent_can_create_accounts guard.
CREATE OR REPLACE FUNCTION public.restrict_profiles_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_jwt_role text;
BEGIN
  BEGIN
    v_jwt_role := current_setting('request.jwt.claims', true)::json->>'role';
  EXCEPTION WHEN others THEN v_jwt_role := NULL; END;
  IF public.has_role(auth.uid(), 'admin')
     OR v_jwt_role = 'service_role'
     OR session_user IN ('service_role', 'postgres', 'supabase_admin')
  THEN RETURN NEW; END IF;
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
    NEW.agent_id := NULL;
    NEW.agent_can_invite_directly := false;
    NEW.agent_can_create_accounts := false;
    NEW.deactivated_at := NULL;
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
    IF NEW.agent_id IS DISTINCT FROM OLD.agent_id THEN
      RAISE EXCEPTION 'Non-admin users cannot change agent_id';
    END IF;
    IF NEW.agent_can_invite_directly IS DISTINCT FROM OLD.agent_can_invite_directly THEN
      RAISE EXCEPTION 'Non-admin users cannot change agent_can_invite_directly';
    END IF;
    IF NEW.agent_can_create_accounts IS DISTINCT FROM OLD.agent_can_create_accounts THEN
      RAISE EXCEPTION 'Non-admin users cannot change agent_can_create_accounts';
    END IF;
    IF NEW.deactivated_at IS DISTINCT FROM OLD.deactivated_at THEN
      RAISE EXCEPTION 'Non-admin users cannot change deactivated_at';
    END IF;
    IF NEW.deactivated_by IS DISTINCT FROM OLD.deactivated_by THEN
      RAISE EXCEPTION 'Non-admin users cannot change deactivated_by';
    END IF;
    IF NEW.deactivated_reason IS DISTINCT FROM OLD.deactivated_reason THEN
      RAISE EXCEPTION 'Non-admin users cannot change deactivated_reason';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Non-admin users cannot change id';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Non-admin users cannot change email';
    END IF;
    IF NEW.iban_confirmed_at IS DISTINCT FROM OLD.iban_confirmed_at THEN
      RAISE EXCEPTION 'Non-admin users cannot change iban_confirmed_at';
    END IF;
    IF NEW.bank_name IS DISTINCT FROM OLD.bank_name AND OLD.iban_confirmed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Confirmed bank details can only be changed by an admin';
    END IF;
    IF NEW.bank_branch IS DISTINCT FROM OLD.bank_branch AND OLD.iban_confirmed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Confirmed bank details can only be changed by an admin';
    END IF;
    IF NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number AND OLD.iban_confirmed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Confirmed bank details can only be changed by an admin';
    END IF;
    IF NEW.iban IS DISTINCT FROM OLD.iban AND OLD.iban_confirmed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Confirmed bank details can only be changed by an admin';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

COMMIT;
