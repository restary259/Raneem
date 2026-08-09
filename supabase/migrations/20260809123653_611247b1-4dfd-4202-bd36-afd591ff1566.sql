ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_onboarding_state text NOT NULL DEFAULT 'not_seen',
  ADD COLUMN IF NOT EXISTS push_onboarding_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('t_24h','t_1h')),
  due_at timestamptz NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, recipient_id, kind)
);

GRANT SELECT ON public.appointment_reminders TO authenticated;
GRANT ALL ON public.appointment_reminders TO service_role;

ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and owners can view reminders"
ON public.appointment_reminders FOR SELECT TO authenticated
USING (recipient_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.sync_appointment_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Always drop pending reminders for this appointment; they are rebuilt below
  -- when the appointment is still active and in the future.
  DELETE FROM public.appointment_reminders
   WHERE appointment_id = NEW.id AND sent_at IS NULL;

  IF NEW.team_member_id IS NULL
     OR NEW.scheduled_at IS NULL
     OR NEW.outcome IS NOT NULL
     OR NEW.rescheduled_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.scheduled_at - interval '24 hours' > now() THEN
    INSERT INTO public.appointment_reminders (appointment_id, recipient_id, kind, due_at)
    VALUES (NEW.id, NEW.team_member_id, 't_24h', NEW.scheduled_at - interval '24 hours')
    ON CONFLICT DO NOTHING;
  END IF;

  IF NEW.scheduled_at - interval '1 hour' > now() THEN
    INSERT INTO public.appointment_reminders (appointment_id, recipient_id, kind, due_at)
    VALUES (NEW.id, NEW.team_member_id, 't_1h', NEW.scheduled_at - interval '1 hour')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_appointment_reminders ON public.appointments;
CREATE TRIGGER trg_sync_appointment_reminders
AFTER INSERT OR UPDATE OF scheduled_at, team_member_id, outcome, rescheduled_to
ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_reminders();