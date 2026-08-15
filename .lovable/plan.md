# Agent Dashboard — Forensic Audit (read-only, no code changed)

Live data snapshot used for verification (production DB, 2026-08-15):
- 1 agent: `helal diab` / agen1@gmail.com / `3c00373d…` / referral_code `helalr-62a3`, recruit link `AG-…` exists (1 row in `partner_links`, purpose `recruit`), `agent_can_invite_directly = true`, `agent_can_create_accounts = true`.
- `profiles.agent_id` non-null rows: **0** → the agent has **zero recruits**.
- `agent_relationships`: **0 rows**.
- `user_invitations` with `agent_id` set: 2, both **revoked** (partner12@, patner11@).
- Cases attributable to the agent: **1** (`2dc31ba8…`, `partner_id = agent`, method `link`, status `new`).
- `rewards` where `user_id = agent`: **0**. No `agent_override` or `agent`-role reward exists anywhere yet.

## 1. Surface map (every agent route)

| Route | Component | Notes |
|---|---|---|
| `/agent` | `AgentOverviewPage` | KPIs, earnings, links, recent recruits |
| `/agent/network` | `AgentNetworkHubPage` → tabs `network` / `recruit` / `performance` | `AgentNetworkPage`, `AgentRecruitPage`, `AgentAnalyticsPage` |
| `/agent/recruit` | redirect → `network?tab=recruit` | |
| `/agent/analytics` | redirect → `network?tab=performance` | |
| `/agent/students` | `AgentStudentsPage` | |
| `/agent/apply` | `AgentApplyPage` | `ApplyForm` + `ReferralLinkCard` |
| `/agent/earnings` | `AgentEarningsHubPage` → tabs `earnings` / `bank` | `AgentEarningsPage`, `AgentBankDetailsPage` |
| `/agent/bank-details` | redirect → `earnings?tab=bank` | |
| `/agent/messages` | `AgentMessagesPage` → `PartnerMessagesPage viewerRole="agent"` | |
| `/agent/profile` | `AgentSettingsPage` | profile + password |
| Mobile | `MobileBottomNav`: overview / network / earnings / messages + More (students, apply, account) | |

Data layer: `useAgentOverview` (profiles, `get_my_agent_network`, `ensure_agent_recruit_link`, `platform_settings`, `agent_commission_overrides`, `agent_self_referral_overrides`, `get_my_agent_kpis`) and `useEarningsSummary` (`get_my_earnings_summary`). `AgentStudentsPage` queries `cases` directly under RLS.

## 2. KPI inventory + UI vs DB

Row 1 (`AgentOverviewPage` `kpis`):

| KPI (label) | Source | UI now | Expected from DB | Status |
|---|---|---|---|---|
| Recruited partners | `get_my_agent_kpis.partners` (profiles.agent_id + role) | 0 | 0 | WORKING |
| Recruited ambassadors | `…ambassadors` | 0 | 0 | WORKING |
| **Network students** | `stats.totalStudents` = `students_total` (**includes direct**) | 1 | network = 0, total = 1 | **MISLABELLED** |
| Paid cases | `cases_enrolled` (status `enrollment_paid`) | 0 | 0 | WORKING |

Row 2 (`funnelKpis`):

| KPI | Source | UI now | Expected | Status |
|---|---|---|---|---|
| Direct referrals | `students_direct` | 1 | 1 | WORKING |
| Via partners | `students_partner` | 0 | 0 | WORKING (unverifiable at scale, 0 recruits) |
| Via ambassadors | `students_ambassador` | 0 | 0 | WORKING (unverified) |
| Submitted | `cases_submitted` = `status IN ('submitted','enrollment_paid')` | 0 | 0 | **PARTIALLY WORKING** — overlaps "Paid cases"; a paid case is counted twice across the two rows |
| Conversion | client: `enrolled / totalStudents` | 0% | 0% | WORKING (denominator = all students incl. direct) |

Earnings buckets (overview + `AgentEarningsPage`, both from `get_my_earnings_summary`): Total / Available / Locked / Requested / Paid — all ₪0, DB agrees (0 rewards). Mutually exclusive bucketing is correct (`paid` → `requested` → `locked` → `available`). Status: WORKING but **never exercised** for an agent.

Rates (`Student sources` card + Analytics): `platform_settings.agent_commission_rate` / `agent_self_referral_rate` with per-agent override tables. WORKING; values are *rates*, not earnings — the Analytics "Commission by source" card shows a **rate** in the money column, which reads like earned commission (MISLEADING).

Computed but never rendered: `stats.overrideEarned`, `stats.newCases`, `stats.casesLast30d`, `stats.activeRecruits`, `stats.commissionNetwork`, `stats.commissionSelf`, and `earnings.items` (full reward history) — **DEAD DATA** (loaded, never displayed).

## 3. List / table inventory

