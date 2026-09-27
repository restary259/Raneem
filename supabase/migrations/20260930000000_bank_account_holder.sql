-- Add the bank ACCOUNT HOLDER (beneficiary) name to the shared payout bank row.
--
-- `bank_name` is the name of the BANK (e.g. Bank Hapoalim); it is not who the
-- account belongs to. Payouts need the beneficiary name printed on the account,
-- which may differ from the profile's full name, so it gets its own column.
--
-- Manual deploy (supabase db push / dashboard SQL editor). Idempotent.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Column
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bank_account_holder text;

COMMENT ON COLUMN public.profiles.bank_account_holder IS
  'Name of the person/entity that owns the payout bank account. Distinct from bank_name (the bank itself).';

-- ---------------------------------------------------------------------------
-- 2. Keep the profile-write guard strict
-- ---------------------------------------------------------------------------
-- Recreated VERBATIM from the current live definition (20260928110000) with one
-- addition: once iban_confirmed_at is set, changing bank_account_holder is
-- admin-only too — otherwise a non-admin could redirect a verified payout by
-- swapping only the beneficiary name.

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
    NEW.voice_calls_enabled := false;
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
    IF NEW.voice_calls_enabled IS DISTINCT FROM OLD.voice_calls_enabled THEN
      RAISE EXCEPTION 'Non-admin users cannot change voice_calls_enabled';
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
      OR NEW.bank_account_holder IS DISTINCT FROM OLD.bank_account_holder
    ) THEN
      RAISE EXCEPTION 'Confirmed bank details can only be changed by an admin';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

-- Belt and braces for an out-of-order re-run of an older migration.
DROP TRIGGER IF EXISTS restrict_profiles_write ON public.profiles;
CREATE TRIGGER restrict_profiles_write
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.restrict_profiles_write();

-- ---------------------------------------------------------------------------
-- 3. Include the holder in the server-authoritative chat share
-- ---------------------------------------------------------------------------
-- Same contract as 20260929000000: reads the caller's own saved row, posts the
-- marker + JSON + human block. Key order must match BankDetailsPayload in
-- src/lib/chatFormat.ts, so `bankHolder` goes right after `bankName`.

CREATE OR REPLACE FUNCTION public.send_bank_details_to_admin(p_thread_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_row record;
  v_body text;
  v_json text;
  v_human text;
  v_message uuid;
  v_dash text := chr(8212); -- em dash, matching the JS '—' placeholder
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT (public.has_role(v_me, 'social_media_partner'::app_role)
          OR public.has_role(v_me, 'ambassador'::app_role)
          OR public.has_role(v_me, 'agent'::app_role)) THEN
    RAISE EXCEPTION 'Only partners, ambassadors and agents can send bank details';
  END IF;

  IF NOT public.is_direct_thread_member(p_thread_id, v_me) THEN
    RAISE EXCEPTION 'You are not a participant in this conversation';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.direct_thread_participants p
     WHERE p.thread_id = p_thread_id
       AND public.has_role(p.user_id, 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'This conversation has no administrator to receive bank details';
  END IF;

  SELECT bank_country, bank_account_holder, bank_name, bank_branch,
         bank_account_number, iban, bic
    INTO v_row
    FROM public.profiles
   WHERE id = v_me;

  IF v_row IS NULL THEN RAISE EXCEPTION 'BANK_DETAILS_MISSING'; END IF;

  IF COALESCE(btrim(v_row.bank_account_holder), '') = ''
     AND COALESCE(btrim(v_row.bank_name), '') = ''
     AND COALESCE(btrim(v_row.bank_branch), '') = ''
     AND COALESCE(btrim(v_row.bank_account_number), '') = ''
     AND COALESCE(btrim(v_row.iban), '') = ''
     AND COALESCE(btrim(v_row.bic), '') = '' THEN
    RAISE EXCEPTION 'BANK_DETAILS_MISSING';
  END IF;

  v_json := jsonb_build_object(
    'bankCountry', COALESCE(v_row.bank_country, ''),
    'bankHolder', COALESCE(v_row.bank_account_holder, ''),
    'bankName', COALESCE(v_row.bank_name, ''),
    'bankBranch', COALESCE(v_row.bank_branch, ''),
    'bankAccount', COALESCE(v_row.bank_account_number, ''),
    'iban', COALESCE(v_row.iban, ''),
    'bic', COALESCE(v_row.bic, '')
  )::text;

  v_human :=
      'Account holder: ' || COALESCE(NULLIF(v_row.bank_account_holder, ''), v_dash)
   || E'\nBank name: ' || COALESCE(NULLIF(v_row.bank_name, ''), v_dash)
   || E'\nBranch: ' || COALESCE(NULLIF(v_row.bank_branch, ''), v_dash)
   || E'\nAccount number: ' || COALESCE(NULLIF(v_row.bank_account_number, ''), v_dash)
   || E'\nIBAN: ' || COALESCE(NULLIF(v_row.iban, ''), v_dash)
   || E'\nBIC/SWIFT: ' || COALESCE(NULLIF(v_row.bic, ''), v_dash)
   || E'\nCountry: ' || COALESCE(NULLIF(v_row.bank_country, ''), v_dash);

  v_body := '::bank-details::' || E'\n' || v_json || E'\n\n' || v_human;

  v_message := public.send_direct_message(p_thread_id, v_body, '[]'::jsonb, '{}'::uuid[]);

  UPDATE public.direct_messages
     SET kind = 'bank_share'
   WHERE id = v_message;

  RETURN v_message;
END;
$$;

REVOKE ALL ON FUNCTION public.send_bank_details_to_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_bank_details_to_admin(uuid) TO authenticated;

COMMIT;
