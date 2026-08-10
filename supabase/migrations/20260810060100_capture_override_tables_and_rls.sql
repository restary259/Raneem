-- Capture the commission override tables that exist in the live database but
-- had NO CREATE TABLE / ENABLE RLS / unique-constraint migration — they were
-- created directly via the Supabase SQL editor.
--
-- Why this matters:
--   * A fresh `supabase db reset` would not create these tables at all,
--     breaking CommissionSettingsPanel (admin UI) AND record_case_commission
--     (which SELECTs from partner_commission_overrides via partner_base_pool).
--   * The admin UI upserts with onConflict: "partner_id" / "team_member_id",
--     which requires a unique index that also had no migration.
--   * Only SELECT policies existed in migrations (partner/team read their own
--     row). There was NO admin INSERT/UPDATE/DELETE policy, so admin writes
--     relied on RLS being absent or configured out-of-band — a security gap.
--
-- This migration is additive and safe to run on the live DB:
--   * CREATE TABLE IF NOT EXISTS is a no-op where the tables already exist.
--   * ENABLE ROW LEVEL SECURITY is idempotent.
--   * CREATE POLICY IF NOT EXISTS preserves any existing policy.
--   * No data is moved, dropped, or rewritten.
--
-- Schema reproduced from src/integrations/supabase/types.ts (the live shape):
--   partner_commission_overrides(partner_id, commission_amount, notes,
--     show_all_cases, master_override_amount, created_at, updated_at, id)
--   team_member_commission_overrides(team_member_id, commission_amount, notes,
--     created_at, updated_at, id)

-- ── 1. partner_commission_overrides ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_commission_overrides (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  commission_amount      NUMERIC NOT NULL DEFAULT 0,
  master_override_amount NUMERIC,
  notes                  TEXT,
  show_all_cases         BOOLEAN,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The admin UI upserts with onConflict: "partner_id" (one rate per partner).
CREATE UNIQUE INDEX IF NOT EXISTS partner_commission_overrides_partner_id_key
  ON public.partner_commission_overrides (partner_id);

ALTER TABLE public.partner_commission_overrides ENABLE ROW LEVEL SECURITY;

-- Partners can read their own override row (already existed in migrations).
CREATE POLICY IF NOT EXISTS "Partners can read own override"
  ON public.partner_commission_overrides FOR SELECT TO authenticated
  USING (partner_id = auth.uid());

-- Admins can read, insert, update and delete any override row. This is the
-- missing write policy: commission configuration is admin-managed, and the
-- admin UI (CommissionSettingsPanel) writes via the browser client.
CREATE POLICY IF NOT EXISTS "Admins manage partner overrides"
  ON public.partner_commission_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── 2. team_member_commission_overrides ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_member_commission_overrides (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The admin UI upserts with onConflict: "team_member_id" (one rate per member).
CREATE UNIQUE INDEX IF NOT EXISTS team_member_commission_overrides_team_member_id_key
  ON public.team_member_commission_overrides (team_member_id);

ALTER TABLE public.team_member_commission_overrides ENABLE ROW LEVEL SECURITY;

-- Team members can read their own override row (already existed in migrations).
CREATE POLICY IF NOT EXISTS "Team members can read own override"
  ON public.team_member_commission_overrides FOR SELECT TO authenticated
  USING (team_member_id = auth.uid());

-- Admins manage all team-member overrides (the missing write policy).
CREATE POLICY IF NOT EXISTS "Admins manage team overrides"
  ON public.team_member_commission_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── 3. Grants ───────────────────────────────────────────────────────────
-- Authenticated users need table privileges for the policies above to apply.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_commission_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_member_commission_overrides TO authenticated;
