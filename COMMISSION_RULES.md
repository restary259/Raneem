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
