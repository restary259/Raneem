-- cases has no email column: duplicate check reads case_submissions.student_email
-- and the case insert no longer writes cases.email. Email stays on case_submissions.
CREATE OR REPLACE FUNCTION public.create_student_referral_registration_internal(
  p_referrer_user_id uuid,
  p_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
DECLARE
  v_referrer RECORD;
  v_existing RECORD;
  v_school RECORD;
  v_program RECORD;
  v_accommodation RECORD;
  v_insurance RECORD;
  v_case RECORD;
  v_referral RECORD;
  v_invoice RECORD;
  v_case_ref text;
  v_name text;
  v_phone text;
  v_email text;
  v_locale text;
  v_type text;
  v_school_id uuid;
  v_program_id uuid;
  v_accommodation_id uuid;
  v_insurance_id uuid;
  v_program_weeks integer;
  v_accommodation_weeks integer;
  v_age integer;
  v_date_of_birth date;
  v_start_month text;
  v_start_date date;
  v_program_end_date date;
  v_program_rate numeric;
  v_accommodation_rate numeric;
  v_insurance_rate numeric;
  v_insurance_months integer;
  v_insurance_billing text;
  v_program_total numeric;
  v_accommodation_total numeric;
  v_insurance_total numeric;
  v_subtotal numeric;
  v_currency text;
  v_items jsonb := '[]'::jsonb;
  v_first_name text;
  v_middle_name text;
  v_last_name text;
  v_full_address text;
  v_emergency_name text;
  v_emergency_phone text;
  v_gender text;
  v_city_of_birth text;
  v_nationality text;
  v_passport_type text;
  v_education_level text;
  v_english_units integer;
  v_math_units integer;
  v_english_level text;
  v_major text;
  v_major_id uuid;
BEGIN
  IF p_referrer_user_id IS NULL OR p_data IS NULL THEN
    RAISE EXCEPTION 'Invalid registration payload';
  END IF;

  SELECT p.id, p.full_name, p.email
    INTO v_referrer
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
   WHERE p.id = p_referrer_user_id
     AND ur.role = 'student'
     AND p.deleted_at IS NULL
     AND p.deactivated_at IS NULL
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only an active student can create a referral registration';
  END IF;

  v_type := NULLIF(trim(p_data->>'referral_type'), '');
  IF v_type IS NULL OR v_type NOT IN ('friend','family') THEN
    RAISE EXCEPTION 'Invalid referral type';
  END IF;

  v_name := NULLIF(btrim(regexp_replace(COALESCE(p_data->>'full_name',''), '<[^>]*>', '', 'g')), '');
  v_phone := NULLIF(btrim(p_data->>'phone'), '');
  v_email := lower(NULLIF(btrim(p_data->>'email'), ''));
  IF v_name IS NULL OR v_phone IS NULL OR v_email IS NULL THEN
    RAISE EXCEPTION 'Full name, phone and email are required';
  END IF;

  IF length(v_name) > 120 OR length(v_email) > 254 OR length(v_phone) > 30 THEN
    RAISE EXCEPTION 'Registration field too long';
  END IF;

  IF v_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  IF NOT (regexp_replace(v_phone, '\D', '', 'g') ~ '^[0-9]{7,15}$') THEN
    RAISE EXCEPTION 'Invalid phone format';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.referrals r
     WHERE r.referrer_user_id = p_referrer_user_id
       AND regexp_replace(COALESCE(r.referred_phone,''), '\D', '', 'g')
           = regexp_replace(v_phone, '\D', '', 'g')
  ) THEN
    RAISE EXCEPTION 'This phone number has already been referred by you';
  END IF;

  SELECT c.id
    INTO v_existing
    FROM public.cases c
   WHERE c.deleted_at IS NULL
     AND (
       EXISTS (
         SELECT 1 FROM public.case_submissions cs
          WHERE cs.case_id = c.id
            AND lower(COALESCE(cs.student_email,'')) = v_email
       )
       OR regexp_replace(c.phone_number, '\D', '', 'g') =
          regexp_replace(v_phone, '\D', '', 'g')
     )
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'This person already has a DARB case';
  END IF;

  v_school_id := NULLIF(p_data->>'school_id','')::uuid;
  v_program_id := NULLIF(p_data->>'program_id','')::uuid;
  v_accommodation_id := NULLIF(p_data->>'accommodation_id','')::uuid;
  -- The form uses the literal 'none' for an explicit "no insurance" choice;
  -- treat it (like empty) as no insurance instead of casting it to a uuid.
  v_insurance_id := NULLIF(NULLIF(p_data->>'insurance_id',''),'none')::uuid;
  v_program_weeks := NULLIF(p_data->>'program_weeks','')::integer;
  v_accommodation_weeks := NULLIF(p_data->>'accommodation_weeks','')::integer;
  v_start_month := NULLIF(trim(p_data->>'start_month'),'');
  v_locale := CASE
    WHEN p_data->>'locale' IN ('ar','he','en') THEN p_data->>'locale'
    ELSE 'en'
  END;

  IF v_school_id IS NULL OR v_program_id IS NULL OR v_program_weeks IS NULL THEN
    RAISE EXCEPTION 'School, course and course duration are required';
  END IF;

  IF v_program_weeks < 1 OR v_program_weeks > 104 THEN
    RAISE EXCEPTION 'Invalid course duration';
  END IF;

  IF v_accommodation_weeks IS NOT NULL
     AND (v_accommodation_weeks < 1 OR v_accommodation_weeks > 104) THEN
    RAISE EXCEPTION 'Invalid accommodation duration';
  END IF;

  IF v_start_month IS NULL OR v_start_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'A valid start month is required';
  END IF;
  v_start_date := (v_start_month || '-01')::date;

  IF NULLIF(trim(p_data->>'date_of_birth'),'') IS NULL THEN
    RAISE EXCEPTION 'Date of birth is required';
  END IF;

  BEGIN
    v_date_of_birth := (p_data->>'date_of_birth')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Invalid date of birth';
  END;

  IF v_date_of_birth > current_date THEN
    RAISE EXCEPTION 'Date of birth cannot be in the future';
  END IF;

  IF v_start_date < date_trunc('month', current_date)::date THEN
    RAISE EXCEPTION 'Start month is in the past';
  END IF;

  SELECT * INTO v_school
    FROM public.schools
   WHERE id = v_school_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selected school is unavailable'; END IF;

  SELECT * INTO v_program
    FROM public.programs
   WHERE id = v_program_id AND is_active = true AND school_id = v_school_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selected course is unavailable for this school'; END IF;

  SELECT * INTO v_accommodation
    FROM public.accommodations
   WHERE id = v_accommodation_id
     AND is_active = true
     AND school_id = v_school_id;
  IF v_accommodation_id IS NOT NULL AND NOT FOUND THEN
    RAISE EXCEPTION 'Selected accommodation is unavailable for this school';
  END IF;

  IF v_insurance_id IS NOT NULL THEN
    SELECT * INTO v_insurance
      FROM public.insurances
     WHERE id = v_insurance_id AND is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Selected insurance is unavailable'; END IF;
  END IF;

  IF upper(COALESCE(v_program.currency,'EUR')) <> 'EUR' THEN
    RAISE EXCEPTION 'This registration currently requires EUR course pricing';
  END IF;
  IF v_accommodation_id IS NOT NULL
     AND upper(COALESCE(v_accommodation.currency,'EUR')) <> upper(COALESCE(v_program.currency,'EUR')) THEN
    RAISE EXCEPTION 'Course and accommodation currencies must match';
  END IF;
  IF v_insurance_id IS NOT NULL
     AND upper(COALESCE(v_insurance.currency,'EUR')) <> upper(COALESCE(v_program.currency,'EUR')) THEN
    RAISE EXCEPTION 'Course and insurance currencies must match';
  END IF;

  v_currency := upper(COALESCE(v_program.currency,'EUR'));

  v_program_rate := public.resolve_registration_weekly_rate(v_program.price, v_program.price_tiers, v_program_weeks);
  IF v_program_rate IS NULL OR v_program_rate <= 0 THEN
    RAISE EXCEPTION 'Selected course has no valid price for this duration';
  END IF;
  v_program_total := round(v_program_rate * v_program_weeks, 2);
  v_program_end_date := v_start_date + (v_program_weeks * 7);

  v_items := jsonb_build_array(
    jsonb_build_object(
      'kind','course',
      'name_en',v_program.name_en,
      'name_ar',v_program.name_ar,
      'weeks',v_program_weeks,
      'weekly_price',v_program_rate,
      'total',v_program_total,
      'currency',v_currency
    )
  );

  v_subtotal := v_program_total;

  IF COALESCE(v_program.registration_fee,0) > 0 THEN
    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'kind','course_registration_fee',
        'name_en','Course registration fee',
        'name_ar','رسوم تسجيل الدورة',
        'weeks',1,
        'weekly_price',v_program.registration_fee,
        'total',round(v_program.registration_fee,2),
        'currency',v_currency
      )
    );
    v_subtotal := v_subtotal + round(v_program.registration_fee,2);
  END IF;

  v_accommodation_rate := NULL;
  v_accommodation_total := 0;
  IF v_accommodation_id IS NOT NULL THEN
    IF v_accommodation_weeks IS NULL THEN v_accommodation_weeks := v_program_weeks; END IF;
    v_accommodation_rate := public.resolve_registration_weekly_rate(
      v_accommodation.price, v_accommodation.price_tiers, v_accommodation_weeks
    );
    IF v_accommodation_rate IS NULL OR v_accommodation_rate <= 0 THEN
      RAISE EXCEPTION 'Selected accommodation has no valid price for this duration';
    END IF;
    v_accommodation_total := round(v_accommodation_rate * v_accommodation_weeks, 2);
    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'kind','accommodation',
        'name_en',v_accommodation.name_en,
        'name_ar',v_accommodation.name_ar,
        'room_type',v_accommodation.room_type,
        'meals',v_accommodation.meals,
        'weeks',v_accommodation_weeks,
        'weekly_price',v_accommodation_rate,
        'total',v_accommodation_total,
        'currency',v_currency,
        'deposit',COALESCE(v_accommodation.deposit,0),
        'placement_fee',COALESCE(v_accommodation.placement_fee,0)
      )
    );
    v_subtotal := v_subtotal + v_accommodation_total;

    IF COALESCE(v_accommodation.placement_fee,0) > 0 THEN
      v_items := v_items || jsonb_build_array(
        jsonb_build_object(
          'kind','accommodation_placement_fee',
          'name_en','Accommodation placement fee',
          'name_ar','رسوم ترتيب السكن',
          'weeks',1,
          'weekly_price',v_accommodation.placement_fee,
          'total',round(v_accommodation.placement_fee,2),
          'currency',v_currency
        )
      );
      v_subtotal := v_subtotal + round(v_accommodation.placement_fee,2);
    END IF;
  END IF;

  v_age := extract(year from age(current_date, v_date_of_birth))::integer;

  v_insurance_total := 0;
  IF v_insurance_id IS NOT NULL THEN
    IF v_age IS NULL THEN RAISE EXCEPTION 'Date of birth is required when insurance is selected'; END IF;
    v_insurance_rate := public.resolve_registration_insurance_monthly_rate(
      v_insurance.price, v_insurance.age_price_tiers, v_age
    );
    v_insurance_months := GREATEST(1, CEIL(v_program_weeks / 4.33)::integer);
    IF v_insurance_rate IS NULL OR v_insurance_rate <= 0 THEN
      RAISE EXCEPTION 'Selected insurance has no valid price';
    END IF;
    -- Only a monthly-billed product is charged per month; a one_time premium is
    -- a single payment regardless of course length (mirrors insurancePricing.ts
    -- and the canonical case_submissions calculation).
    v_insurance_billing := COALESCE(NULLIF(v_insurance.billing_period,''),'monthly');
    IF v_insurance_billing = 'monthly' THEN
      v_insurance_total := round(v_insurance_rate * v_insurance_months, 2);
    ELSE
      v_insurance_months := 1;
      v_insurance_total := round(v_insurance_rate, 2);
    END IF;
    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'kind','insurance',
        'name_en',v_insurance.name,
        'name_ar',v_insurance.name,
        'billing_period',v_insurance_billing,
        'months',v_insurance_months,
        'monthly_price',v_insurance_rate,
        'total',v_insurance_total,
        'currency',v_currency
      )
    );
    v_subtotal := v_subtotal + v_insurance_total;
  END IF;

  v_first_name := NULLIF(btrim(p_data->>'first_name'),'');
  v_middle_name := NULLIF(btrim(p_data->>'middle_name'),'');
  v_last_name := NULLIF(btrim(p_data->>'last_name'),'');
  v_full_address := NULLIF(btrim(p_data->>'address'),'');
  v_emergency_name := NULLIF(btrim(p_data->>'emergency_contact_name'),'');
  v_emergency_phone := NULLIF(btrim(p_data->>'emergency_contact_phone'),'');
  v_gender := NULLIF(btrim(p_data->>'gender'),'');
  v_city_of_birth := NULLIF(btrim(p_data->>'city_of_birth'),'');
  v_nationality := NULLIF(btrim(p_data->>'nationality'),'');
  v_passport_type := NULLIF(btrim(p_data->>'passport_type'),'');
  v_education_level := NULLIF(btrim(p_data->>'education_level'),'');
  v_english_units := NULLIF(p_data->>'english_units','')::integer;
  v_math_units := NULLIF(p_data->>'math_units','')::integer;
  v_english_level := NULLIF(btrim(p_data->>'english_level'),'');
  v_major := NULLIF(btrim(p_data->>'degree_interest'),'');
  v_major_id := NULLIF(p_data->>'preferred_major_id','')::uuid;

  IF v_english_units IS NOT NULL AND (v_english_units < 1 OR v_english_units > 5) THEN
    RAISE EXCEPTION 'Invalid English units';
  END IF;
  IF v_math_units IS NOT NULL AND (v_math_units < 1 OR v_math_units > 5) THEN
    RAISE EXCEPTION 'Invalid Math units';
  END IF;

  INSERT INTO public.cases (
    full_name, phone_number, city, education_level, passport_type,
    degree_interest, preferred_major_id, referred_by, source, status
  )
  VALUES (
    v_name, v_phone, NULLIF(p_data->>'city',''),
    v_education_level, v_passport_type, v_major, v_major_id,
    p_referrer_user_id, 'student_referral_registration', 'new'
  )
  RETURNING * INTO v_case;

  v_case_ref := v_case.case_reference;

  INSERT INTO public.referrals (
    referrer_user_id, referred_case_id, referred_name, referred_phone,
    discount_applied, referral_type, status
  )
  VALUES (
    p_referrer_user_id, v_case.id, v_name, v_phone,
    false, v_type, 'pending'
  )
  RETURNING * INTO v_referral;

  INSERT INTO public.case_submissions (
    case_id, school_id, program_id, accommodation_id, insurance_id,
    program_start_date, program_end_date, profile_completed_at,
    program_weeks, program_weekly_price, program_price,
    accommodation_weeks, accommodation_weekly_price, accommodation_price,
    insurance_price, payment_confirmed, student_email, student_phone,
    extra_data, review_status, submitted_at, submitted_by
  )
  VALUES (
    v_case.id, v_school_id, v_program_id, v_accommodation_id, v_insurance_id,
    v_start_date, v_program_end_date, now(),
    v_program_weeks, v_program_rate, v_program_total,
    v_accommodation_weeks, v_accommodation_rate, v_accommodation_total,
    v_insurance_total, false, v_email, v_phone,
    jsonb_build_object(
      'registration_source','student_referral',
      'referral_id',v_referral.id,
      'referrer_user_id',p_referrer_user_id,
      'referral_type',v_type,
      'first_name',v_first_name,
      'middle_name',v_middle_name,
      'last_name',v_last_name,
      'date_of_birth',p_data->>'date_of_birth',
      'gender',v_gender,
      'city_of_birth',v_city_of_birth,
      'nationality',v_nationality,
      'passport_type',v_passport_type,
      'education_level',v_education_level,
      'english_units',v_english_units,
      'math_units',v_math_units,
      'english_level',v_english_level,
      'degree_interest',v_major,
      'preferred_major_id',v_major_id,
      'emergency_contact_name',v_emergency_name,
      'emergency_contact_phone',v_emergency_phone,
      'address',v_full_address,
      'street',p_data->>'street',
      'house_no',p_data->>'house_number',
      'postcode',p_data->>'postcode',
      'city',p_data->>'city',
      'accommodation_weeks',v_accommodation_weeks,
      'locale',v_locale
    ),
    'draft', NULL, NULL
  );

  INSERT INTO public.case_registration_invoices (
    case_id, invoice_number, student_name, student_email,
    referrer_user_id, referral_type, referrer_name,
    school_id, program_id, accommodation_id,
    program_weeks, accommodation_weeks, currency,
    subtotal, discount_amount, total_amount, items, locale,
    status, payment_status, due_at
  )
  VALUES (
    v_case.id,
    'DRB-REG-' || to_char(current_date,'YYYY') || '-' ||
      lpad(nextval('public.case_registration_invoice_seq')::text, 6, '0'),
    v_name, v_email, p_referrer_user_id, v_type, v_referrer.full_name,
    v_school_id, v_program_id, v_accommodation_id,
    v_program_weeks, v_accommodation_weeks, v_currency,
    round(v_subtotal,2), 0, round(v_subtotal,2), v_items, v_locale,
    'issued', 'pending', now() + interval '7 days'
  )
  RETURNING * INTO v_invoice;

  PERFORM public.log_case_event(
    v_case.id,
    'student_referral_registration_created',
    jsonb_build_object(
      'referral_id',v_referral.id,
      'referrer_user_id',p_referrer_user_id,
      'referrer_name',v_referrer.full_name,
      'referral_type',v_type,
      'invoice_id',v_invoice.id,
      'invoice_number',v_invoice.invoice_number,
      'total',v_invoice.total_amount,
      'currency',v_invoice.currency
    ),
    false
  );

  RETURN jsonb_build_object(
    'case_id',v_case.id,
    'case_reference',v_case_ref,
    'referral_id',v_referral.id,
    'invoice_id',v_invoice.id,
    'invoice_number',v_invoice.invoice_number,
    'public_token',v_invoice.public_token,
    'student_name',v_name,
    'student_email',v_email,
    'referrer_name',v_referrer.full_name,
    'referral_type',v_type,
    'total_amount',v_invoice.total_amount,
    'currency',v_invoice.currency,
    'locale',v_locale
  );
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid registration identifier';
END;
$$;

REVOKE ALL ON FUNCTION public.create_student_referral_registration_internal(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_student_referral_registration_internal(uuid,jsonb) TO service_role;
