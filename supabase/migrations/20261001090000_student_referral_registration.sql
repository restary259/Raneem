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

-- Reconciliation with the out-of-band registration generation that already
-- exists on the live project. `CREATE TABLE IF NOT EXISTS` above is a NO-OP on
-- an existing table, so without this block the whole migration would still be
-- missing the columns and every payment RPC would raise 42703 at runtime (the
-- exact `case_payment_proofs.payment_id` failure mode recorded in AGENTS.md).
-- That pre-existing table names two of the same concepts differently:
--   registration_invoice_id  == this feature's invoice_id
--   stripe_session_id        == this feature's provider_payment_id
-- and carries its own bank_reference / payment_reference / notes. Detect it and
-- additively bridge the two so both the legacy and the new code paths work.
DO $reconcile$
DECLARE
  v_legacy boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'case_registration_payments'
       AND column_name = 'registration_invoice_id'
  ) INTO v_legacy;

  IF v_legacy THEN
    -- Name bridge: keep the existing NOT NULL column as the FK to the invoice
    -- and mirror it into the new invoice_id, instead of creating a second
    -- nullable column that nothing keeps in sync.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'case_registration_payments'
         AND column_name = 'invoice_id'
    ) THEN
      ALTER TABLE public.case_registration_payments
        RENAME COLUMN registration_invoice_id TO invoice_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'case_registration_payments'
         AND column_name = 'provider_payment_id'
    ) THEN
      ALTER TABLE public.case_registration_payments
        RENAME COLUMN stripe_session_id TO provider_payment_id;
    END IF;
  END IF;

  -- The canonical table declares `reference`, but the live generation names the
  -- same value `payment_reference`. Bridge it so the new RPCs (which read and
  -- write `reference`) do not raise 42703 on the live table.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'case_registration_payments'
       AND column_name = 'payment_reference'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'case_registration_payments'
       AND column_name = 'reference'
  ) THEN
    ALTER TABLE public.case_registration_payments
      RENAME COLUMN payment_reference TO reference;
  END IF;

  -- Additive: the remaining feature columns plus the legacy extras. Written
  -- without column-level NOT NULL constraints so this block is idempotent on
  -- every project shape (the authoritative constraint lives on the freshly
  -- created path above; the bridge only needs to be usable).
  ALTER TABLE public.case_registration_payments
    ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.case_registration_invoices(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS provider_payment_id text,
    ADD COLUMN IF NOT EXISTS checkout_url text,
    ADD COLUMN IF NOT EXISTS receipt_path text,
    ADD COLUMN IF NOT EXISTS failure_reason text,
    ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS bank_reference text,
    ADD COLUMN IF NOT EXISTS notes text,
    ADD COLUMN IF NOT EXISTS reference text,
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
END
$reconcile$;

CREATE INDEX IF NOT EXISTS case_registration_payments_invoice_idx
  ON public.case_registration_payments(invoice_id, created_at DESC);

CREATE INDEX IF NOT EXISTS case_registration_payments_case_idx
  ON public.case_registration_payments(case_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS case_registration_card_provider_uq
  ON public.case_registration_payments(provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

-- One collectible payment path per registration invoice. A submitted bank-transfer
-- acknowledgement is intentionally not collectible yet, so the student can switch
-- back to card without being permanently blocked by an unverified declaration.
CREATE UNIQUE INDEX IF NOT EXISTS case_registration_one_active_payment_uq
  ON public.case_registration_payments(invoice_id)
  WHERE status IN ('pending','confirmed');

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

-- Legacy out-of-band generation of the registration RPCs already exists on the
-- live project with DIFFERENT parameter NAMES for the same signatures. Postgres
-- refuses `CREATE OR REPLACE FUNCTION` when an input parameter is renamed
-- ("cannot change name of input parameter"), which aborts the whole file before
-- any payment RPC is (re)created. Drop the legacy signatures first; each is
-- recreated below. `IF EXISTS` makes this a no-op on a fresh project.
DROP FUNCTION IF EXISTS public.resolve_registration_weekly_rate(numeric, jsonb, integer);
DROP FUNCTION IF EXISTS public.resolve_registration_insurance_monthly_rate(numeric, jsonb, integer);
DROP FUNCTION IF EXISTS public.get_registration_catalog(uuid);
DROP FUNCTION IF EXISTS public.create_student_referral_registration_internal(uuid, jsonb);
DROP FUNCTION IF EXISTS public.get_registration_invoice_by_token(text);
DROP FUNCTION IF EXISTS public.submit_registration_bank_transfer(text);
DROP FUNCTION IF EXISTS public.create_registration_card_payment_internal(uuid);
DROP FUNCTION IF EXISTS public.confirm_registration_payment(uuid, text);
DROP FUNCTION IF EXISTS public.mark_registration_invoice_email(uuid, text, text);
DROP FUNCTION IF EXISTS public.update_registration_payment_settings(text, text, text, text);
-- Superseded legacy overloads of the same RPC name. They are written against the
-- legacy column names (registration_invoice_id / stripe_session_id /
-- payment_reference) that the reconcile block above renames, so they would raise
-- 42703 if anything still called them. The new signatures are created below.
DROP FUNCTION IF EXISTS public.confirm_registration_card_payment_internal(uuid, text, text);
DROP FUNCTION IF EXISTS public.fail_registration_card_payment_internal(uuid, text, text);
DROP FUNCTION IF EXISTS public.resolve_registration_insurance_monthly_rate(jsonb, integer);

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
        WHEN (t->>'price') ~ '^[0-9]+(\.[0-9]+)?$' THEN (t->>'price')::numeric
        ELSE NULL
      END
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(COALESCE(p_tiers, '[]'::jsonb)) = 'array'
             THEN COALESCE(p_tiers, '[]'::jsonb)
             ELSE '[]'::jsonb END
      ) AS t
      WHERE (t->>'price') ~ '^[0-9]+(\.[0-9]+)?$'
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
        WHEN (t->>'price') ~ '^[0-9]+(\.[0-9]+)?$' THEN (t->>'price')::numeric
        ELSE NULL
      END
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(COALESCE(p_tiers, '[]'::jsonb)) = 'array'
             THEN COALESCE(p_tiers, '[]'::jsonb)
             ELSE '[]'::jsonb END
      ) AS t
      WHERE (t->>'price') ~ '^[0-9]+(\.[0-9]+)?$'
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

CREATE OR REPLACE FUNCTION public.get_registration_catalog(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_programs jsonb;
  v_accommodations jsonb;
BEGIN
  IF p_school_id IS NULL THEN
    RETURN jsonb_build_object('programs','[]'::jsonb,'accommodations','[]'::jsonb);
  END IF;

  -- `programs` / `accommodations` SELECT policies only cover team_member and
  -- admin, so a student cannot read the catalog directly. This function exposes
  -- exactly the columns the registration form needs for one school, never a
  -- wildcard, and only active rows.
  SELECT COALESCE(jsonb_agg(to_jsonb(p) - 'created_at' - 'updated_at' ORDER BY p.name_en), '[]'::jsonb)
    INTO v_programs
    FROM (
      SELECT id,name_en,name_ar,description_en,description_ar,cefr_range,
             lessons_per_week,hours_per_week,price,currency,price_tiers,
             registration_fee,school_id
        FROM public.programs
       WHERE is_active = true AND school_id = p_school_id
    ) p;

  SELECT COALESCE(jsonb_agg(to_jsonb(a) - 'created_at' - 'updated_at' ORDER BY a.name_en), '[]'::jsonb)
    INTO v_accommodations
    FROM (
      SELECT id,name_en,name_ar,description_en,description_ar,description,photos,
             room_type,meals,distance_note,deposit,placement_fee,price,currency,
             price_tiers,school_id
        FROM public.accommodations
       WHERE is_active = true AND school_id = p_school_id
    ) a;

  RETURN jsonb_build_object('programs',v_programs,'accommodations',v_accommodations);
END;
$$;

REVOKE ALL ON FUNCTION public.get_registration_catalog(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_registration_catalog(uuid) TO authenticated;

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

  -- `cases` has no email column (see create-case-from-apply: "cases has no
  -- email column"). The applicant email lives on case_submissions.student_email,
  -- so the duplicate check matches on that mirror instead of a column that does
  -- not exist — naming cases.email here raised 42703 and aborted every
  -- registration before the INSERT was ever reached.
  SELECT c.id
    INTO v_existing
    FROM public.cases c
    LEFT JOIN public.case_submissions cs ON cs.case_id = c.id
   WHERE c.deleted_at IS NULL
     AND (
       lower(COALESCE(cs.student_email,'')) = v_email
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

CREATE OR REPLACE FUNCTION public.create_registration_card_payment_internal(
  p_invoice_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_invoice RECORD;
  v_payment RECORD;
  v_submitted_bank RECORD;
BEGIN
  IF p_invoice_id IS NULL THEN RAISE EXCEPTION 'Invoice id is required'; END IF;

  SELECT i.*, c.case_reference INTO v_invoice
    FROM public.case_registration_invoices i
    JOIN public.cases c ON c.id = i.case_id
   WHERE i.id=p_invoice_id
   FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration invoice not found'; END IF;
  IF v_invoice.status='cancelled' THEN RAISE EXCEPTION 'This invoice is cancelled'; END IF;

  IF v_invoice.payment_status='paid'
     OR EXISTS (
       SELECT 1 FROM public.case_registration_payments
       WHERE invoice_id=v_invoice.id AND status='confirmed'
     ) THEN
    RETURN jsonb_build_object(
      'paid',true,
      'invoice_id',v_invoice.id,
      'payment_id',NULL
    );
  END IF;

  SELECT * INTO v_payment
    FROM public.case_registration_payments
   WHERE invoice_id=v_invoice.id
     AND status='pending'
   ORDER BY created_at DESC
   LIMIT 1;

  IF FOUND THEN
    IF v_payment.payment_method <> 'card' THEN
      RAISE EXCEPTION 'Another payment is already in progress for this invoice';
    END IF;

    RETURN jsonb_build_object(
      'paid',false,
      'invoice_id',v_invoice.id,
      'payment_id',v_payment.id,
      'status',v_payment.status,
      'checkout_url',v_payment.checkout_url
    );
  END IF;

  SELECT * INTO v_submitted_bank
    FROM public.case_registration_payments
   WHERE invoice_id=v_invoice.id
     AND payment_method='bank_transfer'
     AND status='submitted'
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    UPDATE public.case_registration_payments
       SET status='failed',
           failure_reason='replaced_by_card_checkout',
           updated_at=now()
     WHERE id=v_submitted_bank.id;
  END IF;

  INSERT INTO public.case_registration_payments (
    invoice_id, case_id, payment_method, amount, currency, status, reference
  )
  VALUES (
    v_invoice.id, v_invoice.case_id, 'card', v_invoice.total_amount,
    v_invoice.currency, 'pending', v_invoice.case_reference
  )
  RETURNING * INTO v_payment;

  UPDATE public.case_registration_invoices
     SET payment_status='pending', updated_at=now()
   WHERE id=v_invoice.id;

  RETURN jsonb_build_object(
    'paid',false,
    'invoice_id',v_invoice.id,
    'payment_id',v_payment.id,
    'status',v_payment.status,
    'checkout_url',v_payment.checkout_url
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_registration_card_payment_internal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_registration_card_payment_internal(uuid) TO service_role;

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
        'checkout_url',p.checkout_url,
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
  SELECT i.*, c.case_reference INTO v_invoice
    FROM public.case_registration_invoices i
    JOIN public.cases c ON c.id = i.case_id
   WHERE i.public_token = trim(p_token)
   FOR UPDATE OF i;

  IF NOT FOUND THEN RAISE EXCEPTION 'Registration invoice not found'; END IF;
  IF v_invoice.status = 'cancelled' THEN RAISE EXCEPTION 'This invoice is cancelled'; END IF;

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

  IF v_invoice.payment_status = 'paid'
     OR EXISTS (
       SELECT 1
       FROM public.case_registration_payments
       WHERE invoice_id = v_invoice.id
         AND status = 'confirmed'
     ) THEN
    RAISE EXCEPTION 'This registration has already been paid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.case_registration_payments
    WHERE invoice_id = v_invoice.id
      AND status IN ('pending','submitted','confirmed')
  ) THEN
    RAISE EXCEPTION 'Another payment is already in progress for this invoice';
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

  SELECT id, assigned_to, status, case_reference INTO v_case
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

  IF v_invoice.payment_status = 'paid'
     OR EXISTS (
       SELECT 1
       FROM public.case_registration_payments p
       WHERE p.invoice_id = v_invoice.id
         AND p.id <> v_payment.id
         AND p.status = 'confirmed'
     ) THEN
    RAISE EXCEPTION 'This registration has already been paid';
  END IF;

  IF v_payment.status <> 'submitted' THEN
    RAISE EXCEPTION 'Only submitted payments can be confirmed';
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
  SELECT id,status,case_reference INTO v_case FROM public.cases WHERE id=v_payment.case_id;

  IF v_payment.payment_method <> 'card' THEN
    RAISE EXCEPTION 'This payment record is not a card payment';
  END IF;

  IF v_payment.status = 'confirmed' THEN
    RETURN jsonb_build_object(
      'payment_id',v_payment.id,'invoice_id',v_invoice.id,'case_id',v_case.id,
      'status','confirmed',
      'case_status',CASE WHEN v_case.status='new' THEN 'profile_completion' ELSE v_case.status END
    );
  END IF;

  IF v_invoice.payment_status = 'paid'
     OR EXISTS (
       SELECT 1
       FROM public.case_registration_payments p
       WHERE p.invoice_id = v_invoice.id
         AND p.id <> v_payment.id
         AND p.status = 'confirmed'
     ) THEN
    RAISE EXCEPTION 'This registration has already been paid';
  END IF;

  IF v_payment.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending card payments can be confirmed';
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

CREATE OR REPLACE FUNCTION public.fail_registration_card_payment_internal(
  p_payment_id uuid,
  p_failure_reason text DEFAULT 'card_payment_failed'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_payment RECORD;
  v_invoice RECORD;
BEGIN
  SELECT * INTO v_payment
    FROM public.case_registration_payments
   WHERE id=p_payment_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;

  SELECT * INTO v_invoice
    FROM public.case_registration_invoices
   WHERE id=v_payment.invoice_id
   FOR UPDATE;

  IF v_payment.payment_method <> 'card' THEN
    RAISE EXCEPTION 'This payment record is not a card payment';
  END IF;

  IF v_payment.status = 'confirmed' THEN
    RETURN jsonb_build_object(
      'payment_id',v_payment.id,
      'invoice_id',v_invoice.id,
      'status','confirmed',
      'invoice_payment_status',v_invoice.payment_status
    );
  END IF;

  IF v_payment.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'payment_id',v_payment.id,
      'invoice_id',v_invoice.id,
      'status',v_payment.status,
      'invoice_payment_status',v_invoice.payment_status
    );
  END IF;

  UPDATE public.case_registration_payments
     SET status='failed',
         failure_reason=left(COALESCE(NULLIF(trim(p_failure_reason),''),'card_payment_failed'),500),
         updated_at=now()
   WHERE id=v_payment.id;

  IF v_invoice.payment_status <> 'paid'
     AND NOT EXISTS (
       SELECT 1
       FROM public.case_registration_payments p
       WHERE p.invoice_id=v_invoice.id
         AND p.id<>v_payment.id
         AND p.status IN ('pending','submitted','confirmed')
     ) THEN
    UPDATE public.case_registration_invoices
       SET payment_status='failed', updated_at=now()
     WHERE id=v_invoice.id;
  END IF;

  RETURN jsonb_build_object(
    'payment_id',v_payment.id,
    'invoice_id',v_invoice.id,
    'status','failed',
    'invoice_payment_status',(
      SELECT payment_status FROM public.case_registration_invoices WHERE id=v_invoice.id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fail_registration_card_payment_internal(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_registration_card_payment_internal(uuid,text) TO service_role;

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

-- ---------------------------------------------------------------------------
-- Stage transition: direct student registration enters at profile_completion.
--
-- The registration invoice was already paid when the case is created, so
-- confirm_registration_payment() / confirm_registration_card_payment() move
-- `new` straight to `profile_completion`. enforce_case_stage_transition()
-- (last redefined in 20260818090000) only allowed new -> contacted, so that
-- UPDATE raised STAGE_BLOCKED and rolled the whole confirmation back.
--
-- Redefined here verbatim from 20260818090000 with the single added edge.
-- This timestamp must stay newer than 20260818090000: re-running that older
-- file would drop the new edge again.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_case_stage_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appts int;
  v_pending int;
  v_profile_done timestamptz;
  v_paid boolean;
  v_review text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Service role (edge functions) and cancellation are always allowed.
  IF auth.role() = 'service_role' OR NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('new', 'forgotten', 'cancelled') AND NEW.status = 'contacted' THEN
    RETURN NEW;
  END IF;

  -- A paid direct registration starts the file directly; there is no intake
  -- call or appointment to record for it. Restricted to an admin or the case's
  -- assigned team member AND to cases that actually arrived through this flow
  -- with a paid registration invoice — an ordinary case must still pass through
  -- contacted / appointment_scheduled and record its appointment outcomes.
  IF OLD.status = 'new' AND NEW.status = 'profile_completion' THEN
    IF (public.has_role(auth.uid(), 'admin')
        OR EXISTS (
          SELECT 1 FROM public.cases c
           WHERE c.id = NEW.id AND c.assigned_to = auth.uid()
        ))
       AND EXISTS (
         SELECT 1
           FROM public.cases c
           JOIN public.case_registration_invoices i ON i.case_id = c.id
          WHERE c.id = NEW.id
            AND c.source = 'student_referral_registration'
            AND i.status = 'paid'
       ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'STAGE_BLOCKED: only a paid direct-registration case can start at profile_completion';
  END IF;

  IF OLD.status = 'contacted' AND NEW.status = 'appointment_scheduled' THEN
    SELECT count(*) INTO v_appts FROM public.appointments WHERE case_id = NEW.id;
    IF v_appts = 0 THEN
      RAISE EXCEPTION 'STAGE_BLOCKED: an appointment must be scheduled first';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'appointment_scheduled' AND NEW.status IN ('contacted', 'forgotten') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'appointment_scheduled' AND NEW.status = 'profile_completion' THEN
    SELECT count(*) INTO v_appts FROM public.appointments WHERE case_id = NEW.id;
    SELECT count(*) INTO v_pending FROM public.appointments WHERE case_id = NEW.id AND outcome IS NULL;
    IF v_appts = 0 OR v_pending > 0 THEN
      RAISE EXCEPTION 'STAGE_BLOCKED: record every appointment outcome first';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'profile_completion' AND NEW.status = 'payment_confirmed' THEN
    SELECT profile_completed_at INTO v_profile_done
      FROM public.case_submissions WHERE case_id = NEW.id;
    IF v_profile_done IS NULL THEN
      RAISE EXCEPTION 'STAGE_BLOCKED: the student file must be complete first';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'payment_confirmed' AND NEW.status = 'submitted' THEN
    SELECT payment_confirmed INTO v_paid FROM public.case_submissions WHERE case_id = NEW.id;
    IF COALESCE(v_paid, false) = false THEN
      RAISE EXCEPTION 'STAGE_BLOCKED: confirm the payment first';
    END IF;
    RETURN NEW;
  END IF;

  -- Admin sent the file back for corrections: reopen the profile step so the
  -- assigned team member can fix it and resubmit.
  IF OLD.status = 'submitted' AND NEW.status = 'profile_completion' THEN
    SELECT review_status INTO v_review FROM public.case_submissions WHERE case_id = NEW.id;
    IF v_review = 'changes_requested' OR public.has_role(auth.uid(), 'admin') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'STAGE_BLOCKED: only an administrator can reopen a submitted file';
  END IF;

  IF OLD.status = 'submitted' AND NEW.status = 'enrollment_paid' THEN
    IF public.has_role(auth.uid(), 'admin') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'STAGE_BLOCKED: only an administrator can complete enrollment';
  END IF;

  RAISE EXCEPTION 'STAGE_BLOCKED: % -> % is not an allowed transition', OLD.status, NEW.status;
END;
$$;