1. **Recent recruits** (overview, top 5 by `joined_at`) — from `get_my_agent_network`. Empty. Correct.
2. **Network table** (`AgentNetworkPage`) — columns Name / Role / Students / Paid / Override / Status, tabs All-Partners-Ambassadors-Active-Pending, search by name, 25/page, detail Sheet (city, email, join date, students, paid cases, override earned, referral code). Source `get_my_agent_network`. **`Pending` tab is dead**: `status` is derived only from `deactivated_at` (`active` | `inactive`), so it can never equal pending; the 2 pending/revoked invitations are invisible anywhere in the dashboard.
3. **Students table** (`AgentStudentsPage`) — first name / source / stage / date, chips All-Partner-Ambassador-Self, search, 25/page, `limit(200)` hard cap, no server-side filter. Source: direct `cases` select `.or(partner_id.in(…),referred_by.in(…))` under the agent RLS policy. Currently 1 row (the agent's own case) — matches DB. Risks: 200-row ceiling silently truncates; `classifySource` falls through to `"all"` for a case the RLS returns but that isn't matched to a recruit, so `counts.all` can exceed partner+ambassador+self.
4. **Cases list** — none beyond #3. There is **no agent-facing case pipeline view**.
5. **Commission / transaction history** — **MISSING**. `AgentEarningsPage` shows 4 buckets and a link to chat; the per-reward `items[]` array returned by the RPC is discarded. No payout-request history list either.
6. **Top performers** (Analytics, top 10 by `override_earned`, two inline bars) — from the recruit list. Empty.
7. Messages inbox (shared partner inbox) and Bank details / Settings forms — form state only, no KPIs.

## 4. Attribution audit (Agent → Partner/Ambassador → Student → Case → Commission)

- Ownership edge is `profiles.agent_id`, maintained by `sync_agent_relationship_row` triggers; `agent_relationships` is an audit mirror (currently empty because there are no recruits — consistent, not proof it works).
- `get_my_agent_kpis.scoped` counts a case once (`DISTINCT ON (c.id)`) when `partner_id`/`referred_by` is the agent or any recruit, excluding archived/deleted. Self wins over network in the tie-break. **Gap:** when a case's `partner_id` maps to one recruit and `referred_by` to a *different* recruit, the `LEFT JOIN … ON r.id = c.partner_id OR r.id = c.referred_by` yields two rows and the `ORDER BY` does not disambiguate partner vs ambassador → the partner/ambassador split is non-deterministic (totals stay correct).
- `get_my_agent_network` counts per recruit with the same rules; `override_earned` = `rewards.reward_type='agent_override' AND source_user_id = recruit`.
- Commission (`record_case_commission`, fires only at `enrollment_paid`): agent self-referral → `rewards.reward_type='referral', recipient_role='agent'`, amount `get_effective_agent_self_referral` (₪1000 default). Network → `reward_type='agent_override', source_user_id = partner`, amount `get_effective_agent_split` (₪500 default, additive, uncapped). Both paths are **UNVERIFIED in production** (no agent-attributed case has reached `enrollment_paid`).
- `get_my_agent_kpis.commission_self` = every reward that is not `agent_override`; correct for a pure agent account, but it would also absorb any non-agent reward type an agent account ever received.
- Isolation: all agent RPCs are `SECURITY DEFINER` scoped by `auth.uid()` + an `agent` role check, and the `cases` SELECT policy uses `agent_owns_recruit`. No cross-agent leak found; only one agent exists, so this is code-verified, not data-verified.

## 5. Broken / misleading / dead — ranked

**High**
1. `Network students` KPI displays `students_total` (network + direct) under a network label; the same case is also counted in `Direct referrals` below → apparent double count.
2. `Submitted` KPI includes `enrollment_paid`, so the same case appears in both `Submitted` and `Paid cases`.
3. No commission/transaction history for the agent although `get_my_earnings_summary.items` already returns it — the agent cannot see which case produced which ₪.
4. Pending recruits are invisible: `Pending` tab is structurally always 0 and invited-but-not-activated recruits appear nowhere.

**Medium**
5. Analytics duplicates the overview aggregation client-side from the recruit list instead of `get_my_agent_kpis` → two sources of truth that can disagree.
6. Analytics "Commission by source" shows configured rates styled as earnings.
7. `AgentStudentsPage` `limit(200)` with client-side filtering, search and paging; silent truncation past 200 cases.
8. `classifySource` fallback `"all"` mixes unclassified cases into the All chip count.
9. Non-deterministic partner-vs-ambassador tagging when `partner_id` and `referred_by` point at different recruits.

**Low**
10. Dead loaded metrics: `overrideEarned`, `newCases`, `casesLast30d`, `activeRecruits`, `commissionNetwork`, `commissionSelf`.
11. `useAgentOverview` imports `useEffect` unused; `AgentNetworkPage` "Recruit" button targets the redirect route `/agent/recruit` rather than the hub tab.
12. `agent-create-account` is still absent from `supabase/config.toml`.

**Unverifiable without live data:** every network KPI, per-recruit override, agent reward creation, the ₪500 additive split and the ₪1000 self-referral reward. Nothing false was found in their SQL; they simply have never produced a row.

## 6. Recommended next step (not executed)

Seed one end-to-end path in staging — recruit a partner (activated, `profiles.agent_id` stamped), route a student through that partner's referral link, drive the case to `enrollment_paid` — then re-run this comparison to convert the ~12 UNVERIFIED items into WORKING/BROKEN. Fixes for items 1–4 are one-file frontend changes plus one label/threshold change in `get_my_agent_kpis`; say the word and I'll scope them as a separate change.
