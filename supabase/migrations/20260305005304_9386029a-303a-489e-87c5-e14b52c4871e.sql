
-- ============================================================
-- DARB PLATFORM v2 — OVERHAUL MIGRATION
-- Phase 1: Foundation Schema
-- ============================================================

-- STEP 1: NEW ROLE ENUM
-- Drop old user_roles (will be recreated)
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

CREATE TYPE public.app_role AS ENUM (
  'admin',
  'team_member',
  'social_media_partner',
  'student'
);

-- Recreate user_roles with new enum
CREATE TABLE public.user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- STEP 2: CORE HELPER FUNCTIONS (needed before any RLS policies)

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT role::TEXT FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Now add RLS policies to user_roles (requires has_role to exist)
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- STEP 3: PLATFORM SETTINGS

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_commission_rate     NUMERIC NOT NULL DEFAULT 500,
  forgotten_new_case_days     INTEGER NOT NULL DEFAULT 3,
  forgotten_contacted_days    INTEGER NOT NULL DEFAULT 5,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.platform_settings (id)
  SELECT gen_random_uuid()
  WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage settings" ON public.platform_settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "All authenticated can read settings" ON public.platform_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- STEP 4: PROGRAMS TABLE

CREATE TABLE IF NOT EXISTS public.programs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('language_school', 'course', 'university', 'other')),
  price       NUMERIC,
  currency    TEXT NOT NULL DEFAULT 'ILS',
  duration    TEXT,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage programs" ON public.programs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team can read programs" ON public.programs
  FOR SELECT USING (
    public.has_role(auth.uid(), 'team_member') OR public.has_role(auth.uid(), 'admin')
  );

-- STEP 5: ACCOMMODATIONS TABLE

CREATE TABLE IF NOT EXISTS public.accommodations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  price       NUMERIC,
  currency    TEXT NOT NULL DEFAULT 'ILS',
  description TEXT,
  photos      TEXT[] DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.accommodations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage accommodations" ON public.accommodations
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team can read accommodations" ON public.accommodations
  FOR SELECT USING (
    public.has_role(auth.uid(), 'team_member') OR public.has_role(auth.uid(), 'admin')
  );

-- STEP 6: CASES TABLE (unified pipeline)

DROP TABLE IF EXISTS public.cases CASCADE;
CREATE TABLE public.cases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        TEXT NOT NULL,
  phone_number     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'new'
                     CHECK (status IN (
                       'new', 'contacted', 'appointment_scheduled',
                       'profile_completion', 'payment_confirmed',
                       'submitted', 'enrollment_paid', 'forgotten', 'cancelled'
                     )),
  assigned_to      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source           TEXT NOT NULL DEFAULT 'apply_page'
                     CHECK (source IN ('apply_page', 'manual', 'submit_new_student', 'social_media_partner')),
  partner_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  discount_amount  NUMERIC NOT NULL DEFAULT 0,
  is_no_show       BOOLEAN NOT NULL DEFAULT false,
  student_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all cases" ON public.cases
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team can manage cases" ON public.cases
  FOR ALL USING (public.has_role(auth.uid(), 'team_member'));
CREATE POLICY "Partner can view their cases" ON public.cases
  FOR SELECT USING (
    public.has_role(auth.uid(), 'social_media_partner') AND partner_id = auth.uid()
  );
CREATE POLICY "Students can view own case" ON public.cases
  FOR SELECT USING (student_user_id = auth.uid());

-- STEP 7: CASE SUBMISSIONS

CREATE TABLE IF NOT EXISTS public.case_submissions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id              UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE UNIQUE,
  program_id           UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  accommodation_id     UUID REFERENCES public.accommodations(id) ON DELETE SET NULL,
  program_start_date   DATE,
  program_end_date     DATE,
  service_fee          NUMERIC NOT NULL DEFAULT 0,
  translation_fee      NUMERIC NOT NULL DEFAULT 0,
  payment_confirmed    BOOLEAN NOT NULL DEFAULT false,
  payment_confirmed_at TIMESTAMPTZ,
  payment_confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at         TIMESTAMPTZ,
  submitted_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  enrollment_paid_at   TIMESTAMPTZ,
  enrollment_paid_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  extra_data           JSONB DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.case_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage submissions" ON public.case_submissions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team manage submissions" ON public.case_submissions
  FOR ALL USING (public.has_role(auth.uid(), 'team_member'));
