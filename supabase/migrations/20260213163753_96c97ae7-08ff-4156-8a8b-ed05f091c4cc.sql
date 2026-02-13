
-- Add missing columns to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS service_requested text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS study_destination text;

-- Create upsert RPC function for contact form submissions
CREATE OR REPLACE FUNCTION public.upsert_lead_from_contact(
  p_full_name text,
  p_email text,
  p_phone text,
  p_study_destination text,
  p_service_requested text,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Try to update existing lead by phone
  UPDATE leads
  SET
    full_name = p_full_name,
    email = p_email,
    study_destination = p_study_destination,
    preferred_city = p_study_destination,
    service_requested = p_service_requested,
    notes = p_notes,
    created_at = now()
  WHERE phone = p_phone;

  -- If no row was updated, insert a new one
  IF NOT FOUND THEN
    INSERT INTO leads (full_name, email, phone, study_destination, preferred_city, service_requested, notes, status, eligibility_score, source_type)
    VALUES (p_full_name, p_email, p_phone, p_study_destination, p_study_destination, p_service_requested, p_notes, 'new', 0, 'contact_form');
  END IF;
END;
$$;
