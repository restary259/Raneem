
-- ============================================================
-- PHASE 1: DATABASE SCHEMA EVOLUTION
-- ============================================================

-- 1A. Add new columns to leads table
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ref_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS arab48_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visa_history text,
  ADD COLUMN IF NOT EXISTS last_contacted timestamptz,
  ADD COLUMN IF NOT EXISTS student_portal_created boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS companion_lead_id uuid REFERENCES public.leads(id);

-- Create index on ref_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_leads_ref_code ON public.leads(ref_code);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source_id ON public.leads(source_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

-- 1B. Create sequence for ref_code generation
CREATE SEQUENCE IF NOT EXISTS public.leads_ref_seq START 1001;

-- Auto-generate ref_code on insert
CREATE OR REPLACE FUNCTION public.generate_lead_ref_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ref_code IS NULL THEN
    NEW.ref_code := 'DARB-' || LPAD(nextval('public.leads_ref_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leads_ref_code
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_lead_ref_code();

-- 1C. Create eligibility_config table
CREATE TABLE IF NOT EXISTS public.eligibility_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  weight integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.eligibility_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage eligibility config"
  ON public.eligibility_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view eligibility config"
  ON public.eligibility_config FOR SELECT
  TO authenticated
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_eligibility_config_updated_at
  BEFORE UPDATE ON public.eligibility_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 1D. Seed default eligibility weights
INSERT INTO public.eligibility_config (field_name, label, weight) VALUES
  ('passport_valid', 'Passport Status', 15),
  ('proof_of_funds', 'Proof of Funds', 15),
  ('language_level', 'Language Level', 10),
  ('education_level', 'Education Level', 10),
  ('no_visa_rejection', 'No Visa Rejection', 10),
  ('age_range', 'Age Range', 5),
  ('motivation', 'Motivation', 10),
  ('course_alignment', 'Course Alignment', 10),
  ('verified_contact', 'Verified Contact', 10),
  ('arab48_flag', 'Arab 48 Status', 5)
ON CONFLICT (field_name) DO NOTHING;

-- 1E. Create eligibility_thresholds table for configurable thresholds
CREATE TABLE IF NOT EXISTS public.eligibility_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eligible_min integer NOT NULL DEFAULT 70,
  review_min integer NOT NULL DEFAULT 40,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.eligibility_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage thresholds"
  ON public.eligibility_thresholds FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view thresholds"
  ON public.eligibility_thresholds FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.eligibility_thresholds (eligible_min, review_min) VALUES (70, 40)
ON CONFLICT DO NOTHING;

-- 1F. Update insert_lead_from_apply to handle companion leads
CREATE OR REPLACE FUNCTION public.insert_lead_from_apply(
  p_full_name text,
  p_phone text,
  p_passport_type text DEFAULT NULL,
  p_english_units integer DEFAULT NULL,
  p_math_units integer DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_education_level text DEFAULT NULL,
  p_german_level text DEFAULT NULL,
  p_budget_range text DEFAULT NULL,
  p_preferred_city text DEFAULT NULL,
  p_accommodation boolean DEFAULT false,
  p_source_type text DEFAULT 'organic',
  p_source_id uuid DEFAULT NULL,
  p_companion_name text DEFAULT NULL,
  p_companion_phone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_score integer := 0;
  v_reasons text[] := ARRAY[]::text[];
  v_status text := 'new';
  v_main_lead_id uuid;
  v_companion_lead_id uuid;
BEGIN
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

  -- Upsert main lead
  UPDATE leads
  SET full_name = p_full_name, passport_type = p_passport_type,
      english_units = p_english_units, math_units = p_math_units,
      city = p_city, education_level = p_education_level,
      german_level = p_german_level, budget_range = p_budget_range,
      preferred_city = p_preferred_city, accommodation = p_accommodation,
      source_type = p_source_type, source_id = p_source_id,
      eligibility_score = v_score, eligibility_reason = array_to_string(v_reasons, '; '),
      status = v_status, created_at = now()
  WHERE phone = p_phone
  RETURNING id INTO v_main_lead_id;

  IF NOT FOUND THEN
    INSERT INTO leads (full_name, phone, passport_type, english_units, math_units, city,
                       education_level, german_level, budget_range, preferred_city,
                       accommodation, source_type, source_id, status, eligibility_score, eligibility_reason)
    VALUES (p_full_name, p_phone, p_passport_type, p_english_units, p_math_units, p_city,
            p_education_level, p_german_level, p_budget_range, p_preferred_city,
            p_accommodation, p_source_type, p_source_id, v_status, v_score,
            array_to_string(v_reasons, '; '))
    RETURNING id INTO v_main_lead_id;
  END IF;

  -- Handle companion lead if provided
  IF p_companion_name IS NOT NULL AND p_companion_phone IS NOT NULL
     AND trim(p_companion_name) <> '' AND trim(p_companion_phone) <> '' THEN

    UPDATE leads
    SET full_name = trim(p_companion_name),
        source_type = p_source_type, source_id = p_source_id,
        companion_lead_id = v_main_lead_id,
        notes = 'Companion of ' || p_full_name || ' (' || p_phone || ')',
        created_at = now()
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

    -- Link main lead to companion
    UPDATE leads SET companion_lead_id = v_companion_lead_id WHERE id = v_main_lead_id;
  END IF;
END;
$$;

-- Keep the old 2-arg overload working (without passport fields)
-- Already exists, no changes needed for that overload
