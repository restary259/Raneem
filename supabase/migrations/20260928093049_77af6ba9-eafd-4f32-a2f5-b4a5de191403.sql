ALTER TABLE public.appointment_reminders ADD COLUMN IF NOT EXISTS push_sent_at timestamptz, ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
ALTER TABLE public.appointment_reminders DROP CONSTRAINT IF EXISTS appointment_reminders_kind_check;
ALTER TABLE public.appointment_reminders ADD CONSTRAINT appointment_reminders_kind_check CHECK (kind IN ('t_24h','t_1h','t_15m'));
CREATE OR REPLACE FUNCTION public.sync_appointment_reminders() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  DELETE FROM public.appointment_reminders WHERE appointment_id=NEW.id AND sent_at IS NULL;
  IF NEW.team_member_id IS NULL OR NEW.scheduled_at IS NULL OR NEW.outcome IS NOT NULL OR NEW.rescheduled_to IS NOT NULL OR (NEW.public_booking AND NEW.confirmation_status <> 'confirmed') THEN RETURN NEW; END IF;
  IF NEW.scheduled_at - interval '24 hours' > now() THEN INSERT INTO public.appointment_reminders (appointment_id,recipient_id,kind,due_at) VALUES(NEW.id,NEW.team_member_id,'t_24h',NEW.scheduled_at - interval '24 hours') ON CONFLICT DO NOTHING; END IF;
  IF NEW.scheduled_at - interval '1 hour' > now() THEN INSERT INTO public.appointment_reminders (appointment_id,recipient_id,kind,due_at) VALUES(NEW.id,NEW.team_member_id,'t_1h',NEW.scheduled_at - interval '1 hour') ON CONFLICT DO NOTHING; END IF;
  IF NEW.scheduled_at - interval '15 minutes' > now() THEN INSERT INTO public.appointment_reminders (appointment_id,recipient_id,kind,due_at) VALUES(NEW.id,NEW.team_member_id,'t_15m',NEW.scheduled_at - interval '15 minutes') ON CONFLICT DO NOTHING; END IF;
  RETURN NEW;
END $$;
INSERT INTO public.appointment_reminders (appointment_id,recipient_id,kind,due_at)
SELECT a.id,a.team_member_id,'t_15m',a.scheduled_at - interval '15 minutes' FROM public.appointments a
WHERE a.team_member_id IS NOT NULL AND a.outcome IS NULL AND a.rescheduled_to IS NULL
  AND a.scheduled_at - interval '15 minutes' > now()
  AND NOT (a.public_booking AND a.confirmation_status <> 'confirmed')
  AND NOT EXISTS (SELECT 1 FROM public.appointment_reminders r WHERE r.appointment_id=a.id AND r.kind='t_15m');