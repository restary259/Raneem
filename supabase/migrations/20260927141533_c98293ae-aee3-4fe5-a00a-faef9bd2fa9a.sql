ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_source_check;
ALTER TABLE public.cases ADD CONSTRAINT cases_source_check CHECK (source = ANY (ARRAY['apply_page','manual','submit_new_student','social_media_partner','referral','contact_form','public_booking']));

CREATE OR REPLACE FUNCTION public.create_public_booking_session(p_full_name text, p_phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $fn$
DECLARE
  v_name text := btrim(COALESCE(p_full_name, ''));
  v_phone text := regexp_replace(btrim(COALESCE(p_phone, '')), '[^0-9+]', '', 'g');
  v_case_id uuid; v_token text; v_recent integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF length(v_name) < 2 OR length(v_name) > 120 THEN RAISE EXCEPTION 'Invalid name'; END IF;
  IF v_phone !~ '^[+]?[0-9]{8,15}$' THEN RAISE EXCEPTION 'Invalid phone'; END IF;
  SELECT count(*)::int INTO v_recent FROM public.cases c
   WHERE c.source='public_booking' AND c.phone_number=v_phone AND c.created_at > now()-interval '30 minutes';
  IF v_recent >= 3 THEN RAISE EXCEPTION 'Too many booking requests'; END IF;
  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.cases(full_name, phone_number, status, source) VALUES (v_name, v_phone, 'new', 'public_booking') RETURNING id INTO v_case_id;
  INSERT INTO public.public_appointment_access(case_id, token_hash, expires_at) VALUES (v_case_id, encode(digest(v_token,'sha256'),'hex'), now()+interval '14 days');
  RETURN jsonb_build_object('token', v_token, 'expires_at', now()+interval '14 days');
END $fn$;
REVOKE ALL ON FUNCTION public.create_public_booking_session(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_booking_session(text,text) TO service_role;

DROP FUNCTION IF EXISTS public.manage_public_appointment(text,text,timestamptz);
CREATE FUNCTION public.manage_public_appointment(p_token_hash text, p_action text, p_slot timestamptz DEFAULT NULL, p_office_id uuid DEFAULT NULL, p_service_type text DEFAULT 'consultation')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_access public.public_appointment_access%ROWTYPE; v_case public.cases%ROWTYPE; v_appt public.appointments%ROWTYPE;
  v_local timestamp; v_created uuid; v_office public.offices%ROWTYPE; v_member uuid; v_active boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF p_token_hash !~ '^[0-9a-f]{64}$' OR p_action NOT IN ('read','book','reschedule','cancel') THEN RAISE EXCEPTION 'Invalid request'; END IF;
 SELECT * INTO v_access FROM public.public_appointment_access WHERE token_hash=p_token_hash FOR UPDATE;
 IF NOT FOUND OR v_access.expires_at<=now() THEN RAISE EXCEPTION 'Invalid or expired booking link'; END IF;
 SELECT * INTO v_case FROM public.cases WHERE id=v_access.case_id FOR UPDATE;
 IF NOT FOUND OR v_case.status IN ('cancelled','forgotten','enrollment_paid') THEN RAISE EXCEPTION 'This case cannot be booked'; END IF;
 IF v_access.appointment_id IS NOT NULL THEN SELECT * INTO v_appt FROM public.appointments WHERE id=v_access.appointment_id; END IF;
 v_active := v_appt.id IS NOT NULL AND v_appt.status IN ('scheduled','confirmed') AND v_appt.outcome IS NULL;
 IF p_action='read' THEN
  RETURN jsonb_build_object('scheduled_at',CASE WHEN v_active THEN v_appt.scheduled_at END,'status',CASE WHEN v_active THEN v_appt.confirmation_status END,'office_id',COALESCE(CASE WHEN v_active THEN v_appt.office_id END, v_case.office_id));
 END IF;
 IF p_action='cancel' THEN
  IF v_active THEN UPDATE public.appointments SET status='cancelled',outcome='cancelled',updated_at=now() WHERE id=v_appt.id; END IF;
  RETURN jsonb_build_object('status','cancelled');
 END IF;
 IF p_action='book' AND v_active THEN RETURN jsonb_build_object('status',v_appt.confirmation_status,'scheduled_at',v_appt.scheduled_at,'office_id',v_appt.office_id); END IF;
 IF p_action='reschedule' AND NOT v_active THEN RAISE EXCEPTION 'No active appointment to reschedule'; END IF;
 IF p_slot IS NULL THEN RAISE EXCEPTION 'Choose a time'; END IF;

 IF p_office_id IS NOT NULL THEN
  SELECT * INTO v_office FROM public.offices WHERE id=p_office_id AND is_active AND booking_enabled AND deleted_at IS NULL;
 ELSE
  SELECT * INTO v_office FROM public.offices WHERE is_active AND booking_enabled AND deleted_at IS NULL ORDER BY display_order, name_en LIMIT 1;
 END IF;
 IF v_office.id IS NULL THEN RAISE EXCEPTION 'Office unavailable'; END IF;
 SELECT m.user_id INTO v_member FROM public.office_members m
   JOIN public.user_roles r ON r.user_id=m.user_id AND r.role='team_member'
   JOIN public.profiles p ON p.id=m.user_id AND p.deleted_at IS NULL AND p.deactivated_at IS NULL
  WHERE m.office_id=v_office.id AND m.is_active ORDER BY m.is_primary DESC, m.priority, m.created_at LIMIT 1;
 IF v_member IS NULL THEN RAISE EXCEPTION 'Office unavailable'; END IF;

 v_local := p_slot AT TIME ZONE COALESCE(v_office.timezone,'Asia/Jerusalem');
 IF p_slot<now()+interval '2 hours' OR p_slot>now()+interval '14 days' OR extract(dow from v_local) NOT BETWEEN 0 AND 4 OR extract(hour from v_local) NOT BETWEEN 10 AND 17 OR (extract(hour from v_local)=17 AND extract(minute from v_local)>0) OR extract(minute from v_local) NOT IN (0,30) OR extract(second from v_local)<>0 THEN RAISE EXCEPTION 'Time unavailable'; END IF;
 IF EXISTS (SELECT 1 FROM public.appointments a WHERE a.office_id=v_office.id AND a.status IN ('scheduled','confirmed') AND a.outcome IS NULL AND a.id IS DISTINCT FROM v_appt.id
    AND a.scheduled_at < p_slot+interval '60 minutes' AND a.scheduled_at+make_interval(mins=>COALESCE(a.duration_minutes,60)) > p_slot) THEN
  RAISE EXCEPTION 'Time unavailable';
 END IF;

 IF v_active THEN
  UPDATE public.appointments SET scheduled_at=p_slot,status='scheduled',confirmation_status='pending',office_id=v_office.id,team_member_id=COALESCE(v_case.assigned_to,v_member),updated_at=now() WHERE id=v_appt.id;
 ELSE
  INSERT INTO public.appointments(case_id,team_member_id,scheduled_at,duration_minutes,status,public_booking,confirmation_status,office_id)
   VALUES(v_case.id,COALESCE(v_case.assigned_to,v_member),p_slot,60,'scheduled',true,'pending',v_office.id) RETURNING id INTO v_created;
  UPDATE public.public_appointment_access SET appointment_id=v_created,updated_at=now() WHERE case_id=v_case.id;
 END IF;
 UPDATE public.cases SET office_id=COALESCE(office_id, v_office.id) WHERE id=v_case.id;
 RETURN jsonb_build_object('status','pending','scheduled_at',p_slot,'office_id',v_office.id);
EXCEPTION WHEN exclusion_violation THEN RAISE EXCEPTION 'Time unavailable';
END $function$;
REVOKE ALL ON FUNCTION public.manage_public_appointment(text,text,timestamptz,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_public_appointment(text,text,timestamptz,uuid,text) TO service_role;