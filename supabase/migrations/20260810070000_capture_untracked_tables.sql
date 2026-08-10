-- Phase 1: Capture seven tables that exist in the live database but had no
-- CREATE TABLE migration (created via the Supabase SQL editor).
--
-- Without these, `supabase db reset` omits the tables entirely. Several are
-- referenced by tracked migrations (insurances has an ALTER COLUMN, schools is
-- a FK target, deletion_logs is inserted into by an Edge Function) — those
-- migrations would error on a fresh DB because the tables don't exist.
--
-- Column types/nullability reproduced faithfully from
-- src/integrations/supabase/types.ts:
--   * The Insert shape determines nullability: a column without `?` in Insert
--     is NOT NULL; one with `?` is nullable or has a DEFAULT.
--   * The Relationships array determines foreign keys exactly.
-- Defaults follow the codebase pattern (gen_random_uuid() for id, now() for
-- timestamps). CHECK constraints and indexes that cannot be verified from
-- types.ts are omitted rather than guessed.

-- ── 1. schools ──────────────────────────────────────────────────────────
-- Referenced as a FK target by case_submissions.school_id. Admin-managed via
-- AdminProgramsPage (behind ProtectedRoute allowedRoles=["admin"]).
CREATE TABLE IF NOT EXISTS public.schools (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  city        TEXT,
  country     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Admins manage schools"
  ON public.schools FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- Read access for everyone so the school picker works on student-facing forms.
CREATE POLICY IF NOT EXISTS "Authenticated can read schools"
  ON public.schools FOR SELECT TO authenticated USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;

-- ── 2. insurances ───────────────────────────────────────────────────────
-- Has an ALTER COLUMN currency in migration 20260806051845 (would error
-- without the table). Admin-managed via AdminProgramsPage. age_price_tiers and
-- waiting_periods are JSONB price-tier ladders edited by InsuranceRatesEditor.
CREATE TABLE IF NOT EXISTS public.insurances (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  tier             TEXT NOT NULL DEFAULT 'standard',
  billing_period   TEXT NOT NULL DEFAULT 'monthly',
  price            NUMERIC NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT 'ILS',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  provider         TEXT,
  coverage_scope   TEXT,
  max_age          INTEGER,
  min_months       INTEGER,
  max_months       INTEGER,
  description_ar   TEXT,
  description_en   TEXT,
  terms_url        TEXT,
  age_price_tiers  JSONB NOT NULL DEFAULT '[]'::jsonb,
  waiting_periods  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.insurances ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Admins manage insurances"
  ON public.insurances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY IF NOT EXISTS "Authenticated can read insurances"
  ON public.insurances FOR SELECT TO authenticated USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurances TO authenticated;

-- ── 3. case_payment_proofs ─────────────────────────────────────────────
-- Payment proof uploads for Germany (school) finance items. Read by students
-- (StudentFeesPage) and team (CaseFinance) scoped to their own case.
-- FKs: case_id → cases(id), payment_id → case_payments(id).
CREATE TABLE IF NOT EXISTS public.case_payment_proofs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  payment_id       UUID NOT NULL REFERENCES public.case_payments(id) ON DELETE CASCADE,
  payment_type     TEXT NOT NULL,
  file_path        TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  uploaded_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS case_payment_proofs_case_id_idx
  ON public.case_payment_proofs (case_id, uploaded_at DESC);

ALTER TABLE public.case_payment_proofs ENABLE ROW LEVEL SECURITY;
-- Anyone who can read a case's financials can read its payment proofs.
CREATE POLICY IF NOT EXISTS "Case parties can read payment proofs"
  ON public.case_payment_proofs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_payment_proofs.case_id
        AND (c.assigned_to = auth.uid() OR c.student_user_id = auth.uid())
    )
  );
-- Inserts are scoped to the assigned team member or admin.
CREATE POLICY IF NOT EXISTS "Team or admin can upload payment proofs"
  ON public.case_payment_proofs FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_payment_proofs.case_id AND c.assigned_to = auth.uid()
    )
  );
-- Updates (review/reject) are admin-only — German payments require admin review.
CREATE POLICY IF NOT EXISTS "Admins review payment proofs"
  ON public.case_payment_proofs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_payment_proofs TO authenticated;

