CREATE OR REPLACE FUNCTION public.trg_case_events_appointments() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.case_id IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
   IF NEW.public_booking AND NEW.confirmation_status='pending' THEN RETURN NEW; END IF;
   PERFORM public.log_case_event(NEW.case_id,'appointment_scheduled',jsonb_build_object('scheduled_at',NEW.scheduled_at,'duration_minutes',NEW.duration_minutes));
 ELSIF NEW.outcome IS DISTINCT FROM OLD.outcome AND NEW.outcome IS NOT NULL THEN
   PERFORM public.log_case_event(NEW.case_id,'appointment_outcome',jsonb_build_object('outcome',NEW.outcome,'scheduled_at',NEW.scheduled_at));
 ELSIF NEW.public_booking AND OLD.confirmation_status='pending' AND NEW.confirmation_status='confirmed' THEN
   PERFORM public.log_case_event(NEW.case_id,'appointment_scheduled',jsonb_build_object('scheduled_at',NEW.scheduled_at,'duration_minutes',NEW.duration_minutes));
 ELSIF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at AND (NOT NEW.public_booking OR NEW.confirmation_status='confirmed') THEN
   PERFORM public.log_case_event(NEW.case_id,'appointment_rescheduled',jsonb_build_object('from',OLD.scheduled_at,'to',NEW.scheduled_at));
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.trg_case_events_appointments() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.confirm_public_appointment(p_appointment_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_case public.cases%ROWTYPE; v_appt public.appointments%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'team_member') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO v_appt FROM public.appointments WHERE id=p_appointment_id FOR UPDATE;
 IF NOT FOUND OR NOT v_appt.public_booking OR v_appt.confirmation_status <> 'pending' OR v_appt.status NOT IN ('scheduled','confirmed') OR v_appt.outcome IS NOT NULL OR v_appt.scheduled_at<=now() THEN RAISE EXCEPTION 'Request unavailable'; END IF;
 SELECT * INTO v_case FROM public.cases WHERE id=v_appt.case_id FOR UPDATE;
 IF v_case.assigned_to IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Forbidden'; END IF;
 UPDATE public.appointments SET team_member_id=auth.uid(),confirmation_status='confirmed',status='confirmed',updated_at=now() WHERE id=p_appointment_id;
 IF v_case.status='new' THEN UPDATE public.cases SET status='contacted' WHERE id=v_case.id; END IF;
 IF v_case.status IN ('new','contacted') THEN UPDATE public.cases SET status='appointment_scheduled' WHERE id=v_case.id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.confirm_public_appointment(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_public_appointment(uuid) TO authenticated;
CREATE TRIGGER trg_public_booking_confirmation_reminders AFTER UPDATE OF confirmation_status ON public.appointments FOR EACH ROW WHEN (NEW.public_booking AND NEW.confirmation_status='confirmed' AND OLD.confirmation_status='pending') EXECUTE FUNCTION public.sync_appointment_reminders();