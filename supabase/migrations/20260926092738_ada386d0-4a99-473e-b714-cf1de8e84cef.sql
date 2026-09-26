CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE public.appointments ALTER COLUMN team_member_id DROP NOT NULL;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS public_booking boolean NOT NULL DEFAULT false;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS public_booking_end timestamptz;
ALTER TABLE public.appointments ADD CONSTRAINT public_appointment_office_no_overlap EXCLUDE USING gist (tstzrange(scheduled_at, public_booking_end, '[)') WITH &&) WHERE (public_booking AND status IN ('scheduled','confirmed') AND outcome IS NULL);
CREATE OR REPLACE FUNCTION public.set_public_booking_end() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.public_booking_end := CASE WHEN NEW.public_booking THEN NEW.scheduled_at + make_interval(mins => NEW.duration_minutes) ELSE NULL END; RETURN NEW; END $$;
CREATE TRIGGER trg_set_public_booking_end BEFORE INSERT OR UPDATE OF scheduled_at,duration_minutes,public_booking ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_public_booking_end();
CREATE TABLE public.public_appointment_access (
  case_id uuid PRIMARY KEY REFERENCES public.cases(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  appointment_id uuid UNIQUE REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.public_appointment_access TO service_role;
ALTER TABLE public.public_appointment_access ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.manage_public_appointment(p_token_hash text, p_action text, p_slot timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_access public.public_appointment_access%ROWTYPE; v_case public.cases%ROWTYPE; v_appt public.appointments%ROWTYPE; v_local timestamp; v_created uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_token_hash !~ '^[0-9a-f]{64}$' OR p_action NOT IN ('read','book','reschedule','cancel') THEN RAISE EXCEPTION 'Invalid request'; END IF;
  SELECT * INTO v_access FROM public.public_appointment_access WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR v_access.expires_at <= now() THEN RAISE EXCEPTION 'Invalid or expired booking link'; END IF;
  SELECT * INTO v_case FROM public.cases WHERE id = v_access.case_id FOR UPDATE;
  IF NOT FOUND OR v_case.status IN ('cancelled','forgotten','enrollment_paid') THEN RAISE EXCEPTION 'This case cannot be booked'; END IF;
  IF v_access.appointment_id IS NOT NULL THEN SELECT * INTO v_appt FROM public.appointments WHERE id = v_access.appointment_id; END IF;
  IF p_action = 'read' THEN
    RETURN jsonb_build_object('scheduled_at', CASE WHEN v_appt.status IN ('scheduled','confirmed') AND v_appt.outcome IS NULL THEN v_appt.scheduled_at ELSE NULL END, 'status', CASE WHEN v_appt.status IN ('scheduled','confirmed') AND v_appt.outcome IS NULL THEN v_appt.status ELSE NULL END);
  END IF;
  IF p_action = 'cancel' THEN
    IF v_appt.id IS NOT NULL AND v_appt.status IN ('scheduled','confirmed') AND v_appt.outcome IS NULL THEN
      UPDATE public.appointments SET status='cancelled', outcome='cancelled', updated_at=now() WHERE id=v_appt.id;
    END IF;
    RETURN jsonb_build_object('status','cancelled');
  END IF;
  IF p_action = 'book' AND v_appt.id IS NOT NULL AND v_appt.status IN ('scheduled','confirmed') AND v_appt.outcome IS NULL THEN
    RETURN jsonb_build_object('status',v_appt.status,'scheduled_at',v_appt.scheduled_at);
  END IF;
  IF p_action = 'reschedule' AND (v_appt.id IS NULL OR v_appt.status NOT IN ('scheduled','confirmed') OR v_appt.outcome IS NOT NULL) THEN RAISE EXCEPTION 'No active appointment to reschedule'; END IF;
  IF p_slot IS NULL THEN RAISE EXCEPTION 'Choose a time'; END IF;
  v_local := p_slot AT TIME ZONE 'Asia/Jerusalem';
  IF p_slot < now() + interval '2 hours' OR p_slot > now() + interval '14 days'
    OR extract(dow from v_local) NOT BETWEEN 0 AND 4
    OR extract(hour from v_local) NOT BETWEEN 10 AND 17
    OR (extract(hour from v_local) = 17 AND extract(minute from v_local) > 0)
    OR extract(minute from v_local) NOT IN (0,30) OR extract(second from v_local) <> 0 THEN
    RAISE EXCEPTION 'Time unavailable';
  END IF;
  -- The exclusion constraint arbitrates concurrent public claims, including across workers.
  IF v_appt.id IS NOT NULL AND v_appt.status IN ('scheduled','confirmed') AND v_appt.outcome IS NULL THEN
    UPDATE public.appointments SET scheduled_at=p_slot, status='scheduled', updated_at=now() WHERE id=v_appt.id;
    v_created := v_appt.id;
  ELSE
    INSERT INTO public.appointments (case_id,team_member_id,scheduled_at,duration_minutes,status,public_booking)
    VALUES(v_case.id,v_case.assigned_to,p_slot,60,'scheduled',true) RETURNING id INTO v_created;
    UPDATE public.public_appointment_access SET appointment_id=v_created,updated_at=now() WHERE case_id=v_case.id;
  END IF;
  IF v_case.status = 'new' THEN UPDATE public.cases SET status='contacted' WHERE id=v_case.id; END IF;
  IF v_case.status IN ('new','contacted') THEN UPDATE public.cases SET status='appointment_scheduled' WHERE id=v_case.id; END IF;
  RETURN jsonb_build_object('status','scheduled','scheduled_at',p_slot);
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION 'Time unavailable';
END $$;
REVOKE ALL ON FUNCTION public.manage_public_appointment(text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.manage_public_appointment(text,text,timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.assign_public_appointment_with_case()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    UPDATE public.appointments SET team_member_id=NEW.assigned_to, updated_at=now()
    WHERE case_id=NEW.id AND public_booking AND status IN ('scheduled','confirmed') AND outcome IS NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.assign_public_appointment_with_case() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_assign_public_appointment_with_case AFTER UPDATE OF assigned_to ON public.cases FOR EACH ROW EXECUTE FUNCTION public.assign_public_appointment_with_case();