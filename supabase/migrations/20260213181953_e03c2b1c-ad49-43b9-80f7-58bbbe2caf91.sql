
-- Phase 1: Add new columns to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS passport_type text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS english_units integer;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS math_units integer;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS eligibility_reason text;

-- Add paid_at to student_cases for 20-day timer
ALTER TABLE public.student_cases ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone;

-- Add must_change_password to profiles for forced password change
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Replace insert_lead_from_apply with new version that includes eligibility calculation
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
  p_source_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_score integer := 0;
  v_reasons text[] := ARRAY[]::text[];
  v_status text := 'new';
BEGIN
  -- Calculate eligibility score
  -- Passport type
  IF p_passport_type = 'israeli_blue' THEN
    v_score := v_score + 30;
  ELSIF p_passport_type = 'israeli_red' THEN
    v_score := v_score + 20;
  ELSE
    v_reasons := array_append(v_reasons, 'Passport: ' || COALESCE(p_passport_type, 'unknown'));
  END IF;

  -- English units
  IF COALESCE(p_english_units, 0) >= 4 THEN
    v_score := v_score + 20;
  ELSE
    v_reasons := array_append(v_reasons, 'English units: ' || COALESCE(p_english_units::text, '0') || ' (min 4)');
  END IF;

  -- Math units
  IF COALESCE(p_math_units, 0) >= 4 THEN
    v_score := v_score + 20;
  ELSE
    v_reasons := array_append(v_reasons, 'Math units: ' || COALESCE(p_math_units::text, '0') || ' (min 4)');
  END IF;

  -- Education level
  IF p_education_level IN ('bagrut', 'bachelor', 'master') THEN
    v_score := v_score + 10;
  END IF;

  -- German level
  IF p_german_level IN ('intermediate', 'advanced') THEN
    v_score := v_score + 10;
  END IF;

  -- Determine status
  IF v_score < 30 THEN
    v_status := 'not_eligible';
  END IF;

  -- Try to update existing lead by phone
  UPDATE leads
  SET
    full_name = p_full_name,
    passport_type = p_passport_type,
    english_units = p_english_units,
    math_units = p_math_units,
    city = p_city,
    education_level = p_education_level,
    german_level = p_german_level,
    budget_range = p_budget_range,
    preferred_city = p_preferred_city,
    accommodation = p_accommodation,
    source_type = p_source_type,
    source_id = p_source_id,
    eligibility_score = v_score,
    eligibility_reason = array_to_string(v_reasons, '; '),
    status = v_status,
    created_at = now()
  WHERE phone = p_phone;

  -- If no row was updated, insert a new one
  IF NOT FOUND THEN
    INSERT INTO leads (full_name, phone, passport_type, english_units, math_units, city, education_level, german_level, budget_range, preferred_city, accommodation, source_type, source_id, status, eligibility_score, eligibility_reason)
    VALUES (p_full_name, p_phone, p_passport_type, p_english_units, p_math_units, p_city, p_education_level, p_german_level, p_budget_range, p_preferred_city, p_accommodation, p_source_type, p_source_id, v_status, v_score, array_to_string(v_reasons, '; '));
  END IF;
END;
$$;

-- Add RLS policy for lawyers to view leads for their assigned cases
CREATE POLICY "Lawyers can view leads for assigned cases"
ON public.leads
FOR SELECT
USING (
  has_role(auth.uid(), 'lawyer'::app_role) AND
  EXISTS (
    SELECT 1 FROM student_cases sc
    WHERE sc.lead_id = leads.id AND sc.assigned_lawyer_id = auth.uid()
  )
);
