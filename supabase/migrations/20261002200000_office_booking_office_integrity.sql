-- ============================================================================
-- Public booking office integrity (audit P1)
--
-- The token-protected public booking RPC accepted an optional `p_office_id`
-- on every action. For an existing appointment (`book` / `reschedule`) that
-- value was folded in via
--   v_office_id := COALESCE(p_office_id, v_appt.office_id, v_case.office_id)
-- so a rescheduling applicant could silently rebind *both* the appointment
-- and the case to a different office — moving the booking (and its routing
-- and calendar ownership) across tenant boundaries.
--
-- The booking token is the only credential the applicant holds, and it was
-- minted for one office. This migration:
--   1. Makes an existing booking's office immutable in the RPC: the
--      originating office wins and `p_office_id` is ignored for read/update
--      paths. (It is still honoured when the appointment is first created.)
--   2. Backfills any already-rebound rows from their case, then enforces the
--      invariant `appointments.office_id = cases.office_id` at the table for
--      every public booking, so the RPC is not the only line of defence.
--
-- Timestamp is newer than every function it redefines.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table invariant: a public booking stays in its case's office.
-- ---------------------------------------------------------------------------

-- Repair pre-existing divergence before the trigger exists. A case with no
-- office is intentionally left alone (generic booking, office chosen later).
UPDATE public.appointments a
SET office_id = c.office_id,
    updated_at = now()
FROM public.cases c
WHERE a.case_id = c.id
  AND a.public_booking
  AND c.office_id IS NOT NULL
  AND a.office_id IS DISTINCT FROM c.office_id;

CREATE OR REPLACE FUNCTION public.enforce_public_booking_office_invariant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_case_office uuid;
BEGIN
  IF NOT NEW.public_booking THEN
    RETURN NEW;
  END IF;

  SELECT c.office_id INTO v_case_office
  FROM public.cases c
  WHERE c.id = NEW.case_id;

  IF FOUND AND v_case_office IS NOT NULL
     AND NEW.office_id IS DISTINCT FROM v_case_office THEN
    IF TG_OP = 'INSERT' THEN
      -- Creation may arrive before the RPC has copied the case office; align
      -- it rather than reject a legitimate first booking.
      NEW.office_id := v_case_office;
    ELSE
      RAISE EXCEPTION 'Appointment office cannot change for an office-scoped booking'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.enforce_public_booking_office_invariant() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_public_booking_office_invariant() TO service_role;

DROP TRIGGER IF EXISTS trg_enforce_public_booking_office_invariant ON public.appointments;
CREATE TRIGGER trg_enforce_public_booking_office_invariant
BEFORE INSERT OR UPDATE OF office_id, case_id, public_booking
ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.enforce_public_booking_office_invariant();

