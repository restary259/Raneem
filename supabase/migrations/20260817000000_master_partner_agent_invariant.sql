-- ════════════════════════════════════════════════════════════════════════
-- G1 — Master Partner ≠ Agent-recruited invariant
-- ════════════════════════════════════════════════════════════════════════
-- An agent-recruited partner (profiles.agent_id IS NOT NULL) must NEVER be
-- designated a Master Partner. A Master Partner is an independent top of an
-- agent network; an agent-recruited partner sits BELOW an agent in the
-- hierarchy, so the two roles are mutually exclusive (Rule 8/12). Previously
-- `restrict_profiles_write()` returned `NEW` early for admin/service_role
-- callers, so an admin UI / RPC could set `is_master_partner = true` on a
-- profile that still carried `agent_id` — silently creating a cycle in the
-- recruitment graph. This is an integrity invariant (not a permission rule),
-- so it MUST fire for admin and service_role writes too.
--
-- The check is added to the trusted-caller early-return path. It is also
-- enforced for non-admin callers (they already can't set is_master_partner,
-- but defense-in-depth).
-- ════════════════════════════════════════════════════════════════════════

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

  -- ── Integrity invariant: an agent-recruited account cannot be a Master ──
  -- Partner. Fires for ALL callers (admin, service_role, superuser) because it
  -- is a graph-cycle guard, not a permission. The two statuses are mutually
  -- exclusive: a Master Partner must have NO agent_id (independent), and an
  -- agent-recruited partner sits below an agent in the hierarchy.
  IF NEW.is_master_partner = true AND NEW.agent_id IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_MASTER: Agent-recruited partners cannot become Master Partners. Remove agent_id first.';
  END IF;

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

-- ── Diagnostic: find any existing rows violating the invariant ─────────────
-- For operator review only — do NOT auto-delete (an operator may want to
-- detach the agent_id rather than revoke the master flag). Run manually:
--
-- SELECT id, email, agent_id, is_master_partner
-- FROM public.profiles
-- WHERE is_master_partner = true AND agent_id IS NOT NULL;
