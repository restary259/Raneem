ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS confirmation_status text NOT NULL DEFAULT 'confirmed';
ALTER TABLE public.appointments ADD CONSTRAINT appointments_confirmation_status_check CHECK (confirmation_status IN ('pending','confirmed'));
CREATE OR REPLACE FUNCTION public.assign_public_appointment_with_case() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- A request belongs to the case; assigning a case must never silently
  -- accept the student's proposed time or fail due to a staff conflict.
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    UPDATE public.appointments SET team_member_id=NULL, confirmation_status='pending', updated_at=now()
    WHERE case_id=NEW.id AND public_booking AND confirmation_status='pending'
      AND status IN ('scheduled','confirmed') AND outcome IS NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.assign_public_appointment_with_case() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.confirm_public_appointment(p_appointment_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_case public.cases%ROWTYPE; v_appt public.appointments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'team_member') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO v_appt FROM public.appointments WHERE id=p_appointment_id FOR UPDATE;
  IF NOT FOUND OR NOT v_appt.public_booking OR v_appt.confirmation_status <> 'pending' OR v_appt.status NOT IN ('scheduled','confirmed') OR v_appt.outcome IS NOT NULL OR v_appt.scheduled_at <= now() THEN RAISE EXCEPTION 'Request unavailable'; END IF;
  SELECT * INTO v_case FROM public.cases WHERE id=v_appt.case_id FOR UPDATE;
  IF v_case.assigned_to IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.appointments SET team_member_id=auth.uid(), confirmation_status='confirmed', status='confirmed', updated_at=now() WHERE id=p_appointment_id;
