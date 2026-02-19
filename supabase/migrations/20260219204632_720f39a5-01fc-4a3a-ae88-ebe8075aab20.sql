
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
  IF p_source_type NOT IN ('organic', 'influencer', 'referral', 'contact_form') THEN
    p_source_type := 'organic';
    p_source_id := NULL;
  END IF;

  IF p_source_type = 'influencer' AND p_source_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = p_source_id AND role = 'influencer'
    ) THEN
      p_source_type := 'organic';
      p_source_id := NULL;
    END IF;
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

  IF v_score < 30 THEN
    v_status := 'not_eligible';
  END IF;

  -- Upsert main lead — NOW includes deleted_at = NULL to restore soft-deleted leads
  UPDATE leads
  SET full_name = p_full_name, passport_type = p_passport_type,
      english_units = p_english_units, math_units = p_math_units,
      city = p_city, education_level = p_education_level,
      german_level = p_german_level, budget_range = p_budget_range,
      preferred_city = p_preferred_city, accommodation = p_accommodation,
      source_type = p_source_type, source_id = p_source_id,
      eligibility_score = v_score, eligibility_reason = array_to_string(v_reasons, '; '),
      status = v_status, preferred_major = p_preferred_major, created_at = now(),
      deleted_at = NULL
  WHERE phone = p_phone
  RETURNING id INTO v_main_lead_id;

  IF NOT FOUND THEN
    INSERT INTO leads (full_name, phone, passport_type, english_units, math_units, city,
                       education_level, german_level, budget_range, preferred_city,
                       accommodation, source_type, source_id, status, eligibility_score, eligibility_reason, preferred_major)
    VALUES (p_full_name, p_phone, p_passport_type, p_english_units, p_math_units, p_city,
            p_education_level, p_german_level, p_budget_range, p_preferred_city,
            p_accommodation, p_source_type, p_source_id, v_status, v_score,
            array_to_string(v_reasons, '; '), p_preferred_major)
    RETURNING id INTO v_main_lead_id;
  END IF;

  -- Handle companion lead — also includes deleted_at = NULL
  IF p_companion_name IS NOT NULL AND p_companion_phone IS NOT NULL
     AND trim(p_companion_name) <> '' AND trim(p_companion_phone) <> '' THEN

    UPDATE leads
    SET full_name = trim(p_companion_name),
        source_type = p_source_type, source_id = p_source_id,
        companion_lead_id = v_main_lead_id,
        notes = 'Companion of ' || p_full_name || ' (' || p_phone || ')',
        created_at = now(),
        deleted_at = NULL
    WHERE phone = trim(p_companion_phone)
    RETURNING id INTO v_companion_lead_id;

    IF NOT FOUND THEN
      INSERT INTO leads (full_name, phone, source_type, source_id, companion_lead_id,
                         notes, status, eligibility_score)
      VALUES (trim(p_companion_name), trim(p_companion_phone), p_source_type, p_source_id,
              v_main_lead_id, 'Companion of ' || p_full_name || ' (' || p_phone || ')',
              'new', 0)
      RETURNING id INTO v_companion_lead_id;
    END IF;

    UPDATE leads SET companion_lead_id = v_companion_lead_id WHERE id = v_main_lead_id;
  END IF;
END;
$function$;

-- One-time data fix: restore ghost leads that were re-submitted after soft-delete
UPDATE leads SET deleted_at = NULL
WHERE deleted_at IS NOT NULL AND created_at > deleted_at;
