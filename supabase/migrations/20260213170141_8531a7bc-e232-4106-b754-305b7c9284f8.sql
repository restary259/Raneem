
CREATE OR REPLACE FUNCTION public.insert_lead_from_apply(
  p_full_name text,
  p_phone text,
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
BEGIN
  -- Try to update existing lead by phone
  UPDATE leads
  SET
    full_name = p_full_name,
    city = p_city,
    education_level = p_education_level,
    german_level = p_german_level,
    budget_range = p_budget_range,
    preferred_city = p_preferred_city,
    accommodation = p_accommodation,
    source_type = p_source_type,
    source_id = p_source_id,
    created_at = now()
  WHERE phone = p_phone;

  -- If no row was updated, insert a new one
  IF NOT FOUND THEN
    INSERT INTO leads (full_name, phone, city, education_level, german_level, budget_range, preferred_city, accommodation, source_type, source_id, status, eligibility_score)
    VALUES (p_full_name, p_phone, p_city, p_education_level, p_german_level, p_budget_range, p_preferred_city, p_accommodation, p_source_type, p_source_id, 'new', 0);
  END IF;
END;
$$;
