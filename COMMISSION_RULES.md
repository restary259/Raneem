# Darb — Commission Rules

Single source of truth for how money is split. If code and this document ever
disagree, this document describes the intent and the code is the bug.

## 1. Everything is a flat amount in shekels

There are **no percentages and no tiers**. Every commission is a fixed number of
shekels (₪) decided by the admin. All money columns, all payouts and all reports
are ILS only.

## 2. Who can earn a commission on a case

| Actor | How they are linked to a case |
| --- | --- |
| Team member | `cases.assigned_to` |
| Partner (وكيل) | `cases.partner_id`, or `cases.referred_by` |
| Ambassador | same fields as a partner — the role decides the default rate |

At most **one** partner/ambassador earns per case: the person actually linked to
it. No one else is paid, no matter what their dashboard visibility setting is.

## 3. How the amount is chosen

For each actor, in this exact order:

1. **Per-person override wins.** `partner_commission_overrides.commission_amount`
   (partners and ambassadors) or `team_member_commission_overrides.commission_amount`
   (team members). If a row exists, that amount is used — even if it is 0.
2. **Otherwise the global default for that role**, from `platform_settings`:
   - partner → `partner_commission_rate`
   - ambassador → `ambassador_commission_rate`
   - team member → `team_member_commission_rate`

An amount of 0 means no reward row is created.

## 4. Platform revenue

```
platform_revenue_ils = max(0, net − team_commission − partner_pool − agent_override − student_referral_reward)
```

Where `net = max(0, service_fee − referral_discount)`. The team commission,
the agent override (additive, §10), and the student-referral reward (§11) are
all funded from DARB's margin. The partner pool (incl. the master carve) is
paid from the pool itself. Every component is a flat ₪ amount.

## 5. When it runs

`record_case_commission(case_id, service_fee)` is called once, by the
`auto_split_payment` trigger, when a case moves to `enrollment_paid`. It is
idempotent: `cases.commission_split_done` guards against a second run, so
marking a case paid twice never double-pays.

## 6. Reward → case link

Every reward row carries `rewards.case_id` pointing at the case that generated
it. `admin_notes` is a human-readable label only and must never be used to look
up which case a reward belongs to.

## 7. Payout lock

A reward cannot be included in a payout request until 20 days after it was
created (`request_payout` enforces this). Admins can release early through
`admin-early-release`.

## 8. Master partner network override (carve-out from the partner pool)

Base rates in sections 1–7 are unchanged. On top of them:

- A partner can be upgraded by an admin to **master partner**
  (`profiles.is_master_partner`). The upgrade is a role flag only — earnings,
  referral code, referral history and payout history all carry over untouched.
- Partners recruited by a master partner carry `profiles.master_partner_id`.
- When a case pays out and the referring partner has a master partner, that
  master partner earns a share. **This share is carved out of the same partner
  pool — it is never an extra payment on top, and never comes out of the team
  member's commission or Darb's margin.**

```
master_share = master_partner_override_rate   (admin-set, default ₪200)
partner_amount = partner_pool − master_share
platform_revenue_ils = max(0, service_fee − team_commission − partner_pool)
```

- The pool itself (`partner_commission_rate`, default ₪1000) is unchanged by
  the master share — only the split of the pool between the recruited partner
  and their master changes. Darb's margin is therefore unaffected by the
  master override.
- The override is recorded as a reward with `rewards.reward_type =
  'master_override'` (default) or `'network_split'` (when a negotiated offer
  applies) and `rewards.source_user_id` = the referring partner, so it is never
  confused with the base referral reward in payouts or reporting.
- The override applies only to cases referred by partners inside that master
  partner's own network — never company-wide.

## 9. Negotiated recruitment splits (master partner ↔ recruited partner)

The referral commission **pool per case is always ₪1000** (section 1). Darb's
outlay never changes because of a negotiation — only the way the pool is divided
between the recruited partner and his master partner.

- **Default (no agreement):** referred partner receives the full ₪1000,
  master partner receives ₪0 from the pool.
- **Negotiated:** a master partner may send a rate offer to a partner **he
  recruited himself** (`profiles.master_partner_id = master.id`). The offer
  records `pool_amount`, `partner_amount` and
  `master_amount = pool_amount − partner_amount` in `partner_rate_offers`,
  with an incrementing `version`, `created_at` and `responded_at`.
