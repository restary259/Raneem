
-- Stage 1: Add visa-critical fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS eye_color text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_changed_legal_name boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS previous_legal_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_criminal_record boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS criminal_record_details text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_dual_citizenship boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS second_passport_country text;

-- Stage 2: Create trigger function to notify influencer on case creation
CREATE OR REPLACE FUNCTION public.notify_influencer_case_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead RECORD;
BEGIN
  SELECT * INTO v_lead FROM leads WHERE id = NEW.lead_id;
  
  IF v_lead.source_type = 'influencer' AND v_lead.source_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, source, metadata)
    VALUES (
      v_lead.source_id,
      'New Case Created',
      'A new case has been created for ' || COALESCE(NEW.student_full_name, v_lead.full_name, 'a student') || ' from your lead.',
      'case_created',
      jsonb_build_object('case_id', NEW.id, 'lead_id', NEW.lead_id, 'student_name', COALESCE(NEW.student_full_name, v_lead.full_name))
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER trg_notify_influencer_case_created
  AFTER INSERT ON public.student_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_influencer_case_created();