CREATE POLICY "Students view own submission" ON public.case_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id AND c.student_user_id = auth.uid()
    )
  );

-- STEP 8: APPOINTMENTS (rebuilt with outcome tracking)

DROP TABLE IF EXISTS public.appointments CASCADE;
CREATE TABLE public.appointments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id             UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  team_member_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  scheduled_at        TIMESTAMPTZ NOT NULL,
  duration_minutes    INTEGER NOT NULL DEFAULT 60,
  notes               TEXT,
  outcome             TEXT CHECK (outcome IN ('completed', 'delayed', 'cancelled', 'rescheduled', 'no_show')),
  outcome_notes       TEXT,
  outcome_recorded_at TIMESTAMPTZ,
  outcome_recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rescheduled_to      UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage appointments" ON public.appointments
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team manage appointments" ON public.appointments
  FOR ALL USING (public.has_role(auth.uid(), 'team_member'));
CREATE POLICY "Students view own appointments" ON public.appointments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id AND c.student_user_id = auth.uid()
    )
  );

-- STEP 9: ALTER DOCUMENTS

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS case_id               UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS uploaded_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_visible_to_student BOOLEAN NOT NULL DEFAULT true;

-- STEP 10: VISA APPLICATIONS

CREATE TABLE IF NOT EXISTS public.visa_applications (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                 UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE UNIQUE,
  student_user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  address_abroad          TEXT,
  contact_abroad          TEXT,
  bank_statement_url      TEXT,
  health_insurance_url    TEXT,
  accommodation_proof_url TEXT,
  additional_notes        TEXT,
  visa_applied_at         TIMESTAMPTZ,
  visa_outcome            TEXT CHECK (visa_outcome IN ('pending', 'approved', 'rejected')),
  visa_notes              TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.visa_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage visa applications" ON public.visa_applications
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team manage visa applications" ON public.visa_applications
  FOR ALL USING (public.has_role(auth.uid(), 'team_member'));
CREATE POLICY "Students manage own visa" ON public.visa_applications
  FOR ALL USING (student_user_id = auth.uid());

-- STEP 11: IMPORTANT CONTACTS

CREATE TABLE IF NOT EXISTS public.important_contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  role_ar       TEXT,
  role_en       TEXT,
  phone         TEXT,
  email         TEXT,
  link          TEXT,
  category      TEXT NOT NULL DEFAULT 'other'
                  CHECK (category IN ('emergency', 'medical', 'legal', 'team', 'other')),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.important_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage contacts" ON public.important_contacts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users read active contacts" ON public.important_contacts
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- STEP 12: REFERRALS (rebuilt)

DROP TABLE IF EXISTS public.referrals CASCADE;
CREATE TABLE public.referrals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  referred_name    TEXT NOT NULL,
  referred_phone   TEXT NOT NULL,
  discount_applied BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage referrals" ON public.referrals
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team manage referrals" ON public.referrals
  FOR ALL USING (public.has_role(auth.uid(), 'team_member'));
CREATE POLICY "Students view own referrals" ON public.referrals
  FOR SELECT USING (referrer_user_id = auth.uid());
CREATE POLICY "Students create referrals" ON public.referrals
  FOR INSERT WITH CHECK (referrer_user_id = auth.uid());

-- STEP 13: ACTIVITY LOG

CREATE TABLE IF NOT EXISTS public.activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name  TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read activity" ON public.activity_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert activity" ON public.activity_log
  FOR INSERT WITH CHECK (true);

-- STEP 14: ALTER PROFILES

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS case_id                 UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nationality             TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth           DATE,
  ADD COLUMN IF NOT EXISTS passport_number         TEXT,
  ADD COLUMN IF NOT EXISTS passport_expiry         DATE,
  ADD COLUMN IF NOT EXISTS emergency_contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS biometric_photo_url     TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_student_at   TIMESTAMPTZ;

-- STEP 15: ALTER NOTIFICATIONS

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS title_ar TEXT,
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS body_ar  TEXT,
  ADD COLUMN IF NOT EXISTS body_en  TEXT,
  ADD COLUMN IF NOT EXISTS link     TEXT,
  ADD COLUMN IF NOT EXISTS read     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS case_id  UUID REFERENCES public.cases(id) ON DELETE CASCADE;

-- STEP 16: TRIGGER FUNCTIONS

CREATE OR REPLACE FUNCTION public.update_case_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  NEW.last_activity_at = now();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_case_activity ON public.cases;
CREATE TRIGGER trg_case_activity
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.update_case_activity();

CREATE OR REPLACE FUNCTION public.notify_student_profile_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_case_id     UUID;
  v_team_member UUID;
BEGIN
  SELECT id, assigned_to INTO v_case_id, v_team_member
  FROM public.cases WHERE student_user_id = NEW.id LIMIT 1;

  IF v_case_id IS NOT NULL AND v_team_member IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id, title, body, source, title_ar, title_en, body_ar, body_en, case_id
    ) VALUES (
      v_team_member,
      'Student Updated Profile',
      'The student updated their personal information',
      'student_profile_updated',
      'الطالب حدّث ملفه الشخصي',
      'Student Updated Profile',
      'قام الطالب بتحديث معلوماته الشخصية',
      'The student updated their personal information',
      v_case_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_profile_update ON public.profiles;
CREATE TRIGGER trg_student_profile_update
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.updated_at IS DISTINCT FROM NEW.updated_at)
  EXECUTE FUNCTION public.notify_student_profile_update();