END $$;
REVOKE ALL ON FUNCTION public.confirm_public_appointment(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_public_appointment(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.sync_appointment_reminders() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  DELETE FROM public.appointment_reminders WHERE appointment_id=NEW.id AND sent_at IS NULL;
  IF NEW.team_member_id IS NULL OR NEW.scheduled_at IS NULL OR NEW.outcome IS NOT NULL OR NEW.rescheduled_to IS NOT NULL OR (NEW.public_booking AND NEW.confirmation_status <> 'confirmed') THEN RETURN NEW; END IF;
  IF NEW.scheduled_at - interval '24 hours' > now() THEN INSERT INTO public.appointment_reminders (appointment_id,recipient_id,kind,due_at) VALUES(NEW.id,NEW.team_member_id,'t_24h',NEW.scheduled_at - interval '24 hours') ON CONFLICT DO NOTHING; END IF;
  IF NEW.scheduled_at - interval '1 hour' > now() THEN INSERT INTO public.appointment_reminders (appointment_id,recipient_id,kind,due_at) VALUES(NEW.id,NEW.team_member_id,'t_1h',NEW.scheduled_at - interval '1 hour') ON CONFLICT DO NOTHING; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.reconcile_public_booking_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.public_booking AND NEW.confirmation_status='pending' AND NEW.team_member_id IS NOT NULL THEN NEW.team_member_id := NULL; END IF;
  IF NEW.public_booking AND TG_OP='UPDATE' AND OLD.confirmation_status='confirmed' AND (NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at) THEN NEW.confirmation_status := 'pending'; NEW.team_member_id := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_reconcile_public_booking_request BEFORE INSERT OR UPDATE OF scheduled_at,confirmation_status,team_member_id ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.reconcile_public_booking_request();
UPDATE public.appointments SET confirmation_status='pending',team_member_id=NULL WHERE public_booking AND status='scheduled' AND outcome IS NULL;
CREATE OR REPLACE FUNCTION public.manage_public_appointment(p_token_hash text, p_action text, p_slot timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_access public.public_appointment_access%ROWTYPE; v_case public.cases%ROWTYPE; v_appt public.appointments%ROWTYPE; v_local timestamp; v_created uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF p_token_hash !~ '^[0-9a-f]{64}$' OR p_action NOT IN ('read','book','reschedule','cancel') THEN RAISE EXCEPTION 'Invalid request'; END IF;
 SELECT * INTO v_access FROM public.public_appointment_access WHERE token_hash=p_token_hash FOR UPDATE;
 IF NOT FOUND OR v_access.expires_at<=now() THEN RAISE EXCEPTION 'Invalid or expired booking link'; END IF;
 SELECT * INTO v_case FROM public.cases WHERE id=v_access.case_id FOR UPDATE;
 IF NOT FOUND OR v_case.status IN ('cancelled','forgotten','enrollment_paid') THEN RAISE EXCEPTION 'This case cannot be booked'; END IF;
 IF v_access.appointment_id IS NOT NULL THEN SELECT * INTO v_appt FROM public.appointments WHERE id=v_access.appointment_id; END IF;
 IF p_action='read' THEN RETURN jsonb_build_object('scheduled_at',CASE WHEN v_appt.status IN ('scheduled','confirmed') AND v_appt.outcome IS NULL THEN v_appt.scheduled_at ELSE NULL END,'status',CASE WHEN v_appt.status IN ('scheduled','confirmed') AND v_appt.outcome IS NULL THEN v_appt.confirmation_status ELSE NULL END); END IF;
 IF p_action='cancel' THEN
  IF v_appt.id IS NOT NULL AND v_appt.status IN ('scheduled','confirmed') AND v_appt.outcome IS NULL THEN UPDATE public.appointments SET status='cancelled',outcome='cancelled',updated_at=now() WHERE id=v_appt.id; END IF;
  RETURN jsonb_build_object('status','cancelled');
 END IF;
 IF p_action='book' AND v_appt.id IS NOT NULL AND v_appt.status IN ('scheduled','confirmed') AND v_appt.outcome IS NULL THEN RETURN jsonb_build_object('status',v_appt.confirmation_status,'scheduled_at',v_appt.scheduled_at); END IF;
 IF p_action='reschedule' AND (v_appt.id IS NULL OR v_appt.status NOT IN ('scheduled','confirmed') OR v_appt.outcome IS NOT NULL) THEN RAISE EXCEPTION 'No active appointment to reschedule'; END IF;
 IF p_slot IS NULL THEN RAISE EXCEPTION 'Choose a time'; END IF;
 v_local := p_slot AT TIME ZONE 'Asia/Jerusalem';
 IF p_slot<now()+interval '2 hours' OR p_slot>now()+interval '14 days' OR extract(dow from v_local) NOT BETWEEN 0 AND 4 OR extract(hour from v_local) NOT BETWEEN 10 AND 17 OR (extract(hour from v_local)=17 AND extract(minute from v_local)>0) OR extract(minute from v_local) NOT IN (0,30) OR extract(second from v_local)<>0 THEN RAISE EXCEPTION 'Time unavailable'; END IF;
 IF v_appt.id IS NOT NULL AND v_appt.status IN ('scheduled','confirmed') AND v_appt.outcome IS NULL THEN
  UPDATE public.appointments SET scheduled_at=p_slot,status='scheduled',confirmation_status='pending',team_member_id=NULL,updated_at=now() WHERE id=v_appt.id;
  v_created:=v_appt.id;
 ELSE
  INSERT INTO public.appointments(case_id,team_member_id,scheduled_at,duration_minutes,status,public_booking,confirmation_status) VALUES(v_case.id,NULL,p_slot,60,'scheduled',true,'pending') RETURNING id INTO v_created;
  UPDATE public.public_appointment_access SET appointment_id=v_created,updated_at=now() WHERE case_id=v_case.id;
 END IF;
 RETURN jsonb_build_object('status','pending','scheduled_at',p_slot);
EXCEPTION WHEN exclusion_violation THEN RAISE EXCEPTION 'Time unavailable';
END $$;
REVOKE ALL ON FUNCTION public.manage_public_appointment(text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.manage_public_appointment(text,text,timestamptz) TO service_role;