-- ---------------------------------------------------------------------------
-- 2. RPC: lock the office for an existing booking.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.manage_public_appointment(
  p_token_hash text,
  p_action text,
  p_slot timestamptz DEFAULT NULL,
  p_office_id uuid DEFAULT NULL,
  p_service_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_access public.public_appointment_access%ROWTYPE;
  v_case public.cases%ROWTYPE;
  v_appt public.appointments%ROWTYPE;
  v_office public.offices%ROWTYPE;
  v_settings public.office_booking_settings%ROWTYPE;
  v_hours public.office_hours%ROWTYPE;
  v_office_id uuid;
  v_assignee uuid;
  v_duration integer;
  v_slot_interval integer;
  v_local timestamp;
  v_local_end timestamp;
  v_local_minutes integer;
  v_local_end_minutes integer;
  v_open_minutes integer;
  v_close_minutes integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_action NOT IN ('read','book','reschedule','cancel') THEN
    RAISE EXCEPTION 'Invalid request';
  END IF;

  SELECT * INTO v_access
  FROM public.public_appointment_access
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND OR v_access.expires_at <= now() THEN
    RAISE EXCEPTION 'Invalid or expired booking link';
  END IF;

  SELECT * INTO v_case
  FROM public.cases
  WHERE id = v_access.case_id
  FOR UPDATE;

  IF NOT FOUND OR v_case.status IN ('cancelled','forgotten','enrollment_paid') THEN
    RAISE EXCEPTION 'This case cannot be booked';
  END IF;

  IF v_access.appointment_id IS NOT NULL THEN
    SELECT * INTO v_appt
    FROM public.appointments
    WHERE id = v_access.appointment_id
    FOR UPDATE;
  END IF;

  IF p_action = 'read' THEN
    RETURN jsonb_build_object(
      'scheduled_at',
        CASE WHEN v_appt.id IS NOT NULL
              AND v_appt.status IN ('scheduled','confirmed')
              AND v_appt.outcome IS NULL
          THEN v_appt.scheduled_at ELSE NULL END,
      'status',
        CASE WHEN v_appt.id IS NOT NULL
              AND v_appt.status IN ('scheduled','confirmed')
              AND v_appt.outcome IS NULL
          THEN v_appt.status ELSE NULL END,
      'office_id',
        CASE WHEN v_appt.id IS NOT NULL
              AND v_appt.status IN ('scheduled','confirmed')
              AND v_appt.outcome IS NULL
          THEN v_appt.office_id ELSE v_case.office_id END
    );
  END IF;

  IF p_action = 'cancel' THEN
    IF v_appt.id IS NOT NULL
       AND v_appt.status IN ('scheduled','confirmed')
       AND v_appt.outcome IS NULL THEN
      UPDATE public.appointments
      SET status = 'cancelled', outcome = 'cancelled', updated_at = now()
      WHERE id = v_appt.id;
    END IF;
    RETURN jsonb_build_object('status','cancelled');
  END IF;

  -- An existing booking is office-immutable: the token was minted for the
  -- originating office, so `p_office_id` is ignored here. Only a brand-new
  -- appointment may choose its office from the request (falling back to the
  -- case's office).
  IF v_appt.id IS NOT NULL THEN
    v_office_id := COALESCE(v_appt.office_id, v_case.office_id);
  ELSE
    v_office_id := COALESCE(p_office_id, v_case.office_id);
  END IF;

  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'Choose an office';
  END IF;

  SELECT * INTO v_office
  FROM public.offices
  WHERE id = v_office_id
    AND is_active = true
    AND deleted_at IS NULL
    AND booking_enabled = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Office unavailable';
  END IF;

  IF v_appt.id IS NOT NULL
     AND p_action = 'book'
     AND v_appt.status IN ('scheduled','confirmed')
     AND v_appt.outcome IS NULL THEN
    RETURN jsonb_build_object(
      'status', v_appt.status,
      'scheduled_at', v_appt.scheduled_at,
      'office_id', v_appt.office_id
    );
  END IF;

  IF p_action = 'reschedule'
     AND (
       v_appt.id IS NULL
       OR v_appt.status NOT IN ('scheduled','confirmed')
       OR v_appt.outcome IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'No active appointment to reschedule';
  END IF;

  IF p_slot IS NULL THEN
    RAISE EXCEPTION 'Choose a time';
  END IF;

  SELECT * INTO v_settings
  FROM public.office_booking_settings
  WHERE office_id = v_office_id;

  v_duration := GREATEST(15, COALESCE(v_settings.default_duration_minutes, 60));
  v_slot_interval := GREATEST(5, COALESCE(v_settings.slot_interval_minutes, 30));

  IF p_slot < now() + make_interval(mins => GREATEST(0, COALESCE(v_settings.minimum_lead_minutes, 120)))
     OR p_slot > now() + make_interval(days => GREATEST(1, COALESCE(v_settings.maximum_days_ahead, 14))) THEN
    RAISE EXCEPTION 'Time unavailable';
  END IF;

  BEGIN
    PERFORM 1 FROM pg_timezone_names WHERE name = v_office.timezone;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Time unavailable';
    END IF;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  v_local := p_slot AT TIME ZONE v_office.timezone;
  v_local_end := v_local + make_interval(mins => v_duration);

  IF extract(second FROM v_local) <> 0
     OR extract(second FROM v_local_end) <> 0 THEN
    RAISE EXCEPTION 'Time unavailable';
  END IF;

  v_local_minutes := extract(hour FROM v_local)::integer * 60 + extract(minute FROM v_local)::integer;
  v_local_end_minutes := extract(hour FROM v_local_end)::integer * 60 + extract(minute FROM v_local_end)::integer;

  IF v_local_end::date IS DISTINCT FROM v_local::date THEN
    RAISE EXCEPTION 'Time unavailable';
  END IF;

  SELECT * INTO v_hours
  FROM public.office_hours
  WHERE office_id = v_office_id
    AND weekday = extract(dow FROM v_local)::integer
    AND is_open = true
  LIMIT 1;

  IF NOT FOUND OR v_hours.open_time IS NULL OR v_hours.close_time IS NULL THEN
    RAISE EXCEPTION 'Time unavailable';
  END IF;

  v_open_minutes := extract(hour FROM v_hours.open_time)::integer * 60 + extract(minute FROM v_hours.open_time)::integer;
  v_close_minutes := extract(hour FROM v_hours.close_time)::integer * 60 + extract(minute FROM v_hours.close_time)::integer;

  IF v_local_minutes < v_open_minutes
     OR v_local_end_minutes > v_close_minutes
     OR ((v_local_minutes - v_open_minutes) % v_slot_interval) <> 0 THEN
    RAISE EXCEPTION 'Time unavailable';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.office_breaks b
    WHERE b.office_id = v_office_id
      AND b.weekday = extract(dow FROM v_local)::integer
      AND b.is_active = true
      AND (
        (extract(hour FROM b.start_time)::integer * 60 + extract(minute FROM b.start_time)::integer) < v_local_end_minutes
        AND (extract(hour FROM b.end_time)::integer * 60 + extract(minute FROM b.end_time)::integer) > v_local_minutes
      )
  ) THEN
    RAISE EXCEPTION 'Time unavailable';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.office_blackouts b
    WHERE b.office_id = v_office_id
      AND b.is_active = true
      AND b.starts_at < p_slot + make_interval(mins => v_duration)
      AND b.ends_at > p_slot
  ) THEN
    RAISE EXCEPTION 'Time unavailable';
  END IF;

  v_assignee := public.resolve_office_assignee_for_slot(
    v_office_id,
    p_slot,
    v_duration,
    p_service_type,
    v_appt.id
  );

  IF v_assignee IS NULL THEN
    RAISE EXCEPTION 'Office unavailable';
  END IF;

  UPDATE public.cases
  SET office_id = v_office_id,
      assigned_to = v_assignee,
      updated_at = now()
  WHERE id = v_case.id
    AND (
      office_id IS DISTINCT FROM v_office_id
      OR assigned_to IS DISTINCT FROM v_assignee
    );

  IF v_appt.id IS NOT NULL THEN
    UPDATE public.appointments
    SET office_id = v_office_id,
        team_member_id = v_assignee,
        scheduled_at = p_slot,
        duration_minutes = v_duration,
        status = 'scheduled',
        updated_at = now()
    WHERE id = v_appt.id;
  ELSE
    INSERT INTO public.appointments (
      case_id, office_id, team_member_id, scheduled_at, duration_minutes,
      status, public_booking, confirmation_status
    )
    VALUES (
      v_case.id, v_office_id, v_assignee, p_slot, v_duration,
      'scheduled', true, 'pending'
    )
    RETURNING id INTO v_appt;
    UPDATE public.public_appointment_access
    SET appointment_id = v_appt.id, updated_at = now()
    WHERE case_id = v_case.id;
  END IF;

  IF v_case.status IN ('new','contacted') THEN
    UPDATE public.cases
    SET status = 'appointment_scheduled'
    WHERE id = v_case.id;
  END IF;

  RETURN jsonb_build_object(
    'status','scheduled',
    'scheduled_at',p_slot,
    'office_id',v_office_id,
    'team_member_id',v_assignee
  );
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Time unavailable';
END;
$fn$;

REVOKE ALL ON FUNCTION public.manage_public_appointment(text,text,timestamptz,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_public_appointment(text,text,timestamptz,uuid,text)
  TO service_role;
