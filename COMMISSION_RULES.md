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
platform_revenue_ils = max(0, service_fee − team_commission − partner_commission)
```

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
