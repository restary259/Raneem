CREATE OR REPLACE FUNCTION public.insert_lead_from_apply(p_full_name text, p_phone text, p_passport_type text DEFAULT NULL::text, p_english_units integer DEFAULT NULL::integer, p_math_units integer DEFAULT NULL::integer, p_city text DEFAULT NULL::text, p_education_level text DEFAULT NULL::text, p_german_level text DEFAULT NULL::text, p_budget_range text DEFAULT NULL::text, p_preferred_city text DEFAULT NULL::text, p_accommodation boolean DEFAULT false, p_source_type text DEFAULT 'organic'::text, p_source_id uuid DEFAULT NULL::uuid, p_companion_name text DEFAULT NULL::text, p_companion_phone text DEFAULT NULL::text, p_preferred_major text DEFAULT NULL::text, p_ref_code text DEFAULT NULL::text)
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
  v_ref_owner uuid;
  v_link_id uuid;
  v_method text := 'organic';
  v_free text[];
  v_val text;
BEGIN
  p_full_name := btrim(COALESCE(p_full_name, ''));
  p_phone     := btrim(COALESCE(p_phone, ''));

  v_free := ARRAY[
    p_full_name, COALESCE(p_city, ''), COALESCE(p_preferred_city, ''),
    COALESCE(p_preferred_major, ''), COALESCE(p_companion_name, ''),
    COALESCE(p_education_level, ''), COALESCE(p_german_level, ''),
    COALESCE(p_budget_range, ''), COALESCE(p_passport_type, '')
  ];
  FOREACH v_val IN ARRAY v_free LOOP
    IF v_val ~ '[\x00-\x1F\x7F]' THEN
      RAISE EXCEPTION 'Input contains invalid control characters';
    END IF;
    IF v_val ~* '(<[a-z/!]|https?://|javascript:|\{\{)' THEN
      RAISE EXCEPTION 'Input must not contain markup or links';
    END IF;
  END LOOP;

  IF length(p_full_name) < 2 OR length(p_full_name) > 100 THEN
    RAISE EXCEPTION 'Full name must be between 2 and 100 characters';
  END IF;
  IF p_full_name !~ '[[:alpha:]]' THEN
    RAISE EXCEPTION 'Full name must contain letters';
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
  IF p_ref_code IS NOT NULL AND btrim(p_ref_code) <> ''
     AND btrim(p_ref_code) !~ '^[A-Za-z0-9_-]{3,40}$' THEN
    RAISE EXCEPTION 'Invalid referral code format';
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

  -- Referral code wins over any client-supplied source, resolved server-side.
  IF p_ref_code IS NOT NULL AND btrim(p_ref_code) <> '' THEN
    -- 1) named partner link
    SELECT pl.id, pl.partner_id INTO v_link_id, v_ref_owner
    FROM public.partner_links pl
    WHERE lower(pl.code) = lower(btrim(p_ref_code)) AND pl.active = true
    LIMIT 1;

    -- 2) fall back to the owner's personal referral code
    IF v_ref_owner IS NULL THEN
      v_ref_owner := public.resolve_referral_code(p_ref_code);
    END IF;

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
    p_source_type := 'organic';
    p_source_id := NULL;
    v_link_id := NULL;
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
    eligibility_reason, preferred_major, source_attribution_method, partner_link_id
  )
  VALUES (
    p_full_name, p_phone, p_passport_type, p_english_units, p_math_units, p_city,
    p_education_level, p_german_level, p_budget_range, p_preferred_city,
    p_accommodation, p_source_type, p_source_id, v_status, v_score,
    array_to_string(v_reasons, '; '), p_preferred_major, v_method, v_link_id
  )
  RETURNING id INTO v_main_lead_id;

  IF p_companion_name IS NOT NULL AND p_companion_phone IS NOT NULL
     AND btrim(p_companion_name) <> '' AND btrim(p_companion_phone) <> '' THEN
    INSERT INTO leads (
      full_name, phone, source_type, source_id, companion_lead_id,
      notes, status, eligibility_score, source_attribution_method, partner_link_id
    )
    VALUES (
      btrim(p_companion_name), btrim(p_companion_phone), p_source_type, p_source_id,
      v_main_lead_id, 'Companion of ' || p_full_name || ' (' || p_phone || ')',
      'new', 0, v_method, v_link_id
    )
    RETURNING id INTO v_companion_lead_id;

    UPDATE leads SET companion_lead_id = v_companion_lead_id WHERE id = v_main_lead_id;
  END IF;
END;
$function$;

-- Also allow the referral health check to recognise named partner links
CREATE OR REPLACE FUNCTION public.check_referral_code(p_code text)
RETURNS TABLE(valid boolean, owner_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_owner uuid;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN QUERY SELECT false, NULL::text; RETURN;
  END IF;

  SELECT pl.partner_id INTO v_owner
  FROM public.partner_links pl
  WHERE lower(pl.code) = lower(btrim(p_code)) AND pl.active = true
  LIMIT 1;

  IF v_owner IS NULL THEN
    v_owner := public.resolve_referral_code(p_code);
  END IF;

  IF v_owner IS NULL THEN
    RETURN QUERY SELECT false, NULL::text; RETURN;
  END IF;

  RETURN QUERY
  SELECT true, split_part(COALESCE(pr.full_name, ''), ' ', 1)
  FROM public.profiles pr WHERE pr.id = v_owner;
END;
$function$;

REVOKE ALL ON FUNCTION public.check_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_referral_code(text) TO anon, authenticated, service_role;