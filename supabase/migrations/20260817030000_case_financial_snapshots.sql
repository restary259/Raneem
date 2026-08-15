-- ════════════════════════════════════════════════════════════════════════
-- G3 — Financial snapshot table (historical immutability)
-- ════════════════════════════════════════════════════════════════════════
-- Freezes the gross/net/discount/rates/payouts of a case at enrollment so
-- future rate/discount changes can't rewrite history. The mutable `cases` row
-- (and global platform_settings rates) can change over time; this snapshot is
-- the immutable record of WHAT was actually computed when the commission split
-- ran. One row per case (UNIQUE case_id), written once by
-- record_case_commission (ON CONFLICT DO NOTHING — never overwritten).
--
-- RLS: admin SELECT only. No INSERT/UPDATE/DELETE policy for authenticated —
-- the only writer is the SECURITY DEFINER record_case_commission (owner
-- bypasses RLS). Students/partners cannot read another case's finances.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.case_financial_snapshots (
  case_id                 UUID PRIMARY KEY REFERENCES public.cases(id) ON DELETE RESTRICT,

  -- Totals (ILS)
  gross_total             INTEGER NOT NULL DEFAULT 0,
  referral_discount       INTEGER NOT NULL DEFAULT 0,
  net_total               INTEGER NOT NULL DEFAULT 0,

  -- Attribution at split time
  referrer_id             UUID,
  referrer_role           TEXT,   -- 'partner' | 'ambassador' | 'agent' | 'student' | NULL
  agent_id                UUID,   -- the recruit's agent (NULL if none / self-ref / student)
  master_partner_id       UUID,   -- master who took a pool carve (NULL if none)

  -- Rates used (the resolved effective amounts, frozen)
  partner_rate_used       INTEGER NOT NULL DEFAULT 0,  -- pool amount
  agent_rate_used         INTEGER NOT NULL DEFAULT 0,  -- additive agent share
  master_rate_used        INTEGER NOT NULL DEFAULT 0,  -- master carve from pool
  team_rate_used          INTEGER NOT NULL DEFAULT 0,  -- flat team commission
  student_reward_used     INTEGER NOT NULL DEFAULT 0,  -- student-referral reward

  -- Payout amounts (what each party actually received)
  partner_commission      INTEGER NOT NULL DEFAULT 0,  -- partner's net pool share
  agent_override          INTEGER NOT NULL DEFAULT 0,  -- additive agent_override reward
  master_override         INTEGER NOT NULL DEFAULT 0,  -- master's recruitment share
  team_commission         INTEGER NOT NULL DEFAULT 0,
  student_reward          INTEGER NOT NULL DEFAULT 0,
  total_payouts           INTEGER NOT NULL DEFAULT 0,
  darb_margin             INTEGER NOT NULL DEFAULT 0,  -- platform_revenue_ils at split

  -- Classification of the chain (matches record_case_commission branches)
  attribution_model       TEXT NOT NULL DEFAULT 'additive',
  is_agent_self_referral  BOOLEAN NOT NULL DEFAULT false,
  is_student_referrer     BOOLEAN NOT NULL DEFAULT false,
  student_referral_type   TEXT,   -- 'friend' | 'family' | NULL

  recorded_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_financial_snapshots_referrer
  ON public.case_financial_snapshots (referrer_id);
CREATE INDEX IF NOT EXISTS idx_case_financial_snapshots_agent
  ON public.case_financial_snapshots (agent_id);
CREATE INDEX IF NOT EXISTS idx_case_financial_snapshots_recorded_at
  ON public.case_financial_snapshots (recorded_at DESC);

ALTER TABLE public.case_financial_snapshots ENABLE ROW LEVEL SECURITY;

-- Admin-only read. No client INSERT/UPDATE/DELETE (only the SECURITY DEFINER
-- engine writes, as owner, bypassing RLS).
DROP POLICY IF EXISTS "Admins view case financial snapshots" ON public.case_financial_snapshots;
CREATE POLICY "Admins view case financial snapshots"
  ON public.case_financial_snapshots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.case_financial_snapshots FROM anon, authenticated;
GRANT SELECT ON public.case_financial_snapshots TO authenticated;

COMMENT ON TABLE public.case_financial_snapshots IS
  'Immutable financial snapshot written once by record_case_commission at enrollment. Freezes gross/net/discount/rates/payouts so future rate changes cannot rewrite historical commissions.';
