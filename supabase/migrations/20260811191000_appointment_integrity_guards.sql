-- Appointment integrity guards.
--
-- P2.5 — Double-booking: the client picker disables conflicting slots, but the
--   manual "new appointment" form, the edit modal and the drag-to-reschedule all
--   write straight to the appointments table, so two appointments for the same
--   team member can overlap. A BEFORE trigger is the only place that can reject
--   a conflict for every write path.
--
-- P2.6 — Deleting the last appointment of a case stranded it in
--   appointment_scheduled even though there was no appointment anymore. An
--   AFTER DELETE trigger reverts such a case to contacted.

CREATE OR REPLACE FUNCTION public.enforce_appointment_no_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_start timestamptz;
  v_new_end timestamptz;
  v_conflict boolean;
BEGIN
  v_new_start := NEW.scheduled_at;
  v_new_end := NEW.scheduled_at + make_interval(mins => COALESCE(NEW.duration_minutes, 60));

  SELECT EXISTS (
    SELECT 1
      FROM public.appointments
     WHERE team_member_id = NEW.team_member_id
       AND id IS DISTINCT FROM NEW.id
       AND outcome IS DISTINCT FROM 'cancelled'
       AND outcome IS DISTINCT FROM 'no_show'
       AND scheduled_at < v_new_end
       AND (scheduled_at + make_interval(mins => COALESCE(duration_minutes, 60))) > v_new_start
  ) INTO v_conflict;

  IF v_conflict THEN
    RAISE EXCEPTION 'APPT_BLOCKED: this time overlaps an existing appointment for the same team member'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointment_no_overlap_ins ON public.appointments;
CREATE TRIGGER trg_appointment_no_overlap_ins
  BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_no_overlap();

DROP TRIGGER IF EXISTS trg_appointment_no_overlap_upd ON public.appointments;
CREATE TRIGGER trg_appointment_no_overlap_upd
  BEFORE UPDATE OF scheduled_at, duration_minutes, team_member_id ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_no_overlap();

-- ---------------------------------------------------------------------------
-- Revert the case to contacted when its last appointment is deleted.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revert_case_when_last_appointment_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining int;
BEGIN
  IF OLD.case_id IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT count(*) INTO v_remaining
    FROM public.appointments
   WHERE case_id = OLD.case_id;

  IF v_remaining = 0 THEN
    UPDATE public.cases
       SET status = 'contacted'
     WHERE id = OLD.case_id
       AND status = 'appointment_scheduled';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_revert_case_last_appointment ON public.appointments;
CREATE TRIGGER trg_revert_case_last_appointment
  AFTER DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.revert_case_when_last_appointment_deleted();
