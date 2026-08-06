-- 1. Input validation on the public lead-capture RPC
CREATE OR REPLACE FUNCTION public.insert_lead_from_apply(p_full_name text, p_phone text, p_passport_type text DEFAULT NULL::text, p_english_units integer DEFAULT NULL::integer, p_math_units integer DEFAULT NULL::integer, p_city text DEFAULT NULL::text, p_education_level text DEFAULT NULL::text, p_german_level text DEFAULT NULL::text, p_budget_range text DEFAULT NULL::text, p_preferred_city text DEFAULT NULL::text, p_accommodation boolean DEFAULT false, p_source_type text DEFAULT 'organic'::text, p_source_id uuid DEFAULT NULL::uuid, p_companion_name text DEFAULT NULL::text, p_companion_phone text DEFAULT NULL::text, p_preferred_major text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_score integer := 0;
  v_reasons text[] := ARRAY[]::text[];
  v_status text := 'new';
  v_main_lead_id uuid;
  v_companion_lead_id uuid;
BEGIN
  -- ---------- Input validation ----------
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
     OR length(COALESCE(p_source_type, '')) > 50 THEN
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
  -- ---------- End validation ----------

  -- Validate source type
  IF p_source_type NOT IN ('organic', 'influencer', 'referral', 'contact_form') THEN
    p_source_type := 'organic';
    p_source_id := NULL;
  END IF;

  -- Validate influencer source
  IF p_source_type = 'influencer' AND p_source_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = p_source_id AND role = 'influencer'
    ) THEN
      p_source_type := 'organic';
      p_source_id := NULL;
    END IF;
  END IF;

  -- Calculate eligibility score
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

  IF v_score < 30 THEN
    v_status := 'not_eligible';
  END IF;

  INSERT INTO leads (
    full_name, phone, passport_type, english_units, math_units, city,
    education_level, german_level, budget_range, preferred_city,
    accommodation, source_type, source_id, status, eligibility_score,
    eligibility_reason, preferred_major
  )
  VALUES (
    p_full_name, p_phone, p_passport_type, p_english_units, p_math_units, p_city,
    p_education_level, p_german_level, p_budget_range, p_preferred_city,
    p_accommodation, p_source_type, p_source_id, v_status, v_score,
    array_to_string(v_reasons, '; '), p_preferred_major
  )
  RETURNING id INTO v_main_lead_id;

  IF p_companion_name IS NOT NULL AND p_companion_phone IS NOT NULL
     AND btrim(p_companion_name) <> '' AND btrim(p_companion_phone) <> '' THEN

    INSERT INTO leads (
      full_name, phone, source_type, source_id, companion_lead_id,
      notes, status, eligibility_score
    )
    VALUES (
      btrim(p_companion_name), btrim(p_companion_phone), p_source_type, p_source_id,
      v_main_lead_id, 'Companion of ' || p_full_name || ' (' || p_phone || ')',
      'new', 0
    )
    RETURNING id INTO v_companion_lead_id;

    UPDATE leads SET companion_lead_id = v_companion_lead_id WHERE id = v_main_lead_id;
  END IF;
END;
$function$;

-- 2. Remove anonymous table access on PII / financial tables.
--    Public apply flow uses the SECURITY DEFINER RPC above, not direct inserts.
REVOKE ALL ON public.leads FROM anon;
REVOKE ALL ON public.case_service_snapshots FROM anon;

-- Keep signed-in access on case_service_snapshots limited to what its policies allow.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.case_service_snapshots FROM authenticated;
GRANT SELECT ON public.case_service_snapshots TO authenticated;
GRANT ALL ON public.case_service_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

-- 3. Trigger-only SECURITY DEFINER functions must not be directly callable.
DO $$
DECLARE
  fn text;
  trigger_fns text[] := ARRAY[
    'audit_lead_source_change()',
    'auto_split_payment()',
    'generate_lead_ref_code()',
    'handle_new_user()',
    'log_case_status_change()',
    'notify_payout_status_change()',
    'notify_referral_accepted()',
    'notify_student_profile_update()',
    'notify_visa_status_email()',
    'restrict_cases_financial_columns()',
    'restrict_profiles_write()',
    'set_admin_must_change_password()',
    'update_case_activity()',
    'update_updated_at_column()'
  ];
BEGIN
  FOREACH fn IN ARRAY trigger_fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;

-- 4. Helper / admin functions: not callable by anonymous visitors.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_auth_failure_spikes(interval, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_failure_spikes(interval, integer) TO authenticated, service_role;

-- 5. Public apply page still needs these two.
GRANT EXECUTE ON FUNCTION public.insert_lead_from_apply(text, text, text, integer, integer, text, text, text, text, text, boolean, text, uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_influencer_ref(uuid) TO anon, authenticated;