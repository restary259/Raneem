-- DARB Multi-Office Runtime Hardening
-- Idempotent follow-up for environments where the original multi-office migration
-- is already applied. This migration makes booking rules authoritative at the DB
-- boundary and enforces: only active team_member accounts can be office members,
-- routing targets, case assignees for office-scoped cases, or appointment owners.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- Defensive schema presence / indexes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_he TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL UNIQUE,
  office_code TEXT UNIQUE,
  office_type TEXT NOT NULL DEFAULT 'darb' CHECK (office_type IN ('darb','partner','franchise')),
  country TEXT NOT NULL DEFAULT 'IL',
  city TEXT NOT NULL,
  address_line_1 TEXT,
  address_line_2 TEXT,
  postal_code TEXT,
  phone TEXT,
  email TEXT,
  map_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
  public_description_ar TEXT,
  public_description_en TEXT,
  public_description_he TEXT,
  booking_enabled BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.office_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  membership_type TEXT NOT NULL DEFAULT 'staff' CHECK (membership_type IN ('owner','operator','backup','staff')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (office_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.office_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  is_open BOOLEAN NOT NULL DEFAULT false,
  open_time TIME,
  close_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (office_id, weekday),
  CHECK (is_open = false OR (open_time IS NOT NULL AND close_time IS NOT NULL AND close_time > open_time))
);

CREATE TABLE IF NOT EXISTS public.office_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS public.office_blackouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.office_booking_settings (
  office_id UUID PRIMARY KEY REFERENCES public.offices(id) ON DELETE CASCADE,
  slot_interval_minutes INTEGER NOT NULL DEFAULT 30 CHECK (slot_interval_minutes BETWEEN 5 AND 120),
  default_duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (default_duration_minutes BETWEEN 15 AND 240),
  minimum_lead_minutes INTEGER NOT NULL DEFAULT 120 CHECK (minimum_lead_minutes >= 0),
  maximum_days_ahead INTEGER NOT NULL DEFAULT 14 CHECK (maximum_days_ahead BETWEEN 1 AND 90),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.office_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  assigned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS office_one_active_primary_idx
  ON public.office_members (office_id)
  WHERE is_primary = true AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_cases_office_id
  ON public.cases (office_id);

CREATE INDEX IF NOT EXISTS idx_appointments_office_scheduled
  ON public.appointments (office_id, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_team_scheduled
  ON public.appointments (team_member_id, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_office_members_user
  ON public.office_members (user_id, office_id);

CREATE INDEX IF NOT EXISTS idx_office_members_office_active
  ON public.office_members (office_id, is_active, priority);

CREATE INDEX IF NOT EXISTS idx_office_hours_lookup
  ON public.office_hours (office_id, weekday, is_open);

CREATE INDEX IF NOT EXISTS idx_office_blackouts_lookup
  ON public.office_blackouts (office_id, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_office_routing_lookup
  ON public.office_routing_rules (office_id, service_type, is_active, priority);

-- ---------------------------------------------------------------------------
-- Active-team-member invariant
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_active_team_member(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = p_user_id
      AND ur.role = 'team_member'::public.app_role
      AND p.deleted_at IS NULL
      AND p.deactivated_at IS NULL
  );
$fn$;

REVOKE ALL ON FUNCTION public.is_active_team_member(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_team_member(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.validate_office_team_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.is_active_team_member(NEW.user_id) THEN
    RAISE EXCEPTION 'Only active team members can be assigned to an office'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.validate_office_team_member() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_office_team_member() TO service_role;

DROP TRIGGER IF EXISTS trg_validate_office_team_member ON public.office_members;
CREATE TRIGGER trg_validate_office_team_member
BEFORE INSERT OR UPDATE OF user_id ON public.office_members
FOR EACH ROW EXECUTE FUNCTION public.validate_office_team_member();

CREATE OR REPLACE FUNCTION public.validate_office_routing_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.is_active_team_member(NEW.assigned_user_id) THEN
    RAISE EXCEPTION 'Only active team members can be routing targets'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.office_members om
    WHERE om.office_id = NEW.office_id
      AND om.user_id = NEW.assigned_user_id
      AND om.is_active = true
  ) THEN
    RAISE EXCEPTION 'Routing target must be an active team member of the office'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.validate_office_routing_member() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_office_routing_member() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_validate_office_routing_member ON public.office_routing_rules;
CREATE TRIGGER trg_validate_office_routing_member
BEFORE INSERT OR UPDATE OF office_id, assigned_user_id
ON public.office_routing_rules
FOR EACH ROW EXECUTE FUNCTION public.validate_office_routing_member();

-- Case invariant: if a case has an office and an assignee, that assignee must be
-- an active team member of that same office.
CREATE OR REPLACE FUNCTION public.validate_case_office_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.office_id IS NOT NULL AND NEW.assigned_to IS NOT NULL THEN
    IF NOT public.is_active_team_member(NEW.assigned_to)
       OR NOT EXISTS (
         SELECT 1
         FROM public.office_members om
         WHERE om.office_id = NEW.office_id
           AND om.user_id = NEW.assigned_to
           AND om.is_active = true
       ) THEN
      RAISE EXCEPTION 'Assigned team member must belong to the case office'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.validate_case_office_assignment() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_case_office_assignment() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_validate_case_office_assignment ON public.cases;
CREATE TRIGGER trg_validate_case_office_assignment
BEFORE INSERT OR UPDATE OF office_id, assigned_to
ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.validate_case_office_assignment();

-- Appointment invariant: every non-null team_member_id must really be a team member;
-- if office_id is set, the member must belong to that office.
CREATE OR REPLACE FUNCTION public.validate_appointment_office_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.team_member_id IS NOT NULL AND NOT public.is_active_team_member(NEW.team_member_id) THEN
    RAISE EXCEPTION 'Only active team members can own appointments'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.office_id IS NOT NULL AND NEW.team_member_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.office_members om
       WHERE om.office_id = NEW.office_id
         AND om.user_id = NEW.team_member_id
         AND om.is_active = true
     ) THEN
    RAISE EXCEPTION 'Appointment owner must belong to the selected office'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.validate_appointment_office_assignment() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_appointment_office_assignment() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_validate_appointment_office_assignment ON public.appointments;
CREATE TRIGGER trg_validate_appointment_office_assignment
BEFORE INSERT OR UPDATE OF office_id, team_member_id
ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_office_assignment();

-- ---------------------------------------------------------------------------
-- Active-member lifecycle cleanup
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.deactivate_office_membership_when_team_role_removed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'DELETE'
     AND OLD.role = 'team_member'::public.app_role THEN
    UPDATE public.office_members
    SET is_active = false, is_primary = false, updated_at = now()
    WHERE user_id = OLD.user_id AND is_active = true;
  ELSIF TG_OP = 'UPDATE'
     AND OLD.role = 'team_member'::public.app_role
     AND NEW.role IS DISTINCT FROM OLD.role THEN
    UPDATE public.office_members
    SET is_active = false, is_primary = false, updated_at = now()
    WHERE user_id = OLD.user_id AND is_active = true;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$fn$;

REVOKE ALL ON FUNCTION public.deactivate_office_membership_when_team_role_removed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_office_membership_when_team_role_removed() TO service_role;

DROP TRIGGER IF EXISTS trg_deactivate_office_membership_when_team_role_removed ON public.user_roles;
CREATE TRIGGER trg_deactivate_office_membership_when_team_role_removed
AFTER DELETE OR UPDATE OF role ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.deactivate_office_membership_when_team_role_removed();

CREATE OR REPLACE FUNCTION public.deactivate_office_membership_on_profile_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.deactivated_at IS NOT NULL AND OLD.deactivated_at IS NULL THEN
    UPDATE public.office_members
    SET is_active = false, is_primary = false, updated_at = now()
    WHERE user_id = NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.deactivate_office_membership_on_profile_deactivation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_office_membership_on_profile_deactivation() TO service_role;

DROP TRIGGER IF EXISTS trg_deactivate_office_membership_on_profile_deactivation ON public.profiles;
CREATE TRIGGER trg_deactivate_office_membership_on_profile_deactivation
AFTER UPDATE OF deactivated_at ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.deactivate_office_membership_on_profile_deactivation();

-- ---------------------------------------------------------------------------
-- Slot-aware assignee selection
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_office_assignee_for_slot(
  p_office_id uuid,
  p_slot timestamptz,
  p_duration_minutes integer,
  p_service_type text DEFAULT NULL,
  p_exclude_appointment_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT om.user_id
  FROM public.office_members om
  WHERE om.office_id = p_office_id
    AND om.is_active = true
    AND public.is_active_team_member(om.user_id)
    AND EXISTS (
      SELECT 1
      FROM public.offices o
      WHERE o.id = om.office_id
        AND o.is_active = true
        AND o.deleted_at IS NULL
        AND o.booking_enabled = true
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.id IS DISTINCT FROM p_exclude_appointment_id
        AND a.team_member_id = om.user_id
        AND a.status IN ('scheduled','confirmed')
        AND a.outcome IS NULL
        AND a.scheduled_at < p_slot + make_interval(mins => p_duration_minutes)
        AND COALESCE(
          a.public_booking_end,
          a.scheduled_at + make_interval(mins => a.duration_minutes)
        ) > p_slot
    )
  ORDER BY
    CASE
      WHEN p_service_type IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.office_routing_rules rr
        WHERE rr.office_id = p_office_id
          AND rr.service_type = p_service_type
          AND rr.assigned_user_id = om.user_id
          AND rr.is_active = true
      ) THEN 0
      WHEN om.is_primary = true THEN 1
      ELSE 2
    END,
    COALESCE(
      (
        SELECT MIN(rr.priority)
        FROM public.office_routing_rules rr
        WHERE rr.office_id = p_office_id
          AND rr.service_type = p_service_type
          AND rr.assigned_user_id = om.user_id
          AND rr.is_active = true
      ),
      om.priority
    ),
    om.created_at
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public.resolve_office_assignee_for_slot(uuid,timestamptz,integer,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_office_assignee_for_slot(uuid,timestamptz,integer,text,uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Database-authoritative public booking
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

  v_office_id := COALESCE(p_office_id, v_appt.office_id, v_case.office_id);
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

-- ---------------------------------------------------------------------------
-- Confirmation remains team-member/admin scoped
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_public_appointment(p_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_case public.cases%ROWTYPE;
  v_appt public.appointments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL
     OR NOT (public.has_role(auth.uid(),'team_member') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND
     OR NOT v_appt.public_booking
     OR v_appt.confirmation_status <> 'pending'
     OR v_appt.status NOT IN ('scheduled','confirmed')
     OR v_appt.outcome IS NOT NULL
     OR v_appt.scheduled_at <= now() THEN
    RAISE EXCEPTION 'Request unavailable';
  END IF;

  SELECT * INTO v_case
  FROM public.cases
  WHERE id = v_appt.case_id
  FOR UPDATE;

  IF public.has_role(auth.uid(),'admin') THEN
    NULL;
  ELSIF v_case.assigned_to IS DISTINCT FROM auth.uid()
     OR NOT public.is_active_team_member(auth.uid())
     OR NOT EXISTS (
       SELECT 1 FROM public.office_members om
       WHERE om.office_id = v_appt.office_id
         AND om.user_id = auth.uid()
         AND om.is_active = true
     ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.appointments
  SET team_member_id = auth.uid(),
      confirmation_status = 'confirmed',
      status = 'confirmed',
      updated_at = now()
  WHERE id = p_appointment_id;

  IF v_case.status IN ('new','contacted') THEN
    UPDATE public.cases
    SET status = 'appointment_scheduled'
    WHERE id = v_case.id;
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.confirm_public_appointment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_public_appointment(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Booking-enable safety invariant
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_office_booking_configuration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.booking_enabled AND (NOT NEW.is_active OR NEW.deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Booking can only be enabled for an active office';
  END IF;

  IF NEW.booking_enabled AND NOT EXISTS (
    SELECT 1
    FROM public.office_members om
    WHERE om.office_id = NEW.id
      AND om.is_primary = true
      AND om.is_active = true
      AND public.is_active_team_member(om.user_id)
  ) THEN
    RAISE EXCEPTION 'Booking requires an active primary team member';
  END IF;

  IF NEW.booking_enabled AND NOT EXISTS (
    SELECT 1
    FROM public.office_hours oh
    WHERE oh.office_id = NEW.id
      AND oh.is_open = true
      AND oh.open_time IS NOT NULL
      AND oh.close_time IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Booking requires at least one open office day';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.validate_office_booking_configuration() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_office_booking_configuration() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_validate_office_booking_configuration ON public.offices;
CREATE TRIGGER trg_validate_office_booking_configuration
BEFORE INSERT OR UPDATE ON public.offices
FOR EACH ROW EXECUTE FUNCTION public.validate_office_booking_configuration();

-- ---------------------------------------------------------------------------
-- Lifecycle touch helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_office_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_offices_updated_at ON public.offices;
CREATE TRIGGER trg_offices_updated_at BEFORE UPDATE ON public.offices FOR EACH ROW EXECUTE FUNCTION public.touch_office_updated_at();

DROP TRIGGER IF EXISTS trg_office_members_updated_at ON public.office_members;
CREATE TRIGGER trg_office_members_updated_at BEFORE UPDATE ON public.office_members FOR EACH ROW EXECUTE FUNCTION public.touch_office_updated_at();

DROP TRIGGER IF EXISTS trg_office_hours_updated_at ON public.office_hours;
CREATE TRIGGER trg_office_hours_updated_at BEFORE UPDATE ON public.office_hours FOR EACH ROW EXECUTE FUNCTION public.touch_office_updated_at();

DROP TRIGGER IF EXISTS trg_office_booking_settings_updated_at ON public.office_booking_settings;
CREATE TRIGGER trg_office_booking_settings_updated_at BEFORE UPDATE ON public.office_booking_settings FOR EACH ROW EXECUTE FUNCTION public.touch_office_updated_at();

DROP TRIGGER IF EXISTS trg_office_routing_rules_updated_at ON public.office_routing_rules;
CREATE TRIGGER trg_office_routing_rules_updated_at BEFORE UPDATE ON public.office_routing_rules FOR EACH ROW EXECUTE FUNCTION public.touch_office_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_blackouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_routing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage offices" ON public.offices;
CREATE POLICY "Admins manage offices"
ON public.offices FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Team reads active offices" ON public.offices;
CREATE POLICY "Team reads active offices"
ON public.offices FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'team_member')
  AND is_active = true
  AND deleted_at IS NULL
);

DROP POLICY IF EXISTS "Admins manage office members" ON public.office_members;
CREATE POLICY "Admins manage office members"
ON public.office_members FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Team reads own office memberships" ON public.office_members;
CREATE POLICY "Team reads own office memberships"
ON public.office_members FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  AND public.has_role(auth.uid(),'team_member')
);

DROP POLICY IF EXISTS "Admins manage office hours" ON public.office_hours;
CREATE POLICY "Admins manage office hours"
ON public.office_hours FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins manage office breaks" ON public.office_breaks;
CREATE POLICY "Admins manage office breaks"
ON public.office_breaks FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins manage office blackouts" ON public.office_blackouts;
CREATE POLICY "Admins manage office blackouts"
ON public.office_blackouts FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins manage office booking settings" ON public.office_booking_settings;
CREATE POLICY "Admins manage office booking settings"
ON public.office_booking_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins manage office routing rules" ON public.office_routing_rules;
CREATE POLICY "Admins manage office routing rules"
ON public.office_routing_rules FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Add the office dimension to public appointment overlap protection.
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS public_appointment_office_no_overlap;

ALTER TABLE public.appointments
  ADD CONSTRAINT public_appointment_office_no_overlap
  EXCLUDE USING gist (
    office_id WITH =,
    tstzrange(scheduled_at, COALESCE(public_booking_end, scheduled_at + make_interval(mins => duration_minutes)), '[)') WITH &&
  )
  WHERE (
    public_booking
    AND office_id IS NOT NULL
    AND status IN ('scheduled','confirmed')
    AND outcome IS NULL
  );

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS public_appointment_team_member_no_overlap;

ALTER TABLE public.appointments
  ADD CONSTRAINT public_appointment_team_member_no_overlap
  EXCLUDE USING gist (
    team_member_id WITH =,
    tstzrange(scheduled_at, COALESCE(public_booking_end, scheduled_at + make_interval(mins => duration_minutes)), '[)') WITH &&
  )
  WHERE (
    public_booking
    AND team_member_id IS NOT NULL
    AND status IN ('scheduled','confirmed')
    AND outcome IS NULL
  );