-- STEP 17: GET FORGOTTEN CASES RPC

CREATE OR REPLACE FUNCTION public.get_forgotten_cases()
RETURNS SETOF public.cases LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT c.* FROM public.cases c
  CROSS JOIN (SELECT * FROM public.platform_settings LIMIT 1) ps
  WHERE c.status NOT IN ('enrollment_paid', 'cancelled', 'forgotten')
  AND (
    (c.status = 'new'       AND c.last_activity_at < now() - (ps.forgotten_new_case_days || ' days')::interval)
    OR (c.status = 'contacted' AND c.last_activity_at < now() - (ps.forgotten_contacted_days || ' days')::interval)
    OR c.is_no_show = true
  )
$$;

-- STEP 18: LOG ACTIVITY FUNCTION

CREATE OR REPLACE FUNCTION public.log_activity(
  p_actor_id    UUID,
  p_actor_name  TEXT,
  p_action      TEXT,
  p_entity_type TEXT,
  p_entity_id   UUID DEFAULT NULL,
  p_metadata    JSONB DEFAULT '{}'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_log (actor_id, actor_name, action, entity_type, entity_id, metadata)
  VALUES (p_actor_id, p_actor_name, p_action, p_entity_type, p_entity_id, p_metadata);
END;
$$;

-- STEP 19: UPDATE handle_new_user (no auto role assignment — edge functions handle it)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone_number, country)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم جديد'),
    NEW.raw_user_meta_data->>'phone_number',
    NEW.raw_user_meta_data->>'country'
  )
  ON CONFLICT (id) DO UPDATE SET
    email        = EXCLUDED.email,
    full_name    = COALESCE(EXCLUDED.full_name, profiles.full_name),
    phone_number = COALESCE(EXCLUDED.phone_number, profiles.phone_number),
    country      = COALESCE(EXCLUDED.country, profiles.country),
    updated_at   = now();
  -- No automatic role assignment — roles are set by edge functions
  RETURN NEW;
END;
$$;

-- STEP 20: DATA RESET (correct CASCADE order — preserve user accounts)

TRUNCATE public.notifications CASCADE;
TRUNCATE public.activity_log CASCADE;
TRUNCATE public.visa_applications CASCADE;
TRUNCATE public.case_submissions CASCADE;
TRUNCATE public.appointments CASCADE;
TRUNCATE public.cases CASCADE;
