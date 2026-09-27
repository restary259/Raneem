-- DARB Multi-Office Routing Foundation
-- Office is the physical/organizational location. Case assignment and appointment
-- ownership remain person-scoped. Only active team_member accounts may be attached
-- to an office or used as routing targets.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_he TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL UNIQUE,
  office_code TEXT UNIQUE,
  office_type TEXT NOT NULL DEFAULT 'darb'
    CHECK (office_type IN ('darb','partner','franchise')),
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
  membership_type TEXT NOT NULL DEFAULT 'staff'
    CHECK (membership_type IN ('owner','operator','backup','staff')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (office_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS office_one_active_primary_idx
  ON public.office_members (office_id)
  WHERE is_primary = true AND is_active = true;

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
  CHECK (
    is_open = false
    OR (open_time IS NOT NULL AND close_time IS NOT NULL AND close_time > open_time)
  )
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

UPDATE public.appointments a
SET office_id = c.office_id
FROM public.cases c
WHERE a.case_id = c.id
  AND a.office_id IS NULL
  AND c.office_id IS NOT NULL;

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

-- Seed the current DARB office identity. Booking will not surface publicly
-- until Admin assigns an eligible team member.
INSERT INTO public.offices (
  name_ar, name_en, name_he, slug, office_code, office_type, country, city,
  timezone, booking_enabled, is_active, display_order
)
SELECT
  'مكتب درب · طمرة',
  'DARB Office · Tamra',
  'משרד דרב · טמרה',
  'tamra',
  'TMRA',
  'darb',
  'IL',
  'Tamra',
  'Asia/Jerusalem',
  false,
  true,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM public.offices WHERE slug = 'tamra'
);

INSERT INTO public.office_booking_settings (office_id)
SELECT o.id
FROM public.offices o
WHERE o.slug = 'tamra'
  AND NOT EXISTS (
    SELECT 1 FROM public.office_booking_settings s WHERE s.office_id = o.id
  );

INSERT INTO public.office_hours (office_id, weekday, is_open, open_time, close_time)
SELECT o.id, d.weekday, d.is_open, d.open_time::time, d.close_time::time
FROM public.offices o
CROSS JOIN (
  VALUES
    (0, true, '10:00', '17:00'),
    (1, true, '10:00', '17:00'),
    (2, true, '10:00', '17:00'),
    (3, true, '10:00', '17:00'),
    (4, true, '10:00', '17:00'),
    (5, false, NULL, NULL),
    (6, false, NULL, NULL)
) AS d(weekday, is_open, open_time, close_time)
WHERE o.slug = 'tamra'
  AND NOT EXISTS (
    SELECT 1 FROM public.office_hours h
    WHERE h.office_id = o.id AND h.weekday = d.weekday
  );

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_active_team_member(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = p_user_id
      AND ur.role = 'team_member'::public.app_role
      AND p.deleted_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_team_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_team_member(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_office_team_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT public.is_active_team_member(NEW.user_id) THEN
    RAISE EXCEPTION 'Only active team members can be assigned to an office'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_office_team_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_office_team_member() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_validate_office_team_member ON public.office_members;
CREATE TRIGGER trg_validate_office_team_member
BEFORE INSERT OR UPDATE OF user_id ON public.office_members
FOR EACH ROW EXECUTE FUNCTION public.validate_office_team_member();

CREATE OR REPLACE FUNCTION public.validate_office_routing_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
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
    RAISE EXCEPTION 'Routing target must be an active member of the office'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_office_routing_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_office_routing_member() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_validate_office_routing_member ON public.office_routing_rules;
CREATE TRIGGER trg_validate_office_routing_member
BEFORE INSERT OR UPDATE OF office_id, assigned_user_id ON public.office_routing_rules
FOR EACH ROW EXECUTE FUNCTION public.validate_office_routing_member();

CREATE OR REPLACE FUNCTION public.resolve_office_assignee(
  p_office_id uuid,
  p_service_type text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
  SELECT chosen.user_id
  FROM (
    SELECT
      om.user_id,
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
      END AS routing_bucket,
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
      ) AS effective_priority,
      om.created_at
    FROM public.office_members om
    JOIN public.offices o ON o.id = om.office_id
    WHERE om.office_id = p_office_id
      AND om.is_active = true
      AND o.is_active = true
      AND o.deleted_at IS NULL
      AND public.is_active_team_member(om.user_id)
  ) chosen
  ORDER BY chosen.routing_bucket, chosen.effective_priority, chosen.created_at
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_office_assignee(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_office_assignee(uuid,text) TO authenticated, service_role;

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
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Team reads active offices" ON public.offices;
CREATE POLICY "Team reads active offices"
ON public.offices FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member')
  AND is_active = true
  AND deleted_at IS NULL
);

DROP POLICY IF EXISTS "Admins manage office members" ON public.office_members;
CREATE POLICY "Admins manage office members"
ON public.office_members FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Team reads own office memberships" ON public.office_members;
CREATE POLICY "Team reads own office memberships"
ON public.office_members FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage office hours" ON public.office_hours;
CREATE POLICY "Admins manage office hours"
ON public.office_hours FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage office breaks" ON public.office_breaks;
CREATE POLICY "Admins manage office breaks"
ON public.office_breaks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage office blackouts" ON public.office_blackouts;
CREATE POLICY "Admins manage office blackouts"
ON public.office_blackouts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage office booking settings" ON public.office_booking_settings;
CREATE POLICY "Admins manage office booking settings"
ON public.office_booking_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage office routing rules" ON public.office_routing_rules;
CREATE POLICY "Admins manage office routing rules"
ON public.office_routing_rules FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Public-booking collision protection: scope by BOTH office and person.
-- ---------------------------------------------------------------------------

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS public_appointment_office_no_overlap;

ALTER TABLE public.appointments
  ADD CONSTRAINT public_appointment_office_no_overlap
  EXCLUDE USING gist (
    office_id WITH =,
    tstzrange(scheduled_at, public_booking_end, '[)') WITH &&
  )
  WHERE (
    public_booking
    AND office_id IS NOT NULL
    AND status IN ('scheduled','confirmed')
    AND outcome IS NULL
  );

ALTER TABLE public.appointments
  ADD CONSTRAINT public_appointment_team_member_no_overlap
  EXCLUDE USING gist (
    team_member_id WITH =,
    tstzrange(scheduled_at, public_booking_end, '[)') WITH &&
  )
  WHERE (
    public_booking
    AND team_member_id IS NOT NULL
    AND status IN ('scheduled','confirmed')
    AND outcome IS NULL
  );

-- ---------------------------------------------------------------------------
-- Admin-only directory for office assignment. Returns ONLY team members.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_office_team_members()
RETURNS TABLE (
  id uuid,
  full_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
  SELECT p.id, p.full_name
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'team_member'::public.app_role
    AND p.deleted_at IS NULL
  ORDER BY p.full_name;
$$;

REVOKE ALL ON FUNCTION public.list_office_team_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_office_team_members() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Replace public appointment RPC with office-aware routing.
-- Existing 3-argument signature is deliberately removed so no legacy caller
-- silently bypasses office routing.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.manage_public_appointment(text,text,timestamptz);

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
SET search_path = public AS $$
DECLARE
  v_access public.public_appointment_access%ROWTYPE;
  v_case public.cases%ROWTYPE;
  v_appt public.appointments%ROWTYPE;
  v_office public.offices%ROWTYPE;
  v_office_id uuid;
  v_assignee uuid;
  v_created uuid;
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
        CASE
          WHEN v_appt.id IS NOT NULL
           AND v_appt.status IN ('scheduled','confirmed')
           AND v_appt.outcome IS NULL
          THEN v_appt.scheduled_at
          ELSE NULL
        END,
      'status',
        CASE
          WHEN v_appt.id IS NOT NULL
           AND v_appt.status IN ('scheduled','confirmed')
           AND v_appt.outcome IS NULL
          THEN v_appt.status
          ELSE NULL
        END,
      'office_id',
        CASE
          WHEN v_appt.id IS NOT NULL
           AND v_appt.status IN ('scheduled','confirmed')
           AND v_appt.outcome IS NULL
          THEN v_appt.office_id
          ELSE v_case.office_id
        END
    );
  END IF;

  IF p_action = 'cancel' THEN
    IF v_appt.id IS NOT NULL
       AND v_appt.status IN ('scheduled','confirmed')
       AND v_appt.outcome IS NULL THEN
      UPDATE public.appointments
      SET status = 'cancelled',
          outcome = 'cancelled',
          updated_at = now()
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

  IF p_slot < now() + interval '2 hours' THEN
    RAISE EXCEPTION 'Time unavailable';
  END IF;

  -- Reuse the currently assigned member only when that person is still an
  -- active team member of the selected office. Otherwise route server-side.
  SELECT om.user_id INTO v_assignee
  FROM public.office_members om
  WHERE om.office_id = v_office_id
    AND om.user_id = COALESCE(v_appt.team_member_id, v_case.assigned_to)
    AND om.is_active = true
    AND public.is_active_team_member(om.user_id)
  LIMIT 1;

  IF v_assignee IS NULL THEN
    v_assignee := public.resolve_office_assignee(v_office_id, p_service_type);
  END IF;

  IF v_assignee IS NULL THEN
    RAISE EXCEPTION 'Office unavailable';
  END IF;

  -- The office and assignee are snapshotted onto the case when this is a new
  -- booking or a reschedule to a different office.
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
        status = 'scheduled',
        updated_at = now()
    WHERE id = v_appt.id;
    v_created := v_appt.id;
  ELSE
    INSERT INTO public.appointments (
      case_id,
      office_id,
      team_member_id,
      scheduled_at,
      duration_minutes,
      status,
      public_booking,
      confirmation_status
    )
    VALUES (
      v_case.id,
      v_office_id,
      v_assignee,
      p_slot,
      COALESCE((SELECT default_duration_minutes FROM public.office_booking_settings WHERE office_id = v_office_id), 60),
      'scheduled',
      true,
      'pending'
    )
    RETURNING id INTO v_created;

    UPDATE public.public_appointment_access
    SET appointment_id = v_created,
        updated_at = now()
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
$$;

REVOKE ALL ON FUNCTION public.manage_public_appointment(text,text,timestamptz,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_public_appointment(text,text,timestamptz,uuid,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.assign_public_appointment_with_case()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    UPDATE public.appointments
    SET team_member_id = NEW.assigned_to,
        updated_at = now()
    WHERE case_id = NEW.id
      AND public_booking
      AND status IN ('scheduled','confirmed')
      AND outcome IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_public_appointment_with_case() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_public_appointment_with_case() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_assign_public_appointment_with_case ON public.cases;
CREATE TRIGGER trg_assign_public_appointment_with_case
AFTER UPDATE OF assigned_to ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.assign_public_appointment_with_case();

-- Existing confirmation flow: still only the assigned team member/admin may confirm.
-- Add office membership validation so removed staff cannot confirm stale requests.
CREATE OR REPLACE FUNCTION public.confirm_public_appointment(p_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_case public.cases%ROWTYPE;
  v_appt public.appointments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL
     OR NOT (
       public.has_role(auth.uid(),'team_member')
       OR public.has_role(auth.uid(),'admin')
     ) THEN
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
       SELECT 1
       FROM public.office_members om
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
$$;

REVOKE ALL ON FUNCTION public.confirm_public_appointment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_public_appointment(uuid) TO authenticated;


-- Booking-enabled offices must have a live primary team member and at least
-- one open day. This protects the invariant even if Admin writes via SQL/RPC.
CREATE OR REPLACE FUNCTION public.validate_office_booking_configuration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $
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
$;

REVOKE ALL ON FUNCTION public.validate_office_booking_configuration() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_office_booking_configuration() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_validate_office_booking_configuration ON public.offices;
CREATE TRIGGER trg_validate_office_booking_configuration
BEFORE INSERT OR UPDATE OF booking_enabled,is_active,deleted_at
ON public.offices
FOR EACH ROW
EXECUTE FUNCTION public.validate_office_booking_configuration();

-- If an admin removes a team_member role, any office memberships for that
-- account are deactivated immediately. Re-adding the role does not silently
-- restore old office access; Admin must explicitly reassign the member.
CREATE OR REPLACE FUNCTION public.deactivate_office_membership_when_team_role_removed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $
BEGIN
  IF TG_OP = 'DELETE'
     AND OLD.role = 'team_member'::public.app_role THEN
    UPDATE public.office_members
    SET is_active = false,
        is_primary = false,
        updated_at = now()
    WHERE user_id = OLD.user_id AND is_active = true;
  ELSIF TG_OP = 'UPDATE'
     AND OLD.role = 'team_member'::public.app_role
     AND NEW.role IS DISTINCT FROM OLD.role THEN
    UPDATE public.office_members
    SET is_active = false,
        is_primary = false,
        updated_at = now()
    WHERE user_id = OLD.user_id AND is_active = true;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$;

REVOKE ALL ON FUNCTION public.deactivate_office_membership_when_team_role_removed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_office_membership_when_team_role_removed() TO service_role;

DROP TRIGGER IF EXISTS trg_deactivate_office_membership_when_team_role_removed ON public.user_roles;
CREATE TRIGGER trg_deactivate_office_membership_when_team_role_removed
AFTER DELETE OR UPDATE OF role ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.deactivate_office_membership_when_team_role_removed();

-- Atomic office configuration write. All related settings/members/hours/rules
-- are changed in one database transaction. Only Admin may call it.
CREATE OR REPLACE FUNCTION public.save_office_configuration(
  p_office_id uuid,
  p_office jsonb,
  p_settings jsonb,
  p_hours jsonb,
  p_primary_user_id uuid DEFAULT NULL,
  p_backup_user_id uuid DEFAULT NULL,
  p_routing_rules jsonb DEFAULT '[]'::jsonb
)
RETURNS public.offices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $
DECLARE
  v_office public.offices%ROWTYPE;
  v_selected uuid[];
  v_rule jsonb;
  v_service_type text;
  v_rule_user uuid;
  v_rule_priority integer;
  v_rule_active boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NULLIF(trim(COALESCE(p_office->>'name_ar','')), '') IS NULL
     OR NULLIF(trim(COALESCE(p_office->>'name_en','')), '') IS NULL
     OR NULLIF(trim(COALESCE(p_office->>'city','')), '') IS NULL THEN
    RAISE EXCEPTION 'Office name and city are required';
  END IF;

  IF p_primary_user_id IS NOT NULL AND NOT public.is_active_team_member(p_primary_user_id) THEN
    RAISE EXCEPTION 'Only active team members can be assigned to an office';
  END IF;

  IF p_backup_user_id IS NOT NULL
     AND p_backup_user_id IS DISTINCT FROM p_primary_user_id
     AND NOT public.is_active_team_member(p_backup_user_id) THEN
    RAISE EXCEPTION 'Only active team members can be assigned to an office';
  END IF;

  IF p_primary_user_id IS NOT NULL AND p_backup_user_id IS NOT NULL
     AND p_primary_user_id = p_backup_user_id THEN
    RAISE EXCEPTION 'Primary and backup members must be different';
  END IF;

  IF p_office_id IS NULL THEN
    INSERT INTO public.offices (
      name_ar,name_en,name_he,slug,office_code,office_type,country,city,
      address_line_1,address_line_2,postal_code,phone,email,map_url,timezone,
      public_description_ar,public_description_en,public_description_he,
      booking_enabled,is_active,display_order
    )
    VALUES (
      trim(p_office->>'name_ar'), trim(p_office->>'name_en'), COALESCE(trim(p_office->>'name_he'),''),
      trim(p_office->>'slug'), NULLIF(trim(p_office->>'office_code'),''), COALESCE(p_office->>'office_type','darb'),
      COALESCE(NULLIF(trim(p_office->>'country'),''),'IL'), trim(p_office->>'city'),
      NULLIF(trim(p_office->>'address_line_1'),''), NULLIF(trim(p_office->>'address_line_2'),''),
      NULLIF(trim(p_office->>'postal_code'),''), NULLIF(trim(p_office->>'phone'),''),
      NULLIF(trim(p_office->>'email'),''), NULLIF(trim(p_office->>'map_url'),''),
      COALESCE(NULLIF(trim(p_office->>'timezone'),''),'Asia/Jerusalem'),
      NULLIF(trim(p_office->>'public_description_ar'),''), NULLIF(trim(p_office->>'public_description_en'),''),
      NULLIF(trim(p_office->>'public_description_he'),''), false,
      COALESCE((p_office->>'is_active')::boolean, true),
      COALESCE((p_office->>'display_order')::integer, 0)
    )
    RETURNING * INTO v_office;
  ELSE
    UPDATE public.offices
    SET
      name_ar=trim(p_office->>'name_ar'),
      name_en=trim(p_office->>'name_en'),
      name_he=COALESCE(trim(p_office->>'name_he'),''),
      slug=trim(p_office->>'slug'),
      office_code=NULLIF(trim(p_office->>'office_code'),''),
      office_type=COALESCE(p_office->>'office_type','darb'),
      country=COALESCE(NULLIF(trim(p_office->>'country'),''),'IL'),
      city=trim(p_office->>'city'),
      address_line_1=NULLIF(trim(p_office->>'address_line_1'),''),
      address_line_2=NULLIF(trim(p_office->>'address_line_2'),''),
      postal_code=NULLIF(trim(p_office->>'postal_code'),''),
      phone=NULLIF(trim(p_office->>'phone'),''),
      email=NULLIF(trim(p_office->>'email'),''),
      map_url=NULLIF(trim(p_office->>'map_url'),''),
      timezone=COALESCE(NULLIF(trim(p_office->>'timezone'),''),'Asia/Jerusalem'),
      public_description_ar=NULLIF(trim(p_office->>'public_description_ar'),''),
      public_description_en=NULLIF(trim(p_office->>'public_description_en'),''),
      public_description_he=NULLIF(trim(p_office->>'public_description_he'),''),
      is_active=COALESCE((p_office->>'is_active')::boolean, true),
      display_order=COALESCE((p_office->>'display_order')::integer, 0),
      booking_enabled=false
    WHERE id=p_office_id
      AND deleted_at IS NULL
    RETURNING * INTO v_office;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Office not found';
    END IF;
  END IF;

  -- Configure team first while booking is still disabled, then enable it only
  -- after all dependencies are valid.
  UPDATE public.office_members
  SET is_active=false, is_primary=false, updated_at=now()
  WHERE office_id=v_office.id;

  v_selected := ARRAY_REMOVE(ARRAY[p_primary_user_id,p_backup_user_id],NULL);

  IF p_primary_user_id IS NOT NULL THEN
    INSERT INTO public.office_members (office_id,user_id,membership_type,is_primary,is_active,priority)
    VALUES (v_office.id,p_primary_user_id,'operator',true,true,1)
    ON CONFLICT (office_id,user_id) DO UPDATE
      SET membership_type='operator',is_primary=true,is_active=true,priority=1,updated_at=now();
  END IF;

  IF p_backup_user_id IS NOT NULL THEN
    INSERT INTO public.office_members (office_id,user_id,membership_type,is_primary,is_active,priority)
    VALUES (v_office.id,p_backup_user_id,'backup',false,true,2)
    ON CONFLICT (office_id,user_id) DO UPDATE
      SET membership_type='backup',is_primary=false,is_active=true,priority=2,updated_at=now();
  END IF;

  INSERT INTO public.office_booking_settings (
    office_id,slot_interval_minutes,default_duration_minutes,minimum_lead_minutes,maximum_days_ahead
  )
  VALUES (
    v_office.id,
    GREATEST(5,LEAST(120,COALESCE((p_settings->>'slot_interval_minutes')::integer,30))),
    GREATEST(15,LEAST(240,COALESCE((p_settings->>'default_duration_minutes')::integer,60))),
    GREATEST(0,COALESCE((p_settings->>'minimum_lead_minutes')::integer,120)),
    GREATEST(1,LEAST(90,COALESCE((p_settings->>'maximum_days_ahead')::integer,14)))
  )
  ON CONFLICT (office_id) DO UPDATE
  SET slot_interval_minutes=EXCLUDED.slot_interval_minutes,
      default_duration_minutes=EXCLUDED.default_duration_minutes,
      minimum_lead_minutes=EXCLUDED.minimum_lead_minutes,
      maximum_days_ahead=EXCLUDED.maximum_days_ahead,
      updated_at=now();

  DELETE FROM public.office_hours WHERE office_id=v_office.id;
  INSERT INTO public.office_hours (office_id,weekday,is_open,open_time,close_time)
  SELECT
    v_office.id,
    (item->>'weekday')::integer,
    COALESCE((item->>'is_open')::boolean,false),
    CASE WHEN COALESCE((item->>'is_open')::boolean,false) THEN NULLIF(item->>'open_time','')::time ELSE NULL END,
    CASE WHEN COALESCE((item->>'is_open')::boolean,false) THEN NULLIF(item->>'close_time','')::time ELSE NULL END
  FROM jsonb_array_elements(COALESCE(p_hours,'[]'::jsonb)) AS item
  WHERE (item->>'weekday')::integer BETWEEN 0 AND 6;

  DELETE FROM public.office_routing_rules WHERE office_id=v_office.id;
  FOR v_rule IN SELECT * FROM jsonb_array_elements(COALESCE(p_routing_rules,'[]'::jsonb))
  LOOP
    v_service_type := NULLIF(trim(v_rule->>'service_type'),'');
    v_rule_user := NULLIF(v_rule->>'assigned_user_id','')::uuid;
    v_rule_priority := GREATEST(1,COALESCE((v_rule->>'priority')::integer,100));
    v_rule_active := COALESCE((v_rule->>'is_active')::boolean,true);

    IF v_service_type IS NOT NULL AND v_rule_user IS NOT NULL AND v_rule_active THEN
      IF NOT public.is_active_team_member(v_rule_user)
         OR NOT EXISTS (
           SELECT 1 FROM public.office_members om
           WHERE om.office_id=v_office.id AND om.user_id=v_rule_user AND om.is_active=true
         ) THEN
        RAISE EXCEPTION 'Routing target must be an active team member of the office';
      END IF;

      INSERT INTO public.office_routing_rules (
        office_id,service_type,assigned_user_id,priority,is_active
      ) VALUES (
        v_office.id,v_service_type,v_rule_user,v_rule_priority,true
      );
    END IF;
  END LOOP;

  UPDATE public.offices
  SET booking_enabled=COALESCE((p_office->>'booking_enabled')::boolean,false),
      updated_at=now()
  WHERE id=v_office.id
  RETURNING * INTO v_office;

  RETURN v_office;
END;
$;

REVOKE ALL ON FUNCTION public.save_office_configuration(uuid,jsonb,jsonb,jsonb,uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_office_configuration(uuid,jsonb,jsonb,jsonb,uuid,uuid,jsonb) TO authenticated;

-- Keep timestamps current for direct Admin updates.
CREATE OR REPLACE FUNCTION public.touch_office_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_offices_updated_at ON public.offices;
CREATE TRIGGER trg_offices_updated_at
BEFORE UPDATE ON public.offices
FOR EACH ROW EXECUTE FUNCTION public.touch_office_updated_at();

DROP TRIGGER IF EXISTS trg_office_members_updated_at ON public.office_members;
CREATE TRIGGER trg_office_members_updated_at
BEFORE UPDATE ON public.office_members
FOR EACH ROW EXECUTE FUNCTION public.touch_office_updated_at();

DROP TRIGGER IF EXISTS trg_office_hours_updated_at ON public.office_hours;
CREATE TRIGGER trg_office_hours_updated_at
BEFORE UPDATE ON public.office_hours
FOR EACH ROW EXECUTE FUNCTION public.touch_office_updated_at();

DROP TRIGGER IF EXISTS trg_office_booking_settings_updated_at ON public.office_booking_settings;
CREATE TRIGGER trg_office_booking_settings_updated_at
BEFORE UPDATE ON public.office_booking_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_office_updated_at();

DROP TRIGGER IF EXISTS trg_office_routing_rules_updated_at ON public.office_routing_rules;
CREATE TRIGGER trg_office_routing_rules_updated_at
BEFORE UPDATE ON public.office_routing_rules
FOR EACH ROW EXECUTE FUNCTION public.touch_office_updated_at();
