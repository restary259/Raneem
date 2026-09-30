-- DARB Student "Refer & Register" registration + invoice/payment workflow.
--
-- This migration deliberately keeps the existing DARB agency-service invoice and
-- case_payments finance contract untouched. Student referrals create their
-- registration (course/accommodation) invoice and payment records in dedicated
-- tables, all anchored to the same master cases.id.

ALTER TABLE public.cases
  DROP CONSTRAINT IF EXISTS cases_source_check;

ALTER TABLE public.cases
  ADD CONSTRAINT cases_source_check
  CHECK (source = ANY (ARRAY[
    'apply_page',
    'manual',
    'submit_new_student',
    'social_media_partner',
    'referral',
    'student_referral_registration',
    'contact_form',
    'public_booking'
  ]));

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS registration_payment_bank_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS registration_payment_account_holder text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS registration_payment_iban text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS registration_payment_bic text NOT NULL DEFAULT '';

CREATE SEQUENCE IF NOT EXISTS public.case_registration_invoice_seq;

CREATE TABLE IF NOT EXISTS public.case_registration_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL UNIQUE REFERENCES public.cases(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE,
  public_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  student_name text NOT NULL,
  student_email text NOT NULL,
  referrer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_type text CHECK (referral_type IS NULL OR referral_type IN ('friend','family')),
  referrer_name text,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL,
  accommodation_id uuid REFERENCES public.accommodations(id) ON DELETE SET NULL,
  program_weeks integer NOT NULL CHECK (program_weeks > 0),
  accommodation_weeks integer,
  currency text NOT NULL DEFAULT 'EUR',
  subtotal numeric NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_amount numeric NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount numeric NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  locale text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued','paid','cancelled')),
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','submitted','paid','failed','refunded')),
  due_at timestamptz,
  issued_at timestamptz NOT NULL DEFAULT now(),
  email_status text NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending','sent','failed')),
  email_error text,
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS case_registration_invoices_referrer_idx
  ON public.case_registration_invoices(referrer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS case_registration_invoices_payment_status_idx
  ON public.case_registration_invoices(payment_status, created_at DESC);

ALTER TABLE public.case_registration_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage registration invoices" ON public.case_registration_invoices;
CREATE POLICY "Admins manage registration invoices"
  ON public.case_registration_invoices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Assigned team read registration invoices" ON public.case_registration_invoices;
CREATE POLICY "Assigned team read registration invoices"
  ON public.case_registration_invoices FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_registration_invoices.case_id
      AND c.assigned_to = auth.uid()
  ));

DROP POLICY IF EXISTS "Referral owners read registration invoices" ON public.case_registration_invoices;
CREATE POLICY "Referral owners read registration invoices"
  ON public.case_registration_invoices FOR SELECT TO authenticated
  USING (
    referrer_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_registration_invoices.case_id
        AND c.student_user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS update_case_registration_invoices_updated_at
  ON public.case_registration_invoices;
CREATE TRIGGER update_case_registration_invoices_updated_at
  BEFORE UPDATE ON public.case_registration_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.case_registration_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.case_registration_invoices(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  payment_method text NOT NULL CHECK (payment_method IN ('card','bank_transfer','manual')),
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','submitted','confirmed','failed','refunded')),
  reference text,
  provider_payment_id text,
  checkout_url text,
  receipt_path text,
  submitted_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS case_registration_payments_invoice_idx
  ON public.case_registration_payments(invoice_id, created_at DESC);

CREATE INDEX IF NOT EXISTS case_registration_payments_case_idx
  ON public.case_registration_payments(case_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS case_registration_card_provider_uq
  ON public.case_registration_payments(provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

ALTER TABLE public.case_registration_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage registration payments" ON public.case_registration_payments;
CREATE POLICY "Admins manage registration payments"
  ON public.case_registration_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Assigned team read registration payments" ON public.case_registration_payments;
CREATE POLICY "Assigned team read registration payments"
  ON public.case_registration_payments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_registration_payments.case_id
      AND c.assigned_to = auth.uid()
  ));

DROP POLICY IF EXISTS "Referral owners read registration payments" ON public.case_registration_payments;
CREATE POLICY "Referral owners read registration payments"
  ON public.case_registration_payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.case_registration_invoices i
      WHERE i.id = case_registration_payments.invoice_id
        AND (
          i.referrer_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.cases c
            WHERE c.id = i.case_id AND c.student_user_id = auth.uid()
          )
        )
    )
  );