-- ── 4. commission_transactions ──────────────────────────────────────────
-- One row per case recording the commission breakdown at payout time. Written
-- by record_case_commission (SECURITY DEFINER). FK: case_id → cases(id)
-- (isOneToOne per types.ts Relationships). Accessed only via RPCs/Edge
-- Functions, so no direct client policies beyond admin read.
CREATE TABLE IF NOT EXISTS public.commission_transactions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                   UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  total_payment_ils         NUMERIC NOT NULL DEFAULT 0,
  team_member_commission_ils NUMERIC NOT NULL DEFAULT 0,
  partner_commission_ils   NUMERIC NOT NULL DEFAULT 0,
  platform_revenue_ils     NUMERIC NOT NULL DEFAULT 0,
  team_member_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  partner_id               UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS commission_transactions_case_id_key
  ON public.commission_transactions (case_id);

ALTER TABLE public.commission_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Admins read commission transactions"
  ON public.commission_transactions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT, INSERT, UPDATE ON public.commission_transactions TO authenticated;
GRANT ALL ON public.commission_transactions TO service_role;

-- ── 5. deletion_logs ────────────────────────────────────────────────────
-- Audit trail for selective-delete (GDPR) operations. Written by the
-- selective-delete Edge Function via the service role. Restored via admin UI.
CREATE TABLE IF NOT EXISTS public.deletion_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type    TEXT NOT NULL,
  target_id      TEXT NOT NULL,
  mode           TEXT NOT NULL DEFAULT 'soft',
  deleted_by     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  categories     TEXT[] NOT NULL DEFAULT '{}',
  snapshot_json  JSONB,
  restored_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  restored_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS deletion_logs_target_idx
  ON public.deletion_logs (target_type, target_id);

ALTER TABLE public.deletion_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Admins manage deletion logs"
  ON public.deletion_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT, INSERT, UPDATE ON public.deletion_logs TO authenticated;
GRANT ALL ON public.deletion_logs TO service_role;

-- ── 6. admin_security_sessions ──────────────────────────────────────────
-- Short-lived session tokens for the admin re-authentication flow
-- (admin-verify Edge Function). No FK (admin_id references auth.users, not
-- profiles). Accessed only via Edge Functions with the service role.
CREATE TABLE IF NOT EXISTS public.admin_security_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS admin_security_sessions_admin_id_idx
  ON public.admin_security_sessions (admin_id);

ALTER TABLE public.admin_security_sessions ENABLE ROW LEVEL SECURITY;
-- No client policies: this table is only accessed via the service_role
-- (Edge Functions). RLS blocks all direct client access by default.
GRANT ALL ON public.admin_security_sessions TO service_role;

-- ── 7. leads_lawyer_safe ────────────────────────────────────────────────
-- A privacy-preserving view/materialized projection of leads for the lawyer
-- compliance dashboard. All columns nullable (the Row shape in types.ts shows
-- every field as `| null`). FK: companion_lead_id → leads(id) self-reference.
-- Read-only table populated by an Edge Function; no direct client writes.
CREATE TABLE IF NOT EXISTS public.leads_lawyer_safe (
  id                      UUID,
  full_name               TEXT,
  phone                   TEXT,
  city                    TEXT,
  age                     INTEGER,
  education_level         TEXT,
  english_units           INTEGER,
  math_units              INTEGER,
  german_level           TEXT,
  study_destination      TEXT,
  preferred_major        TEXT,
  preferred_city         TEXT,
  budget_range           TEXT,
  passport_type          TEXT,
  visa_history           TEXT,
  arab48_flag            BOOLEAN,
  accommodation         BOOLEAN,
  service_requested     TEXT,
  source_id             TEXT,
  source_type            TEXT,
  status                 TEXT,
  is_stale               BOOLEAN,
  last_contacted        TIMESTAMPTZ,
  eligibility_score      NUMERIC,
  eligibility_reason     TEXT,
  fraud_flags            TEXT[],
  companion_lead_id      UUID,
  notes                  TEXT,
  ref_code               TEXT,
  student_portal_created BOOLEAN,
  created_at             TIMESTAMPTZ,
  deleted_at             TIMESTAMPTZ
);

-- Self-reference FK matching the tracked leads table's companion column.
ALTER TABLE public.leads_lawyer_safe
  ADD CONSTRAINT leads_lawyer_safe_companion_lead_id_fkey
  FOREIGN KEY (companion_lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

ALTER TABLE public.leads_lawyer_safe ENABLE ROW LEVEL SECURITY;
-- Lawyer-safe view: only admins (and delegated lawyers) may read.
CREATE POLICY IF NOT EXISTS "Admins read leads_lawyer_safe"
  ON public.leads_lawyer_safe FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.leads_lawyer_safe TO authenticated;
GRANT ALL ON public.leads_lawyer_safe TO service_role;
