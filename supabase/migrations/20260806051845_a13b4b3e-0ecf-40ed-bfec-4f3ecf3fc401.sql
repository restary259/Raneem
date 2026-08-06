-- ============ 1. Referral codes on profiles ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referral_code_enabled boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key
  ON public.profiles (referral_code) WHERE referral_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_referral_code(p_full_name text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'public'
AS $$
DECLARE
  v_base text;
  v_code text;
  i integer := 0;
BEGIN
  v_base := lower(regexp_replace(COALESCE(split_part(btrim(p_full_name), ' ', 1), ''), '[^a-zA-Z0-9]', '', 'g'));
  IF length(v_base) < 3 THEN v_base := 'darb'; END IF;
  v_base := left(v_base, 12);

  LOOP
    v_code := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 4);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code);
    i := i + 1;
    IF i > 20 THEN
      v_code := 'darb-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
      EXIT;
    END IF;
  END LOOP;

  RETURN v_code;
END;
$$;

-- Auto-assign a code to every new profile
CREATE OR REPLACE FUNCTION public.assign_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code(NEW.full_name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_referral_code ON public.profiles;
CREATE TRIGGER trg_assign_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_referral_code();

-- Backfill existing profiles
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, full_name FROM public.profiles WHERE referral_code IS NULL LOOP
    UPDATE public.profiles
    SET referral_code = public.generate_referral_code(r.full_name)
    WHERE id = r.id;
  END LOOP;
END $$;

-- Non-admins must not be able to change their own referral code
CREATE OR REPLACE FUNCTION public.restrict_profiles_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
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
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- ============ 2. Attribution tracking ============
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS source_attribution_method text;
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source_attribution_method text;

-- Public, PII-free code resolver
CREATE OR REPLACE FUNCTION public.resolve_referral_code(p_code text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE lower(p.referral_code) = lower(btrim(p_code))
    AND p.referral_code_enabled = true
    AND p.deleted_at IS NULL
    AND ur.role IN ('social_media_partner', 'ambassador', 'student', 'team_member')
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_referral_code(text) TO anon, authenticated;

-- ============ 3. Rewards: real case link + shekels only ============
ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rewards_case_id_idx ON public.rewards (case_id);

UPDATE public.rewards
SET case_id = substring(admin_notes from '[0-9a-fA-F-]{36}')::uuid
WHERE case_id IS NULL
  AND admin_notes ~ '[0-9a-fA-F-]{36}'
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = substring(rewards.admin_notes from '[0-9a-fA-F-]{36}')::uuid
  );

ALTER TABLE public.rewards ALTER COLUMN currency SET DEFAULT 'ILS';
UPDATE public.rewards SET currency = 'ILS' WHERE currency IS DISTINCT FROM 'ILS';
ALTER TABLE public.rewards DROP CONSTRAINT IF EXISTS rewards_currency_ils;
ALTER TABLE public.rewards ADD CONSTRAINT rewards_currency_ils CHECK (currency = 'ILS');

ALTER TABLE public.transaction_log ALTER COLUMN currency SET DEFAULT 'ILS';
UPDATE public.transaction_log SET currency = 'ILS' WHERE currency IS DISTINCT FROM 'ILS';
ALTER TABLE public.transaction_log DROP CONSTRAINT IF EXISTS transaction_log_currency_ils;
ALTER TABLE public.transaction_log ADD CONSTRAINT transaction_log_currency_ils
  CHECK (currency IS NULL OR currency = 'ILS');

-- Catalogue tables default to shekels
ALTER TABLE public.master_services ALTER COLUMN currency SET DEFAULT 'ILS';
ALTER TABLE public.programs ALTER COLUMN currency SET DEFAULT 'ILS';
ALTER TABLE public.accommodations ALTER COLUMN currency SET DEFAULT 'ILS';
ALTER TABLE public.insurances ALTER COLUMN currency SET DEFAULT 'ILS';
UPDATE public.master_services SET currency = 'ILS' WHERE currency IS DISTINCT FROM 'ILS';
UPDATE public.programs SET currency = 'ILS' WHERE currency IS DISTINCT FROM 'ILS';
UPDATE public.accommodations SET currency = 'ILS' WHERE currency IS DISTINCT FROM 'ILS';
UPDATE public.insurances SET currency = 'ILS' WHERE currency IS DISTINCT FROM 'ILS';

-- ============ 4. Flat ambassador rate ============
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS ambassador_commission_rate integer NOT NULL DEFAULT 300;

-- ============ 5. Flat commission engine ============
-- COMMISSION RULE (single source of truth):
--   1. Every commission is a FLAT amount in ILS. There are no percentages and no tiers.
--   2. For each actor on a case we look up a per-person override first
--      (partner_commission_overrides / team_member_commission_overrides).
--      A per-person override ALWAYS wins over the global default for that role.
--   3. If no override exists we use the global default from platform_settings:
--        partner / ambassador  -> partner_commission_rate / ambassador_commission_rate
--        team member           -> team_member_commission_rate
--   4. Platform revenue = service fee - all commissions, floored at 0.
CREATE OR REPLACE FUNCTION public.record_case_commission(p_case_id uuid, p_total_payment_ils integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_case              RECORD;
  v_team_comm         integer := 0;
  v_partner_comm      integer := 0;
  v_admin_remainder   integer := 0;
  v_override_amount   integer;
  v_settings          RECORD;
  v_partner_id        uuid;
  v_is_ambassador     boolean := false;
BEGIN
  IF EXISTS (SELECT 1 FROM cases WHERE id = p_case_id AND commission_split_done = true) THEN
    RETURN;
  END IF;

  SELECT id, assigned_to, source, partner_id, referred_by
  INTO v_case FROM cases WHERE id = p_case_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(team_member_commission_rate, 100) AS team_rate,
         COALESCE(partner_commission_rate, 500)::integer AS partner_rate,
         COALESCE(ambassador_commission_rate, 300) AS ambassador_rate
  INTO v_settings
  FROM platform_settings LIMIT 1;

  -- Team member commission
  IF v_case.assigned_to IS NOT NULL THEN
    SELECT commission_amount INTO v_override_amount
    FROM team_member_commission_overrides
    WHERE team_member_id = v_case.assigned_to;

    v_team_comm := COALESCE(v_override_amount, COALESCE(v_settings.team_rate, 100));

    IF v_team_comm > 0 THEN
      INSERT INTO rewards (user_id, amount, currency, status, case_id, admin_notes)
      VALUES (v_case.assigned_to, v_team_comm, 'ILS', 'pending', p_case_id,
              'Team commission from case ' || p_case_id::text);
    END IF;
  END IF;

  -- Partner / ambassador commission: only the person actually linked to this case
  v_partner_id := COALESCE(v_case.partner_id, v_case.referred_by);
  v_override_amount := NULL;

  IF v_partner_id IS NOT NULL THEN
    v_is_ambassador := public.has_role(v_partner_id, 'ambassador'::app_role);

    SELECT commission_amount INTO v_override_amount
    FROM partner_commission_overrides
    WHERE partner_id = v_partner_id;

    v_partner_comm := COALESCE(
      v_override_amount,
      CASE WHEN v_is_ambassador THEN v_settings.ambassador_rate ELSE v_settings.partner_rate END
    );

    IF v_partner_comm > 0 THEN
      INSERT INTO rewards (user_id, amount, currency, status, case_id, admin_notes)
      VALUES (v_partner_id, v_partner_comm, 'ILS', 'pending', p_case_id,
              CASE WHEN v_is_ambassador THEN 'Ambassador commission from case '
                   ELSE 'Partner commission from case ' END || p_case_id::text);
    ELSE
      v_partner_comm := 0;
    END IF;
  END IF;

  v_admin_remainder := GREATEST(0, p_total_payment_ils - v_team_comm - v_partner_comm);

  UPDATE cases SET
    platform_revenue_ils  = v_admin_remainder,
    commission_split_done = true
  WHERE id = p_case_id;
END;
$$;

-- ============ 6. Apply form accepts a referral code ============
CREATE OR REPLACE FUNCTION public.insert_lead_from_apply(
  p_full_name text, p_phone text, p_passport_type text DEFAULT NULL::text,
  p_english_units integer DEFAULT NULL::integer, p_math_units integer DEFAULT NULL::integer,
  p_city text DEFAULT NULL::text, p_education_level text DEFAULT NULL::text,
  p_german_level text DEFAULT NULL::text, p_budget_range text DEFAULT NULL::text,
  p_preferred_city text DEFAULT NULL::text, p_accommodation boolean DEFAULT false,
  p_source_type text DEFAULT 'organic'::text, p_source_id uuid DEFAULT NULL::uuid,
  p_companion_name text DEFAULT NULL::text, p_companion_phone text DEFAULT NULL::text,
  p_preferred_major text DEFAULT NULL::text, p_ref_code text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_score integer := 0;
  v_reasons text[] := ARRAY[]::text[];
  v_status text := 'new';
  v_main_lead_id uuid;
  v_companion_lead_id uuid;
  v_ref_owner uuid;
  v_method text := 'organic';
BEGIN
  p_full_name := btrim(COALESCE(p_full_name, ''));
  p_phone     := btrim(COALESCE(p_phone, ''));

  IF length(p_full_name) < 2 OR length(p_full_name) > 100 THEN
    RAISE EXCEPTION 'Full name must be between 2 and 100 characters';
  END IF;
  IF p_phone !~ '^[0-9+\-\s()]{7,20}$' THEN
    RAISE EXCEPTION 'Invalid phone number format';
  END IF;
  IF length(COALESCE(p_city, '')) > 100
     OR length(COALESCE(p_education_level, '')) > 50
     OR length(COALESCE(p_german_level, '')) > 50
     OR length(COALESCE(p_budget_range, '')) > 50
     OR length(COALESCE(p_preferred_city, '')) > 100
     OR length(COALESCE(p_preferred_major, '')) > 150
     OR length(COALESCE(p_passport_type, '')) > 50
     OR length(COALESCE(p_source_type, '')) > 50
     OR length(COALESCE(p_ref_code, '')) > 40 THEN
    RAISE EXCEPTION 'One or more fields exceed the maximum allowed length';
  END IF;
  IF p_english_units IS NOT NULL AND (p_english_units < 0 OR p_english_units > 10) THEN
    RAISE EXCEPTION 'English units must be between 0 and 10';
  END IF;
  IF p_math_units IS NOT NULL AND (p_math_units < 0 OR p_math_units > 10) THEN
    RAISE EXCEPTION 'Math units must be between 0 and 10';
  END IF;
  IF p_companion_name IS NOT NULL AND btrim(p_companion_name) <> ''
     AND length(btrim(p_companion_name)) > 100 THEN
    RAISE EXCEPTION 'Companion name must be at most 100 characters';
  END IF;
  IF p_companion_phone IS NOT NULL AND btrim(p_companion_phone) <> ''
     AND btrim(p_companion_phone) !~ '^[0-9+\-\s()]{7,20}$' THEN
    RAISE EXCEPTION 'Invalid companion phone number format';
  END IF;

  -- Referral code wins over any client-supplied source, and is resolved server-side.
  IF p_ref_code IS NOT NULL AND btrim(p_ref_code) <> '' THEN
    v_ref_owner := public.resolve_referral_code(p_ref_code);
    IF v_ref_owner IS NOT NULL THEN
      p_source_id := v_ref_owner;
      v_method := 'link';
      IF public.has_role(v_ref_owner, 'social_media_partner'::app_role)
         OR public.has_role(v_ref_owner, 'ambassador'::app_role) THEN
        p_source_type := 'influencer';
      ELSE
        p_source_type := 'referral';
      END IF;
    END IF;
  END IF;

  IF v_method <> 'link' THEN
    -- No trusted code: never trust a raw source_id from the client.
    p_source_type := 'organic';
    p_source_id := NULL;
  END IF;

  IF p_passport_type = 'israeli_blue' THEN
    v_score := v_score + 30;
  ELSIF p_passport_type = 'israeli_red' THEN
    v_score := v_score + 20;
  ELSE
    v_reasons := array_append(v_reasons, 'Passport: ' || COALESCE(p_passport_type, 'unknown'));
  END IF;

  IF COALESCE(p_english_units, 0) >= 4 THEN
    v_score := v_score + 20;
  ELSE
    v_reasons := array_append(v_reasons, 'English units: ' || COALESCE(p_english_units::text, '0') || ' (min 4)');
  END IF;

  IF COALESCE(p_math_units, 0) >= 4 THEN
    v_score := v_score + 20;
  ELSE
    v_reasons := array_append(v_reasons, 'Math units: ' || COALESCE(p_math_units::text, '0') || ' (min 4)');
  END IF;

  IF p_education_level IN ('bagrut', 'bachelor', 'master') THEN
    v_score := v_score + 10;
  END IF;
  IF p_german_level IN ('intermediate', 'advanced') THEN
    v_score := v_score + 10;
  END IF;
  IF v_score < 30 THEN v_status := 'not_eligible'; END IF;

  INSERT INTO leads (
    full_name, phone, passport_type, english_units, math_units, city,
    education_level, german_level, budget_range, preferred_city,
    accommodation, source_type, source_id, status, eligibility_score,
    eligibility_reason, preferred_major, source_attribution_method
  )
  VALUES (
    p_full_name, p_phone, p_passport_type, p_english_units, p_math_units, p_city,
    p_education_level, p_german_level, p_budget_range, p_preferred_city,
    p_accommodation, p_source_type, p_source_id, v_status, v_score,
    array_to_string(v_reasons, '; '), p_preferred_major, v_method
  )
  RETURNING id INTO v_main_lead_id;

  IF p_companion_name IS NOT NULL AND p_companion_phone IS NOT NULL
     AND btrim(p_companion_name) <> '' AND btrim(p_companion_phone) <> '' THEN
    INSERT INTO leads (
      full_name, phone, source_type, source_id, companion_lead_id,
      notes, status, eligibility_score, source_attribution_method
    )
    VALUES (
      btrim(p_companion_name), btrim(p_companion_phone), p_source_type, p_source_id,
      v_main_lead_id, 'Companion of ' || p_full_name || ' (' || p_phone || ')',
      'new', 0, v_method
    )
    RETURNING id INTO v_companion_lead_id;

    UPDATE leads SET companion_lead_id = v_companion_lead_id WHERE id = v_main_lead_id;
  END IF;
END;
$$;

-- ============ 7. Ambassadors see their own referred cases ============
CREATE OR REPLACE FUNCTION public.get_partner_pool_cases(p_sources text[] DEFAULT NULL::text[])
RETURNS TABLE(id uuid, full_name text, status text, source text, created_at timestamp with time zone, education_level text, degree_interest text, partner_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id, c.full_name, c.status, c.source, c.created_at,
         c.education_level, c.degree_interest, c.partner_id
  FROM public.cases c
  WHERE c.deleted_at IS NULL
    AND (
      public.has_role(auth.uid(), 'social_media_partner'::app_role)
      OR public.has_role(auth.uid(), 'ambassador'::app_role)
    )
    AND (p_sources IS NULL OR c.source = ANY(p_sources))
    AND (
      c.partner_id = auth.uid()
      OR c.referred_by = auth.uid()
      OR (
        public.has_role(auth.uid(), 'social_media_partner'::app_role)
        AND COALESCE(
          (SELECT ps.partner_dashboard_show_all_cases FROM public.platform_settings ps LIMIT 1),
          false
        ) = true
      )
    )
$$;