DROP TRIGGER IF EXISTS update_case_registration_payments_updated_at
  ON public.case_registration_payments;
CREATE TRIGGER update_case_registration_payments_updated_at
  BEFORE UPDATE ON public.case_registration_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.resolve_registration_weekly_rate(
  p_base numeric,
  p_tiers jsonb,
  p_weeks integer
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN (t->>'price') ~ '^[0-9]+(\\.[0-9]+)?$' THEN (t->>'price')::numeric
        ELSE NULL
      END
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(COALESCE(p_tiers, '[]'::jsonb)) = 'array'
             THEN COALESCE(p_tiers, '[]'::jsonb)
             ELSE '[]'::jsonb END
      ) AS t
      WHERE (t->>'price') ~ '^[0-9]+(\\.[0-9]+)?$'
        AND COALESCE(NULLIF(t->>'from_weeks','')::integer, 1) <= p_weeks
        AND (
          NULLIF(t->>'to_weeks','') IS NULL
          OR NULLIF(t->>'to_weeks','')::integer >= p_weeks
        )
      ORDER BY COALESCE(NULLIF(t->>'from_weeks','')::integer, 1) DESC
      LIMIT 1
    ),
    NULLIF(p_base, 0)
  );
$$;

CREATE OR REPLACE FUNCTION public.resolve_registration_insurance_monthly_rate(
  p_base numeric,
  p_tiers jsonb,
  p_age integer
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN (t->>'price') ~ '^[0-9]+(\\.[0-9]+)?$' THEN (t->>'price')::numeric
        ELSE NULL
      END
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(COALESCE(p_tiers, '[]'::jsonb)) = 'array'
             THEN COALESCE(p_tiers, '[]'::jsonb)
             ELSE '[]'::jsonb END
      ) AS t
      WHERE (t->>'price') ~ '^[0-9]+(\\.[0-9]+)?$'
        AND COALESCE(NULLIF(t->>'from_age','')::integer, 0) <= p_age
        AND (
          NULLIF(t->>'to_age','') IS NULL
          OR NULLIF(t->>'to_age','')::integer >= p_age
        )
      ORDER BY COALESCE(NULLIF(t->>'from_age','')::integer, 0) DESC
      LIMIT 1
    ),
    NULLIF(p_base, 0)
  );
