# Commission defaults audit — root cause and surgical fix

## What I verified (live, before writing this plan)

- `platform_settings` currently holds `partner_commission_rate = 0`, `ambassador_commission_rate = 0`, `team_member_commission_rate = 0`, `agent_commission_rate = 0`, `agent_self_referral_rate = 0`. This is the single global source of truth.
- Account creation does **not** write any commission default. `create-team-member` writes `profiles.commission_amount = 0` (a legacy column, not used by the current engine); `agent-create-account` writes `0`. The only function in the database that inserts into `partner_commission_overrides` / `agent_commission_overrides` / `agent_self_referral_overrides` / `team_member_commission_overrides` is `admin_set_commission`. So a newly created account has **no override row** and its effective rate is the global rate — the creation path is already correct.
- The per-account override rows that exist today (₪1000 partner rows, ₪500/₪1000 agent rows, ₪1000 team rows, one ₪300 partner row) were each written by the admin account through the Commission Hub — every one has a matching `commission_rate_history` entry with `entity_type` per-account, `old_value = null`, `changed_by = <admin>`. They are real saved overrides, not generated defaults.
- The Admin Commission Hub list RPCs (`get_partner_list`, `get_ambassador_list`, `get_agent_list`, `get_team_members_commission`, `get_commission_hub_overview`) all read the globals from `platform_settings` with `COALESCE(..., 0)` — no hardcoded money in SQL.

## Root cause of the wrong displayed defaults

Two layers, both on the **read/render** side only:

1. **RLS gap.** The only SELECT policy on `platform_settings` is
   `admin OR team_member OR social_media_partner`. **Ambassadors and agents are missing.** Their dashboard queries return `null`, not the real rate.
2. **Hardcoded frontend fallbacks** then fill that `null` with invented money:
   - `src/pages/partner/PartnerOverviewPage.tsx` — `useState<number>(500)`, `?? 300` (ambassador), `?? 500` (partner). An ambassador therefore always renders **₪300** regardless of the Admin setting.
   - `src/hooks/useAgentOverview.ts` — `?? 1000` for the partner pool and `?? 1000` for the agent self-referral rate. An agent therefore renders **₪1000**.
   - `src/pages/team/TeamAnalyticsPage.tsx` — `?? 100` for the team rate.
   - `src/pages/admin/AdminSubmissionsPage.tsx` — `?? 100` for the team rate in the payment-split preview (admin can read the table, so this one never fires today, but it is the same anti-pattern).

The `?? N` fallbacks are unreachable-looking but are exactly what fires for the two roles blocked by RLS — and they would also mask any future read failure. `useState(500)` additionally paints ₪500 for one frame on every partner dashboard load.

## Intended semantics (confirmed by the current architecture)

Global rate = the default used when no per-account override row exists; the effective rate is resolved dynamically at read and at enrollment (`partner_base_pool`, `get_effective_agent_split`, `get_effective_agent_self_referral`). There is no snapshot at creation. So: changing a global rate changes what un-overridden accounts (existing and new) resolve to, and never touches override rows. No behaviour change is proposed here.

## Fix (surgical, two parts)

### 1. Database — one policy widening, nothing else

New migration that replaces the `platform_settings` SELECT policy so it also covers `ambassador` and `agent`, matching the access `social_media_partner` already has:

```sql
DROP POLICY "Staff and partners can read settings" ON public.platform_settings;
CREATE POLICY "Staff and partners can read settings"
  ON public.platform_settings FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_member')
    OR public.has_role(auth.uid(),'social_media_partner')
    OR public.has_role(auth.uid(),'ambassador') OR public.has_role(auth.uid(),'agent')
  );
```

No new table, no new RPC, no new setting, no grant changes elsewhere. `platform_settings` holds rate configuration only; the write policy (admin-only) is untouched.

### 2. Frontend — delete the invented fallbacks

| File | Change |
|---|---|
| `src/pages/partner/PartnerOverviewPage.tsx` | `useState<number>(500)` → `useState<number \| null>(null)`; `?? 300` / `?? 500` → `?? 0`; render a dash/skeleton while the rate is `null` instead of a fake number. |
| `src/hooks/useAgentOverview.ts` | `?? 1000` (pool) and `?? 1000` (self-referral) → `?? 0`. |
| `src/pages/team/TeamAnalyticsPage.tsx` | `?? 100` → `?? 0`. |
| `src/pages/admin/AdminSubmissionsPage.tsx` | `?? 100` → `?? 0` (same anti-pattern; the value only feeds the on-screen split preview, the recorded split is computed server-side by `record_case_commission`). |

Everything else that already reads `override ?? global` stays exactly as-is.

## Explicitly NOT changed

`record_case_commission`, `partner_base_pool`, `get_effective_agent_split`, `get_effective_agent_self_referral`, `admin_set_commission`, all Hub list RPCs, payout/reward/referral logic, `create-team-member` / `agent-create-account` / `invite-account` / `accept-invitation`, roles, permissions, any other RLS policy, and every existing override row (no data UPDATE of any kind).

## Existing accounts

No data migration. The ₪1000 / ₪500 / ₪300 override rows stay untouched — they are legitimate admin-saved overrides and will keep showing as "custom" in the Hub. If you want any of them removed so the account follows the global rate again, that is a separate deliberate action in the Hub, not part of this fix.

## Verification

1. DB: `select * from pg_policy` on `platform_settings` shows the five roles; `select` the rate columns to confirm values unchanged; confirm no override row changed (`commission_rate_history` gains no rows).
2. Set global partner rate to 0 → a partner with no override shows ₪0 in their dashboard and "default" in the Hub. Set it to 1000 → same account shows ₪1000. Repeat for ambassador (was stuck at ₪300), agent self-referral (was stuck at ₪1000), team (was ₪100).
3. An account **with** an override keeps showing its override through all of the above.
4. `npm run build` and `npx vitest run` must both be green.

## Regression risks

- *Widening the read policy leaks data* — `platform_settings` is a rates/flags configuration row that partners and team already read; ambassadors and agents are the same trust tier. Write access stays admin-only.
- *`?? 0` hides a genuine load failure as "₪0"* — mitigated on the partner page by rendering a placeholder while the value is still `null` rather than a number.
- *Accidentally rewriting existing overrides* — impossible here: no UPDATE/INSERT on any override table is part of this change.