- The offer only takes effect when the **receiving partner accepts** it
  (`partner_respond_rate_offer`). A master partner can never set a rate
  silently, and nobody else can accept on the partner's behalf. Superseded
  offers stay in the table for audit.
- On payout, the accepted offer splits the pool:
  `rewards.reward_type = 'referral'` → partner (`partner_amount`),
  `rewards.reward_type = 'network_split'` → master partner (`master_amount`).
- When no negotiated offer exists, the default master share (section 8,
  `master_partner_override_rate`, default ₪200) is carved from the pool
  instead. A negotiated offer and the default carve-out are mutually exclusive:
  if an accepted offer exists it governs the whole pool split; otherwise the
  default carve-out applies. There is no "stacking" — the master's total share
  always comes out of the partner pool, never from Darb's margin.

Worked example (service fee ₪5000, pool ₪1000):

| Payee | Default (no offer) | Negotiated ₪700 offer |
|---|---|---|
| Partner (`referral`) | ₪800 | ₪700 |
| Master (`master_override` or `network_split`) | ₪200 | ₪300 |
| **Total pool paid out** | **₪1000** | **₪1000** |
| `platform_revenue_ils` | ₪4000 | ₪4000 |

In both columns the whole ₪1000 pool is paid out and Darb's margin
(₪4000) is identical — only the split between partner and master changes.

## 10. Agent override (additive — paid on top of the partner pool)

An **Agent** is a first-class role (`app_role = 'agent'`) that recruits and
manages Partners and Ambassadors and earns a flat admin-set commission paid
**on top of** the ₪1000 partner pool — never deducted from the partner's
commission. The agent share is absorbed by DARB's margin
(`platform_revenue_ils`), exactly like the team commission. This matches the
confirmed product Rule 2 ("the ₪500 agent commission is NOT deducted from the
Partner's commission") and the live `record_case_commission` / 
`get_effective_agent_split` definitions.

> **Model decision (2026-08-15):** ADDITIVE, not carve-from-pool. An earlier
> version of this section (and migration `20260814140200_agent_commission_carve.sql`)
> described a carve model where the agent share was clamped to the pool. That
> was superseded by `20260814182120` + `20260814230457`, which make the agent
> share additive. This document now matches the code. The canonical engine is
> consolidated in migration `20260816010000_commission_engine_canonical.sql`.

- A Partner or Ambassador recruited by an Agent carries
  `profiles.agent_id` (mirrors `profiles.master_partner_id`), settable by an
  admin (via the Commission Hub Agent Network view) or automatically at
  activation when the recruit applied via the Agent's `/join/AG-XXXX` link.
- The recruit attribution flows through the durable invitation:
  `user_invitations.agent_id` → `accept-invitation` stamps
  `profiles.agent_id` at activation. `master_partner_id` and `agent_id` are
  mutually exclusive on an application/invitation — a recruit belongs to one
  recruiter. The Commission Hub enforces this: assigning an agent clears
  `master_partner_id` and vice-versa (the engine handles both defensively, but
  the Hub warns and prevents the combination).
- `agent_commission_rate` (in `platform_settings`, default ₪500) is the global
  default Agent override. A per-Agent override may be set in
  `agent_commission_overrides` (`agent_id`, `commission_amount`), resolved by
  `get_effective_agent_split(agent_id, recruited_partner_id)`. Both are
  configured from the Commission Hub via the `admin_set_commission` RPC.

### Additive split (pool unchanged, agent from margin)

When a case reaches `enrollment_paid` and the referring partner/ambassador has
an `agent_id`, `record_case_commission` resolves each share independently:

1. `partner_pool` — the full ₪1000 pool (or per-account override), via
   `get_effective_partner_split`. The partner keeps their full share.
2. `master_share` — carved from the pool (section 8), `≤ pool`. Independent of
   the agent.
3. `partner_amount = max(0, pool − master_share)`.
4. `agent_share` — resolved via `get_effective_agent_split`, **not clamped to
   the pool** (`GREATEST(0, amount)` only). Paid on top, from DARB's margin.

```
platform_revenue_ils = max(0, net − team_commission − partner_pool − agent_share)
```

The partner pool outlay never changes because of the agent — the agent share is
extra money absorbed by DARB's margin (parallel to how the team commission and
the student-referral reward are funded).

