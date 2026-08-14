# Agent role: apply the missing backend, fix the commission split, verify invite emails

## What the audit found

I compared every migration file in the repo against what is actually live in the database, and read every agent-related edge function.

**Seven migrations exist as files but were never applied to the live database.** This is the root cause of the errors currently visible in the Agent dashboard (404 on the recruit-link call, 404 on the self-referral override table, 400 on the settings query):

| Migration file | What it adds | Live? |
|---|---|---|
| `20260814140400_agent_recruit_links` | Agent's own `AG-XXXX` recruit link, agent attribution on recruit applications | No |
| `20260814150000_agent_backend_fixes` | Bulk network query, `agent_relationships` audit trail, role-chaining guard | No |
| `20260814160000_agent_self_referral` | Self-referral rate + per-agent override table | No |
| `20260814160100_agent_self_referral_commission` | Pays an agent who refers a student directly | No |
| `20260814160200_agent_create_accounts_flag` | Admin toggle: agent may create accounts directly | No |
| `20260814160300_agent_bank_country` | Bank country on payout details | No |
| `20260814170000_agent_direct_message_link` | Agent chat thread wiring | No |

Everything from the earlier agent batches (role, `agent_id`, per-recruit override table, directories, payouts) **is** live — so this is a clean gap, not a rewrite.

**Commission model gap.** The live `record_case_commission` gives a recruiting agent a share *carved out of* the ₪1,000 partner pool (currently ₪200), which silently reduces the partner's payout. Per your decision, the agent's ₪500 must be **extra, on top of** the pool: the partner keeps the full ₪1,000 and DARB pays ₪1,500 total on such a case.

**Emails.** Branded RTL templates already exist for partner, ambassador, team and a generic account invite — no new template needed for the agent inviting a partner/ambassador. One gap: when an **admin invites a new agent**, the code sends the *team member* template ("عضو فريق"), which is wrong wording for an agent.

## What will change

### 1. Apply the missing agent backend
Run the seven pending migrations against the live database, unchanged where possible. This alone fixes: the agent's own referral/recruit link, the network list loading in one query, the self-referral override lookup, the admin toggles, and the bank-country field.

### 2. Agent network commission = ₪500, additive
- Set the global agent rate to **₪500**.
- Rewrite the agent branch of `record_case_commission` so the agent reward is paid **in addition to** the pool instead of being carved out of it:
  - Partner/ambassador: full pool (₪1,000)
  - Master partner (if any): unchanged, still from the pool
  - Recruiting agent: ₪500 extra
  - Platform revenue = net service fee − team − pool − agent
- Agent's **own** direct referrals stay at ₪1,000 (admin-configurable global + per-agent override), paid like a partner referral.
- Per-agent overrides continue to win over the global rate.

### 3. Make the split visible in the interface
- Admin → Submissions **Payment Split** panel: add the agent line (recruiting agent or self-referral) and subtract it from platform revenue, so the preview matches what actually gets recorded.
- Admin → Team/Settings: expose the agent network rate and the agent self-referral rate as editable values alongside the existing partner/team rates.
- Agent dashboard: earnings and network pages read the effective rates from the backend (already wired) and will show real numbers once the migrations land.

### 4. Agent invite emails
- Add an `agent-invite` branded template (same layout and RTL treatment as the partner/ambassador invites, agent wording) and point `invite-account` at it for the agent role.
- Keep `agent-invite-recruit` and `agent-create-account` on the existing partner/ambassador templates — those are correct today.
- Register `agent-create-account` in the functions config and redeploy the agent functions.

### 5. Verification
- Re-run the finance path end to end: partner-in-network case → payment → enrollment paid → check rewards rows (partner ₪1,000, agent ₪500, team rate, platform revenue) and the admin split preview.
- Agent self-referral case → agent ₪1,000, no double-pay.
- Confirm the 404/400 network errors on `/agent` are gone.
- Full test suite + typecheck.

## Technical notes
- `record_case_commission` keeps its `ON CONFLICT (case_id, user_id, reward_type)` idempotency and the 20-day `unlock_at` lock; only the amount sourcing changes.
- Existing cases already at `enrollment_paid` are not retro-adjusted (the commission guard blocks re-runs) — the new rates apply going forward.
- Referral discount handling stays as-is: DARB's margin absorbs it; flat commissions are unaffected.
- Migrations are written idempotently so a partially-applied state is safe.
