-- ════════════════════════════════════════════════════════════════════════
-- Commission Hub — Schema Migration A (additive, no behavior change)
-- ════════════════════════════════════════════════════════════════════════
-- Adds the audit-history table + the student-referral reward schema that the
-- centralized Admin Commission Hub requires. Everything is ADDITIVE and
-- idempotent (IF NOT EXISTS). All new monetary columns default to 0 (₪0) so
-- no account or referral is implicitly granted a commission (NEW ACCOUNT
-- DEFAULT / no-unsafe-default rule). No existing data is touched, no function
-- is redefined here, and no historical reward is recalculated.
--
-- Companion migrations:
--   20260816010000_commission_engine_canonical.sql  (engine + student branch)
--   20260816020000_commission_hub_rpcs.sql           (admin_set_commission + Hub reads)
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. commission_rate_history — who configured it / when / old → new ──────
-- The single audit trail for every commission-config change. Populated ONLY by
-- admin_set_commission (Step 4). Enables "what was the rate on date D" and
-- protects historical integrity (already-paid rewards snapshot rate_used /
-- base_amount, so historical commissions are frozen regardless).
CREATE TABLE IF NOT EXISTS public.commission_rate_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT NOT NULL CHECK (entity_type IN (
                 'global','partner','team','agent','agent_self_referral',
                 'student_override')),
  entity_id    UUID,                 -- NULL for global rows
  rate_kind    TEXT NOT NULL,        -- e.g. 'partner_commission_rate', 'commission_amount'
  old_value     NUMERIC,
  new_value     NUMERIC,
  changed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason       TEXT
);

CREATE INDEX IF NOT EXISTS idx_commission_rate_history_entity
  ON public.commission_rate_history (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_commission_rate_history_changed_at
  ON public.commission_rate_history (changed_at DESC);

ALTER TABLE public.commission_rate_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view commission rate history" ON public.commission_rate_history;
CREATE POLICY "Admins view commission rate history"
  ON public.commission_rate_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
-- Writes happen only via the SECURITY DEFINER admin_set_commission RPC (owner
-- bypasses RLS). No direct INSERT/UPDATE/DELETE policy for authenticated.
REVOKE ALL ON public.commission_rate_history FROM anon;
GRANT SELECT ON public.commission_rate_history TO authenticated;

-- ── 2. platform_settings — student-referral global config (Rule 6) ─────────
-- All default 0: a student referral pays nothing until an admin configures it.
-- The referred friend's discount already lives in referral_discount_amount.
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS student_refer_friend_discount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS student_refer_friend_reward   NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS student_refer_family_discount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS student_refer_family_reward   NUMERIC NOT NULL DEFAULT 0;

-- ── 3. referrals.referral_type — friend / family / NULL (legacy) ───────────
-- NULL is allowed so every legacy referral row keeps working unchanged.
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS referral_type TEXT
  CHECK (referral_type IS NULL OR referral_type IN ('friend', 'family'));

-- ── 4. student_referral_reward_overrides — per-student overrides (Rule 6) ──
-- One row per (student, referral_type). If a row exists, its reward_amount is
-- used instead of the global default (even if 0). Default 0 = no unsafe grant.
CREATE TABLE IF NOT EXISTS public.student_referral_reward_overrides (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_type  TEXT NOT NULL CHECK (referral_type IN ('friend', 'family')),
  reward_amount  NUMERIC NOT NULL DEFAULT 0,
  notes          TEXT,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS student_referral_reward_overrides_student_type_key
  ON public.student_referral_reward_overrides (student_id, referral_type);

ALTER TABLE public.student_referral_reward_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students read own referral reward overrides" ON public.student_referral_reward_overrides;
CREATE POLICY "Students read own referral reward overrides"
  ON public.student_referral_reward_overrides FOR SELECT TO authenticated
  USING (student_id = auth.uid());
DROP POLICY IF EXISTS "Admins manage student referral reward overrides" ON public.student_referral_reward_overrides;
CREATE POLICY "Admins manage student referral reward overrides"
  ON public.student_referral_reward_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.student_referral_reward_overrides FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_referral_reward_overrides TO authenticated;

-- ── 5. Deprecate referrals.discount_applied ────────────────────────────────
-- Never written by any code path; the discount is derived from
-- cases.referral_discount > 0 (AGENTS.md). Comment-only, no data change.
COMMENT ON COLUMN public.referrals.discount_applied IS
  'DEPRECATED — never written. The referral discount is derived from cases.referral_discount > 0.';

-- ── 6. agent_commission_overrides / agent_self_referral_overrides ──────────
-- Ensure created_by / updated_by audit columns exist so admin_set_commission
-- can record who changed a per-agent rate (Rule 4). Additive, nullable.
ALTER TABLE public.agent_commission_overrides
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.agent_self_referral_overrides
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

