-- ════════════════════════════════════════════════════════════════════════
-- Catch-up: ensure all columns referenced by the Commission Hub + Admin
-- Students page exist in the live database.
-- ════════════════════════════════════════════════════════════════════════
-- Root cause of "column referral_discount_amount does not exist" and the
-- cascading KPI/Student failures: the live database was missing columns that
-- were added by migrations between Aug 6–14 (referral_discount_amount,
-- agent_commission_rate, agent_self_referral_rate, etc.). Every ADD COLUMN
-- here is IF NOT EXISTS, so databases that already have them are untouched.
-- ════════════════════════════════════════════════════════════════════════


-- ── platform_settings: all columns referenced by get_commission_hub_overview ─
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS partner_commission_rate      NUMERIC NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS ambassador_commission_rate   NUMERIC NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS team_member_commission_rate  NUMERIC NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS master_partner_override_rate NUMERIC NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS agent_commission_rate        NUMERIC NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS agent_self_referral_rate     NUMERIC NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS referral_discount_amount     NUMERIC NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS student_refer_friend_discount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS student_refer_friend_reward   NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS student_refer_family_discount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS student_refer_family_reward   NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_rate                     NUMERIC NOT NULL DEFAULT 0.18;

-- ── profiles: all columns referenced by AdminStudentsPage PROFILE_SELECT ────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS linked_case_id            UUID,
  ADD COLUMN IF NOT EXISTS updated_by_student_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eye_color                 TEXT,
  ADD COLUMN IF NOT EXISTS has_changed_legal_name    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS previous_legal_name       TEXT,
  ADD COLUMN IF NOT EXISTS has_criminal_record       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS criminal_record_details   TEXT,
  ADD COLUMN IF NOT EXISTS has_dual_citizenship      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS second_passport_country   TEXT,
  ADD COLUMN IF NOT EXISTS must_change_password      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS passport_expiry           DATE,
  ADD COLUMN IF NOT EXISTS arrival_date              DATE,
  ADD COLUMN IF NOT EXISTS emergency_contact         TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name    TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone   TEXT,
  ADD COLUMN IF NOT EXISTS intake_month              TEXT,
  ADD COLUMN IF NOT EXISTS referral_code             TEXT,
  ADD COLUMN IF NOT EXISTS referral_code_enabled     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS agent_id                  UUID,
  ADD COLUMN IF NOT EXISTS master_partner_id         UUID,
  ADD COLUMN IF NOT EXISTS is_master_partner         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by                UUID,
  ADD COLUMN IF NOT EXISTS case_id                   UUID,
  ADD COLUMN IF NOT EXISTS city                      TEXT,
  ADD COLUMN IF NOT EXISTS gender                    TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth             DATE,
  ADD COLUMN IF NOT EXISTS country                   TEXT,
  ADD COLUMN IF NOT EXISTS nationality               TEXT,
  ADD COLUMN IF NOT EXISTS university_name           TEXT,
  ADD COLUMN IF NOT EXISTS notes                     TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at                TIMESTAMPTZ;

