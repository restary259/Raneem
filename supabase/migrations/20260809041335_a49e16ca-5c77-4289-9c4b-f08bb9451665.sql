-- 1. Fix trusted-server detection in restrict_profiles_write.
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

  -- Trusted callers: admins, service_role (edge functions), and direct
  -- superuser/owner sessions (migrations, cron, dashboard SQL).
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

-- 2. Invitation model.
CREATE TABLE public.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_email text NOT NULL,
  invitation_type text NOT NULL CHECK (invitation_type IN ('student','partner')),
  intended_role app_role NOT NULL,
  token_hash text NOT NULL UNIQUE,
  inviter_id uuid,
  master_partner_id uuid,
  case_id uuid,
  recruit_application_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_invitations_email ON public.user_invitations (lower(invited_email));
CREATE INDEX idx_user_invitations_status ON public.user_invitations (status);
CREATE INDEX idx_user_invitations_recruit ON public.user_invitations (recruit_application_id);
CREATE INDEX idx_user_invitations_case ON public.user_invitations (case_id);

GRANT SELECT ON public.user_invitations TO authenticated;
GRANT ALL ON public.user_invitations TO service_role;

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view invitations"
  ON public.user_invitations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_user_invitations_updated_at
  BEFORE UPDATE ON public.user_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Safe public preview for the activation page (no raw token stored client-side).
CREATE OR REPLACE FUNCTION public.get_invitation_preview(p_token text)
RETURNS TABLE(
  state text,
  invitation_type text,
  invited_email text,
  masked_email text,
  recruiter_name text,
  case_reference text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_hash text;
  v_inv public.user_invitations%ROWTYPE;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  v_hash := encode(extensions.digest(btrim(p_token), 'sha256'), 'hex');

  SELECT * INTO v_inv FROM public.user_invitations WHERE token_hash = v_hash;

  IF v_inv.id IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    CASE
      WHEN v_inv.status = 'accepted' THEN 'accepted'
      WHEN v_inv.status = 'revoked' THEN 'revoked'
      WHEN v_inv.expires_at < now() THEN 'expired'
      ELSE 'valid'
    END,
    v_inv.invitation_type,
    CASE WHEN v_inv.status = 'pending' AND v_inv.expires_at >= now()
         THEN v_inv.invited_email ELSE NULL END,
    regexp_replace(v_inv.invited_email, '^(.).*(.)@', '\1***\2@'),
    (SELECT p.full_name FROM public.profiles p WHERE p.id = v_inv.master_partner_id),
    (SELECT c.case_reference FROM public.cases c WHERE c.id = v_inv.case_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_invitation_preview(text) TO anon, authenticated, service_role;