### Reward recording

- `rewards.reward_type = 'agent_override'`
- `rewards.recipient_role = 'agent'`
- `rewards.source_user_id` = the referring partner/ambassador (so it is never
  confused with the base `referral` reward or the `master_partner` override).
- `rewards.unlock_at = now() + interval '20 days'` — **the same 20-day payout
  lock** as every other reward (section 7). No special-casing in
  `request_payout` or the chat payout flow.
- Idempotent via `ON CONFLICT (case_id, user_id, reward_type) DO NOTHING`
  alongside the existing `commission_split_done` guard.

### Payouts

Agent payouts reuse the existing infrastructure unchanged: `rewards` →
`get_my_payout_preview` → `request_payout_via_chat` (creates an
admin↔agent direct thread with a `payout_request` message) →
`admin_respond_payout_request`. `payout_requests.requestor_role = 'agent'`.

### Where the Agent override applies

Only to cases referred by partners/ambassadors inside that Agent's own network
(`profiles.agent_id = agent.id`) — never company-wide, and never on a case the
agent referred directly (an agent is not a partner/ambassador; one identity =
one role). If the referring partner has no `agent_id`, the override does not
apply and the split is exactly sections 8–9.

### Agent self-referral (separate)

When the **agent themselves** refers a student directly
(`cases.partner_id = agent.id`, no partner/ambassador in the chain),
`record_case_commission` pays `agent_self_referral_rate` (default ₪1000) as a
`reward_type = 'referral'`, `recipient_role = 'agent'` reward — **not** an
`agent_override`. No `agent_override` reward is created on a self-referral
(isolation rule). `platform_revenue = max(0, net − team − self_referral_amount)`.

### Precedence with the master share

An Agent and a master partner can both sit in the chain above the same
referring partner. In the additive model both pay independently: the master
share from the pool, the agent share from the margin. The Commission Hub
enforces mutual exclusivity at configuration time (D2): an admin must detach
`master_partner_id` before assigning `agent_id`, or vice-versa, with a clear
warning. The engine continues to handle both defensively so historical data is
never corrupted.

## 11. Student referrals (Refer-a-Friend / Refer-a-Family)

A **student** can refer a friend or family member. This is an **isolated**
reward system: a student→student referral pays ONLY the referring student a
flat cash reward, and NEVER propagates any professional commission upstream
(no partner pool, no agent override, no master share). The isolation is
enforced by the role check in `record_case_commission` (`v_is_partner`
excludes students).

- `referrals.referral_type` ∈ `{NULL, 'friend', 'family'}` (NULL = legacy
  rows that predate the column). Captured at case creation by
  `create-case-from-apply` from the referral form and persisted on the
  `referrals` row.
- The **referred student** gets a discount on their case
  (`cases.referral_discount`, already applied — section "Referral discount").
- The **referring student** gets a cash reward, resolved at `enrollment_paid`:
  1. Per-student override: `student_referral_reward_overrides(student_id,
     referral_type, reward_amount)`. If a row exists, that amount is used.
  2. Otherwise the global default for that referral type:
     `platform_settings.student_refer_friend_reward` or
     `platform_settings.student_refer_family_reward` (both default ₪0).
- An amount of 0 means no reward row is created (meets the NEW ACCOUNT DEFAULT
  / no-unsafe-default rule).

### Reward recording

- `rewards.reward_type = 'student_referral'`
- `rewards.recipient_role = 'student'`
- `rewards.source_user_id` = the referring student
- `rewards.unlock_at = now() + interval '20 days'` — same 20-day lock.
- Idempotent via `ON CONFLICT (case_id, user_id, reward_type) DO NOTHING`.

```
platform_revenue_ils = max(0, net − team_commission − student_referral_reward)
```

The student-referral reward is funded from DARB's margin (D3), parallel to the
referral discount the referred friend already received.

### Isolation (critical)

A student→student referral must NOT create any `referral` (partner),
`master_partner`, or `agent_override` reward. The referring student's agent
(if any) and the original partner (if any) are NOT paid on a friend/family
referral. Only the configured student-referral reward applies.

