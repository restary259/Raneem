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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offices, public.office_members, public.office_hours, public.office_breaks, public.office_blackouts, public.office_booking_settings, public.office_routing_rules TO authenticated;
GRANT ALL ON public.offices, public.office_members, public.office_hours, public.office_breaks, public.office_blackouts, public.office_booking_settings, public.office_routing_rules TO service_role;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cases_office_id ON public.cases (office_id);
CREATE INDEX IF NOT EXISTS idx_appointments_office_scheduled ON public.appointments (office_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_team_scheduled ON public.appointments (team_member_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_office_members_user ON public.office_members (user_id, office_id);
CREATE INDEX IF NOT EXISTS idx_office_members_office_active ON public.office_members (office_id, is_active, priority);
CREATE INDEX IF NOT EXISTS idx_office_hours_lookup ON public.office_hours (office_id, weekday, is_open);
CREATE INDEX IF NOT EXISTS idx_office_blackouts_lookup ON public.office_blackouts (office_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_office_routing_lookup ON public.office_routing_rules (office_id, service_type, is_active, priority);

INSERT INTO public.offices (name_ar, name_en, name_he, slug, office_code, office_type, country, city, timezone, booking_enabled, is_active, display_order)
SELECT 'مكتب درب · طمرة', 'DARB Office · Tamra', 'משרד דרב · טמרה', 'tamra', 'TMRA', 'darb', 'IL', 'Tamra', 'Asia/Jerusalem', false, true, 1
WHERE NOT EXISTS (SELECT 1 FROM public.offices WHERE slug = 'tamra');

INSERT INTO public.office_booking_settings (office_id)
SELECT o.id FROM public.offices o
WHERE o.slug = 'tamra' AND NOT EXISTS (SELECT 1 FROM public.office_booking_settings s WHERE s.office_id = o.id);

INSERT INTO public.office_hours (office_id, weekday, is_open, open_time, close_time)
SELECT o.id, d.weekday, d.is_open, d.open_time::time, d.close_time::time
FROM public.offices o
CROSS JOIN (VALUES
  (0, true, '10:00', '17:00'), (1, true, '10:00', '17:00'), (2, true, '10:00', '17:00'),
  (3, true, '10:00', '17:00'), (4, true, '10:00', '17:00'), (5, false, NULL, NULL), (6, false, NULL, NULL)
) AS d(weekday, is_open, open_time, close_time)
WHERE o.slug = 'tamra'
  AND NOT EXISTS (SELECT 1 FROM public.office_hours h WHERE h.office_id = o.id AND h.weekday = d.weekday);

CREATE OR REPLACE FUNCTION public.is_active_team_member(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = p_user_id AND ur.role = 'team_member'::public.app_role
      AND p.deleted_at IS NULL AND p.deactivated_at IS NULL
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_team_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_team_member(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.validate_office_team_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_active_team_member(NEW.user_id) THEN
    RAISE EXCEPTION 'Only active team members can be assigned to an office' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_office_team_member() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS trg_validate_office_team_member ON public.office_members;
CREATE TRIGGER trg_validate_office_team_member BEFORE INSERT OR UPDATE OF user_id ON public.office_members
FOR EACH ROW EXECUTE FUNCTION public.validate_office_team_member();

CREATE OR REPLACE FUNCTION public.validate_office_routing_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_active_team_member(NEW.assigned_user_id) THEN
    RAISE EXCEPTION 'Only active team members can be routing targets' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.office_members om WHERE om.office_id = NEW.office_id AND om.user_id = NEW.assigned_user_id AND om.is_active = true) THEN
    RAISE EXCEPTION 'Routing target must be an active member of the office' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_office_routing_member() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS trg_validate_office_routing_member ON public.office_routing_rules;
CREATE TRIGGER trg_validate_office_routing_member BEFORE INSERT OR UPDATE OF office_id, assigned_user_id ON public.office_routing_rules
FOR EACH ROW EXECUTE FUNCTION public.validate_office_routing_member();

CREATE OR REPLACE FUNCTION public.validate_office_booking_configuration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.booking_enabled AND (NOT NEW.is_active OR NEW.deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Booking can only be enabled for an active office';
  END IF;
  IF NEW.booking_enabled AND NOT EXISTS (
    SELECT 1 FROM public.office_members om WHERE om.office_id = NEW.id AND om.is_primary AND om.is_active AND public.is_active_team_member(om.user_id)
  ) THEN
    RAISE EXCEPTION 'Booking requires an active primary team member';
  END IF;
  IF NEW.booking_enabled AND NOT EXISTS (
    SELECT 1 FROM public.office_hours oh WHERE oh.office_id = NEW.id AND oh.is_open AND oh.open_time IS NOT NULL AND oh.close_time IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Booking requires at least one open office day';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_office_booking_configuration() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS trg_validate_office_booking_configuration ON public.offices;
CREATE TRIGGER trg_validate_office_booking_configuration BEFORE INSERT OR UPDATE ON public.offices
FOR EACH ROW EXECUTE FUNCTION public.validate_office_booking_configuration();

CREATE OR REPLACE FUNCTION public.deactivate_office_membership_when_team_role_removed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'team_member'::public.app_role)
     OR (TG_OP = 'UPDATE' AND OLD.role = 'team_member'::public.app_role AND NEW.role IS DISTINCT FROM OLD.role) THEN
    UPDATE public.office_members SET is_active = false, is_primary = false, updated_at = now()
    WHERE user_id = OLD.user_id AND is_active = true;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.deactivate_office_membership_when_team_role_removed() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS trg_deactivate_office_membership_when_team_role_removed ON public.user_roles;
CREATE TRIGGER trg_deactivate_office_membership_when_team_role_removed AFTER DELETE OR UPDATE OF role ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.deactivate_office_membership_when_team_role_removed();

CREATE OR REPLACE FUNCTION public.deactivate_office_membership_on_profile_deactivation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.deactivated_at IS NOT NULL AND OLD.deactivated_at IS NULL THEN
    UPDATE public.office_members SET is_active = false, is_primary = false, updated_at = now()
    WHERE user_id = NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.deactivate_office_membership_on_profile_deactivation() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS trg_deactivate_office_membership_on_profile_deactivation ON public.profiles;
CREATE TRIGGER trg_deactivate_office_membership_on_profile_deactivation AFTER UPDATE OF deactivated_at ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.deactivate_office_membership_on_profile_deactivation();

ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_blackouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage offices" ON public.offices FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team reads active offices" ON public.offices FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'team_member') AND is_active = true AND deleted_at IS NULL);
CREATE POLICY "Admins manage office members" ON public.office_members FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team reads own office memberships" ON public.office_members FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "Admins manage office hours" ON public.office_hours FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage office breaks" ON public.office_breaks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage office blackouts" ON public.office_blackouts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage office booking settings" ON public.office_booking_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage office routing rules" ON public.office_routing_rules FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.list_office_team_members()
RETURNS TABLE (id uuid, full_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE public.has_role(auth.uid(), 'admin'::public.app_role)
    AND ur.role = 'team_member'::public.app_role AND p.deleted_at IS NULL AND p.deactivated_at IS NULL
  ORDER BY p.full_name;
$$;
REVOKE ALL ON FUNCTION public.list_office_team_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_office_team_members() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_office_configuration(
  p_office_id uuid, p_office jsonb, p_settings jsonb, p_hours jsonb,
  p_primary_user_id uuid DEFAULT NULL, p_backup_user_id uuid DEFAULT NULL, p_routing_rules jsonb DEFAULT '[]'::jsonb
)
RETURNS public.offices LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_office public.offices%ROWTYPE;
  v_rule jsonb;
  v_service_type text;
  v_rule_user uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF NULLIF(trim(COALESCE(p_office->>'name_ar','')), '') IS NULL
     OR NULLIF(trim(COALESCE(p_office->>'name_en','')), '') IS NULL
     OR NULLIF(trim(COALESCE(p_office->>'city','')), '') IS NULL THEN
    RAISE EXCEPTION 'Office name and city are required';
  END IF;
  IF p_primary_user_id IS NOT NULL AND NOT public.is_active_team_member(p_primary_user_id) THEN
    RAISE EXCEPTION 'Only active team members can be assigned to an office';
  END IF;
  IF p_backup_user_id IS NOT NULL AND NOT public.is_active_team_member(p_backup_user_id) THEN
    RAISE EXCEPTION 'Only active team members can be assigned to an office';
  END IF;
  IF p_primary_user_id IS NOT NULL AND p_primary_user_id = p_backup_user_id THEN
    RAISE EXCEPTION 'Primary and backup members must be different';
  END IF;

  IF p_office_id IS NULL THEN
    INSERT INTO public.offices (name_ar,name_en,name_he,slug,office_code,office_type,country,city,address_line_1,phone,email,map_url,timezone,booking_enabled,is_active,display_order)
    VALUES (trim(p_office->>'name_ar'), trim(p_office->>'name_en'), COALESCE(trim(p_office->>'name_he'),''),
      trim(p_office->>'slug'), NULLIF(trim(p_office->>'office_code'),''), COALESCE(p_office->>'office_type','darb'),
      COALESCE(NULLIF(trim(p_office->>'country'),''),'IL'), trim(p_office->>'city'),
      NULLIF(trim(p_office->>'address_line_1'),''), NULLIF(trim(p_office->>'phone'),''),
      NULLIF(trim(p_office->>'email'),''), NULLIF(trim(p_office->>'map_url'),''),
      COALESCE(NULLIF(trim(p_office->>'timezone'),''),'Asia/Jerusalem'), false,
      COALESCE((p_office->>'is_active')::boolean, true), COALESCE((p_office->>'display_order')::integer, 0))
    RETURNING * INTO v_office;
  ELSE
    UPDATE public.offices SET
      name_ar=trim(p_office->>'name_ar'), name_en=trim(p_office->>'name_en'), name_he=COALESCE(trim(p_office->>'name_he'),''),
      slug=trim(p_office->>'slug'), office_code=NULLIF(trim(p_office->>'office_code'),''),
      office_type=COALESCE(p_office->>'office_type','darb'), country=COALESCE(NULLIF(trim(p_office->>'country'),''),'IL'),
      city=trim(p_office->>'city'), address_line_1=NULLIF(trim(p_office->>'address_line_1'),''),
      phone=NULLIF(trim(p_office->>'phone'),''), email=NULLIF(trim(p_office->>'email'),''),
      map_url=NULLIF(trim(p_office->>'map_url'),''), timezone=COALESCE(NULLIF(trim(p_office->>'timezone'),''),'Asia/Jerusalem'),
      is_active=COALESCE((p_office->>'is_active')::boolean, true), display_order=COALESCE((p_office->>'display_order')::integer, 0),
      booking_enabled=false
    WHERE id=p_office_id AND deleted_at IS NULL
    RETURNING * INTO v_office;
    IF NOT FOUND THEN RAISE EXCEPTION 'Office not found'; END IF;
  END IF;

  UPDATE public.office_members SET is_active=false, is_primary=false, updated_at=now() WHERE office_id=v_office.id;
  IF p_primary_user_id IS NOT NULL THEN
    INSERT INTO public.office_members (office_id,user_id,membership_type,is_primary,is_active,priority)
    VALUES (v_office.id,p_primary_user_id,'operator',true,true,1)
    ON CONFLICT (office_id,user_id) DO UPDATE SET membership_type='operator',is_primary=true,is_active=true,priority=1,updated_at=now();
  END IF;
  IF p_backup_user_id IS NOT NULL THEN
    INSERT INTO public.office_members (office_id,user_id,membership_type,is_primary,is_active,priority)
    VALUES (v_office.id,p_backup_user_id,'backup',false,true,2)
    ON CONFLICT (office_id,user_id) DO UPDATE SET membership_type='backup',is_primary=false,is_active=true,priority=2,updated_at=now();
  END IF;

  INSERT INTO public.office_booking_settings (office_id,slot_interval_minutes,default_duration_minutes,minimum_lead_minutes,maximum_days_ahead)
  VALUES (v_office.id,
    GREATEST(5,LEAST(120,COALESCE((p_settings->>'slot_interval_minutes')::integer,30))),
    GREATEST(15,LEAST(240,COALESCE((p_settings->>'default_duration_minutes')::integer,60))),
    GREATEST(0,COALESCE((p_settings->>'minimum_lead_minutes')::integer,120)),
    GREATEST(1,LEAST(90,COALESCE((p_settings->>'maximum_days_ahead')::integer,14))))
  ON CONFLICT (office_id) DO UPDATE SET slot_interval_minutes=EXCLUDED.slot_interval_minutes,
    default_duration_minutes=EXCLUDED.default_duration_minutes, minimum_lead_minutes=EXCLUDED.minimum_lead_minutes,
    maximum_days_ahead=EXCLUDED.maximum_days_ahead, updated_at=now();

  DELETE FROM public.office_hours WHERE office_id=v_office.id;
  INSERT INTO public.office_hours (office_id,weekday,is_open,open_time,close_time)
  SELECT v_office.id, (item->>'weekday')::integer, COALESCE((item->>'is_open')::boolean,false),
    CASE WHEN COALESCE((item->>'is_open')::boolean,false) THEN NULLIF(item->>'open_time','')::time END,
    CASE WHEN COALESCE((item->>'is_open')::boolean,false) THEN NULLIF(item->>'close_time','')::time END
  FROM jsonb_array_elements(COALESCE(p_hours,'[]'::jsonb)) AS item
  WHERE (item->>'weekday')::integer BETWEEN 0 AND 6;

  DELETE FROM public.office_routing_rules WHERE office_id=v_office.id;
  FOR v_rule IN SELECT * FROM jsonb_array_elements(COALESCE(p_routing_rules,'[]'::jsonb)) LOOP
    v_service_type := NULLIF(trim(v_rule->>'service_type'),'');
    v_rule_user := NULLIF(v_rule->>'assigned_user_id','')::uuid;
    IF v_service_type IS NOT NULL AND v_rule_user IS NOT NULL AND COALESCE((v_rule->>'is_active')::boolean,true) THEN
      INSERT INTO public.office_routing_rules (office_id,service_type,assigned_user_id,priority,is_active)
      VALUES (v_office.id,v_service_type,v_rule_user,GREATEST(1,COALESCE((v_rule->>'priority')::integer,100)),true);
    END IF;
  END LOOP;

  UPDATE public.offices SET booking_enabled=COALESCE((p_office->>'booking_enabled')::boolean,false), updated_at=now()
  WHERE id=v_office.id RETURNING * INTO v_office;
  RETURN v_office;
END;
$$;
REVOKE ALL ON FUNCTION public.save_office_configuration(uuid,jsonb,jsonb,jsonb,uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_office_configuration(uuid,jsonb,jsonb,jsonb,uuid,uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_office_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
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
