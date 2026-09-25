ALTER TABLE public.whatsapp_leads DROP CONSTRAINT IF EXISTS whatsapp_leads_lead_stage_check;

CREATE OR REPLACE FUNCTION public.whatsapp_map_lead_stage(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p
    WHEN 'qualified' THEN 'contacted'
    WHEN 'consultation_booked' THEN 'appointment_scheduled'
    WHEN 'documents_pending' THEN 'profile_completion'
    WHEN 'application_in_progress' THEN 'submitted'
    WHEN 'won' THEN 'enrollment_paid'
    WHEN 'lost' THEN 'cancelled'
    ELSE p END
$$;

UPDATE public.whatsapp_leads SET lead_stage = public.whatsapp_map_lead_stage(lead_stage)
WHERE lead_stage IN ('qualified','consultation_booked','documents_pending','application_in_progress','won','lost');

ALTER TABLE public.whatsapp_leads ADD CONSTRAINT whatsapp_leads_lead_stage_check
  CHECK (lead_stage IN ('new','contacted','appointment_scheduled','profile_completion','payment_confirmed','submitted','enrollment_paid','forgotten','cancelled'));

-- Older automations still write legacy names; translate them to pipeline stages.
CREATE OR REPLACE FUNCTION public.whatsapp_leads_normalize_stage()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.lead_stage := public.whatsapp_map_lead_stage(NEW.lead_stage);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_whatsapp_leads_normalize_stage ON public.whatsapp_leads;
CREATE TRIGGER trg_whatsapp_leads_normalize_stage
  BEFORE INSERT OR UPDATE OF lead_stage ON public.whatsapp_leads
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_leads_normalize_stage();