$$;

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
  v_start_month text;
  v_start_date date;
  v_program_end_date date;
  v_program_rate numeric;
  v_accommodation_rate numeric;
  v_insurance_rate numeric;
  v_insurance_months integer;
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

  IF v_email !~* '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  IF NOT (regexp_replace(v_phone, '\\D', '', 'g') ~ '^[0-9]{7,15}$') THEN
    RAISE EXCEPTION 'Invalid phone format';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.referrals r
     WHERE r.referrer_user_id = p_referrer_user_id
       AND regexp_replace(COALESCE(r.referred_phone,''), '\\D', '', 'g')
           = regexp_replace(v_phone, '\\D', '', 'g')
  ) THEN
    RAISE EXCEPTION 'This phone number has already been referred by you';
  END IF;

  SELECT c.id
    INTO v_existing
    FROM public.cases c
   WHERE c.deleted_at IS NULL
     AND (
       lower(COALESCE(c.email,'')) = v_email
       OR regexp_replace(c.phone_number, '\\D', '', 'g') =
          regexp_replace(v_phone, '\\D', '', 'g')
     )
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'This person already has a DARB case';
  END IF;

  v_school_id := NULLIF(p_data->>'school_id','')::uuid;
  v_program_id := NULLIF(p_data->>'program_id','')::uuid;
  v_accommodation_id := NULLIF(p_data->>'accommodation_id','')::uuid;
  v_insurance_id := NULLIF(p_data->>'insurance_id','')::uuid;
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

  IF v_start_month IS NULL OR v_start_month !~ '^\\d{4}-\\d{2}$' THEN
    RAISE EXCEPTION 'A valid start month is required';
  END IF;
  v_start_date := (v_start_month || '-01')::date;

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

  v_age := NULL;
  IF NULLIF(p_data->>'date_of_birth','') IS NOT NULL THEN
    BEGIN
      v_age := extract(year from age(current_date, (p_data->>'date_of_birth')::date))::integer;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid date of birth';
    END;
  END IF;

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
    v_insurance_total := round(v_insurance_rate * v_insurance_months, 2);
    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'kind','insurance',
        'name_en',v_insurance.name,
        'name_ar',v_insurance.name,
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
    full_name, phone_number, email, city, education_level, passport_type,
    degree_interest, preferred_major_id, referred_by, source, status
  )
  VALUES (
    v_name, v_phone, v_email, NULLIF(p_data->>'city',''),
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

CREATE OR REPLACE FUNCTION public.get_registration_invoice_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_invoice RECORD;
  v_bank RECORD;
  v_payment jsonb;
BEGIN
  SELECT i.*, c.case_reference
    INTO v_invoice
    FROM public.case_registration_invoices i
    JOIN public.cases c ON c.id = i.case_id
   WHERE i.public_token = trim(p_token)
   LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',p.id,
        'payment_method',p.payment_method,
        'amount',p.amount,
        'currency',p.currency,
        'status',p.status,
        'reference',p.reference,
        'submitted_at',p.submitted_at,
        'confirmed_at',p.confirmed_at
      )
      ORDER BY p.created_at DESC
    ),
    '[]'::jsonb
  )
    INTO v_payment
    FROM public.case_registration_payments p
   WHERE p.invoice_id = v_invoice.id;

  SELECT
    registration_payment_bank_name AS bank_name,
    registration_payment_account_holder AS account_holder,
    registration_payment_iban AS iban,
    registration_payment_bic AS bic
    INTO v_bank
    FROM public.platform_settings
   LIMIT 1;

  RETURN jsonb_build_object(
    'id',v_invoice.id,
    'invoice_number',v_invoice.invoice_number,
    'public_token',v_invoice.public_token,
    'case_id',v_invoice.case_id,
    'case_reference',v_invoice.case_reference,
    'student_name',v_invoice.student_name,
    'student_email',v_invoice.student_email,
    'referrer_name',v_invoice.referrer_name,
    'referral_type',v_invoice.referral_type,
    'school_id',v_invoice.school_id,
    'program_id',v_invoice.program_id,
    'accommodation_id',v_invoice.accommodation_id,
    'program_weeks',v_invoice.program_weeks,
    'accommodation_weeks',v_invoice.accommodation_weeks,
    'currency',v_invoice.currency,
    'subtotal',v_invoice.subtotal,
    'discount_amount',v_invoice.discount_amount,
    'total_amount',v_invoice.total_amount,
    'items',v_invoice.items,
    'locale',v_invoice.locale,
    'status',v_invoice.status,
    'payment_status',v_invoice.payment_status,
    'due_at',v_invoice.due_at,
    'issued_at',v_invoice.issued_at,
    'payments',v_payment,
    'bank_details',jsonb_build_object(
      'bank_name',COALESCE(v_bank.bank_name,''),
      'account_holder',COALESCE(v_bank.account_holder,''),
      'iban',COALESCE(v_bank.iban,''),
      'bic',COALESCE(v_bank.bic,'')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_registration_invoice_by_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_registration_bank_transfer(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_invoice RECORD;
  v_payment RECORD;
BEGIN
  SELECT * INTO v_invoice
    FROM public.case_registration_invoices
   WHERE public_token = trim(p_token)
   LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'Registration invoice not found'; END IF;
  IF v_invoice.status = 'cancelled' THEN RAISE EXCEPTION 'This invoice is cancelled'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.case_registration_payments
    WHERE invoice_id = v_invoice.id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'A card payment is already in progress';
  END IF;

  SELECT * INTO v_payment
    FROM public.case_registration_payments
   WHERE invoice_id = v_invoice.id
     AND payment_method = 'bank_transfer'
     AND status IN ('submitted','confirmed')
   ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'invoice_id',v_invoice.id,
      'payment_id',v_payment.id,
      'status',v_payment.status,
      'reference',COALESCE(v_payment.reference,v_invoice.case_reference)
    );
  END IF;

  INSERT INTO public.case_registration_payments (
    invoice_id, case_id, payment_method, amount, currency, status, reference, submitted_at
  )
  VALUES (
    v_invoice.id, v_invoice.case_id, 'bank_transfer', v_invoice.total_amount,
    v_invoice.currency, 'submitted', v_invoice.case_reference, now()
  )
  RETURNING * INTO v_payment;

  UPDATE public.case_registration_invoices
     SET payment_status = 'submitted', updated_at = now()
   WHERE id = v_invoice.id;

  RETURN jsonb_build_object(
    'invoice_id',v_invoice.id,
    'payment_id',v_payment.id,
    'status','submitted',
    'reference',v_payment.reference
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_registration_bank_transfer(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.confirm_registration_payment(
  p_payment_id uuid,
  p_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_payment RECORD;
  v_invoice RECORD;
  v_case RECORD;
  v_ref text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_payment
    FROM public.case_registration_payments
   WHERE id = p_payment_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;

  SELECT * INTO v_invoice
    FROM public.case_registration_invoices
   WHERE id = v_payment.invoice_id
   FOR UPDATE;

  SELECT id, assigned_to, status INTO v_case
    FROM public.cases WHERE id = v_payment.case_id;

  IF NOT (public.has_role(v_uid,'admin') OR v_case.assigned_to = v_uid) THEN
    RAISE EXCEPTION 'Not allowed to confirm this registration payment';
  END IF;

  IF v_payment.payment_method = 'card' THEN
    RAISE EXCEPTION 'Card payments are confirmed automatically';
  END IF;

  IF v_payment.status = 'confirmed' THEN
    RETURN jsonb_build_object(
      'payment_id',v_payment.id,
      'invoice_id',v_invoice.id,
      'case_id',v_case.id,
      'status','confirmed',
      'case_status',v_case.status
    );
  END IF;

  IF v_payment.amount <> v_invoice.total_amount OR v_payment.currency <> v_invoice.currency THEN
    RAISE EXCEPTION 'Payment amount does not match the invoice';
  END IF;

  v_ref := COALESCE(NULLIF(trim(p_reference),''), v_payment.reference, v_case.case_reference);

  UPDATE public.case_registration_payments
     SET status='confirmed', reference=v_ref, confirmed_by=v_uid,
         confirmed_at=now(), failure_reason=NULL, updated_at=now()
   WHERE id=v_payment.id;

  UPDATE public.case_registration_invoices
     SET status='paid', payment_status='paid', updated_at=now()
   WHERE id=v_invoice.id;

  IF v_case.status = 'new' THEN
    UPDATE public.cases SET status='profile_completion' WHERE id=v_case.id;
  END IF;

  PERFORM public.log_case_event(
    v_case.id,
    'registration_payment_confirmed',
    jsonb_build_object(
      'payment_id',v_payment.id,'invoice_id',v_invoice.id,
      'payment_method',v_payment.payment_method,'amount',v_payment.amount,
      'currency',v_payment.currency,'reference',v_ref,'confirmed_by',v_uid
    ),
    true
  );

  RETURN jsonb_build_object(
    'payment_id',v_payment.id,
    'invoice_id',v_invoice.id,
    'case_id',v_case.id,
    'status','confirmed',
    'case_status',CASE WHEN v_case.status='new' THEN 'profile_completion' ELSE v_case.status END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_registration_payment(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_registration_card_payment_internal(
  p_payment_id uuid,
  p_provider_payment_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_payment RECORD;
  v_invoice RECORD;
  v_case RECORD;
BEGIN
  IF NULLIF(trim(p_provider_payment_id),'') IS NULL THEN
    RAISE EXCEPTION 'Provider payment id is required';
  END IF;

  SELECT * INTO v_payment FROM public.case_registration_payments WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;

  SELECT * INTO v_invoice FROM public.case_registration_invoices WHERE id=v_payment.invoice_id FOR UPDATE;
  SELECT id,status INTO v_case FROM public.cases WHERE id=v_payment.case_id;

  IF v_payment.payment_method <> 'card' THEN
    RAISE EXCEPTION 'This payment record is not a card payment';
  END IF;

  IF v_payment.amount <> v_invoice.total_amount OR v_payment.currency <> v_invoice.currency THEN
    RAISE EXCEPTION 'Payment amount does not match the invoice';
  END IF;

  UPDATE public.case_registration_payments
     SET status='confirmed',
         provider_payment_id=trim(p_provider_payment_id),
         reference=COALESCE(reference,v_case.case_reference),
         confirmed_at=now(),
         failure_reason=NULL,
         updated_at=now()
   WHERE id=v_payment.id;

  UPDATE public.case_registration_invoices
     SET status='paid', payment_status='paid', updated_at=now()
   WHERE id=v_invoice.id;

  IF v_case.status='new' THEN
    UPDATE public.cases SET status='profile_completion' WHERE id=v_case.id;
  END IF;

  PERFORM public.log_case_event(
    v_case.id,
    'registration_payment_confirmed',
    jsonb_build_object(
      'payment_id',v_payment.id,'invoice_id',v_invoice.id,
      'payment_method','card','amount',v_payment.amount,
      'currency',v_payment.currency,'provider_payment_id',trim(p_provider_payment_id)
    ),
    true
  );

  RETURN jsonb_build_object(
    'payment_id',v_payment.id,'invoice_id',v_invoice.id,'case_id',v_case.id,
    'status','confirmed',
    'case_status',CASE WHEN v_case.status='new' THEN 'profile_completion' ELSE v_case.status END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_registration_card_payment_internal(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_registration_card_payment_internal(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_registration_invoice_email(
  p_invoice_id uuid,
  p_status text,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_case_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_status NOT IN ('pending','sent','failed') THEN RAISE EXCEPTION 'Invalid email status'; END IF;

  SELECT case_id INTO v_case_id FROM public.case_registration_invoices WHERE id=p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  IF NOT (
    public.has_role(v_uid,'admin')
    OR EXISTS (SELECT 1 FROM public.cases c WHERE c.id=v_case_id AND c.assigned_to=v_uid)
  ) THEN
    RAISE EXCEPTION 'Not allowed to update registration invoice email state';
  END IF;

  UPDATE public.case_registration_invoices
     SET email_status=p_status, email_error=p_error,
         email_sent_at=CASE WHEN p_status='sent' THEN now() ELSE email_sent_at END,
         updated_at=now()
   WHERE id=p_invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_registration_invoice_email(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_registration_payment_settings(
  p_bank_name text,
  p_account_holder text,
  p_iban text,
  p_bic text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'Only admins can update registration payment settings';
  END IF;

  UPDATE public.platform_settings
     SET registration_payment_bank_name=left(COALESCE(trim(p_bank_name),''),200),
         registration_payment_account_holder=left(COALESCE(trim(p_account_holder),''),200),
         registration_payment_iban=left(COALESCE(trim(p_iban),''),100),
         registration_payment_bic=left(COALESCE(trim(p_bic),''),50)
   WHERE id=(SELECT id FROM public.platform_settings LIMIT 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_registration_payment_settings(text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_registration_payment_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM public.log_case_event(
      NEW.case_id,
      'registration_payment_' || NEW.status,
      jsonb_build_object(
        'payment_id',NEW.id,'amount',NEW.amount,'currency',NEW.currency,
        'payment_method',NEW.payment_method,'reference',NEW.reference
      ),
      true
    );
  ELSIF TG_OP='UPDATE' AND (
    NEW.status IS DISTINCT FROM OLD.status OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
  ) THEN
    PERFORM public.log_case_event(
      NEW.case_id,
      'registration_payment_' || NEW.status,
      jsonb_build_object(
        'payment_id',NEW.id,'amount',NEW.amount,'currency',NEW.currency,
        'payment_method',NEW.payment_method,'reference',NEW.reference,
        'from_status',OLD.status
      ),
      true
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS case_registration_payments_audit ON public.case_registration_payments;
CREATE TRIGGER case_registration_payments_audit
AFTER INSERT OR UPDATE ON public.case_registration_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_registration_payment_audit();

GRANT ALL ON public.case_registration_invoices TO service_role;
GRANT ALL ON public.case_registration_payments TO service_role;
GRANT SELECT ON public.case_registration_invoices TO authenticated;
GRANT SELECT ON public.case_registration_payments TO authenticated;
