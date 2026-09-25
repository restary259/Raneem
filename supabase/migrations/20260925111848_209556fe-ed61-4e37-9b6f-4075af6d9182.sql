ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled';
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show'));

UPDATE public.appointments SET status = CASE
  WHEN outcome = 'completed' THEN 'completed'
  WHEN outcome = 'no_show' THEN 'no_show'
  WHEN outcome IN ('cancelled','rescheduled','delayed') THEN 'cancelled'
  ELSE status END;

CREATE OR REPLACE FUNCTION public.sync_appointment_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.outcome IS DISTINCT FROM OLD.outcome AND NEW.outcome IS NOT NULL THEN
    NEW.status := CASE
      WHEN NEW.outcome = 'completed' THEN 'completed'
      WHEN NEW.outcome = 'no_show' THEN 'no_show'
      ELSE 'cancelled' END;
  END IF;
  IF NEW.rescheduled_to IS NOT NULL AND NEW.status IN ('scheduled','confirmed') THEN
    NEW.status := 'cancelled';
  END IF;
  -- An ended appointment (or one moved to a new time) must never get a
  -- future WhatsApp reminder for its old time.
  IF NEW.status IN ('completed','cancelled','no_show')
     OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    UPDATE public.whatsapp_follow_up_tasks t
       SET status = 'cancelled', last_error = 'appointment_' || NEW.status, updated_at = now()
      FROM public.whatsapp_conversations c
      JOIN public.whatsapp_leads l ON l.id = c.lead_id
     WHERE t.conversation_id = c.id
       AND l.linked_case_id = NEW.case_id
       AND t.origin = 'appointment'
       AND t.status = 'pending'
       AND t.due_at = OLD.scheduled_at - interval '24 hours';
    DELETE FROM public.appointment_reminders
     WHERE appointment_id = NEW.id AND sent_at IS NULL
       AND (NEW.status IN ('completed','cancelled','no_show'));
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_appointment_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_appointment_status ON public.appointments;
CREATE TRIGGER trg_sync_appointment_status BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_status();