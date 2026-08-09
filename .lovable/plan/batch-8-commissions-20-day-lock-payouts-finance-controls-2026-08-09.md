# Batch 8 — Commissions, 20-Day Lock, Payouts & Finance Controls

## Business rule confirmed by you

Partners and team are paid out of the commission Darb receives **from the language school**, not out of the student's agency service fee. So money only becomes real when:

1. The student wires tuition to the language school and tells Darb (message/call).
2. Admin finishes the enrollment — the case reaches the enrollment/paid milestone.

That enrollment milestone is therefore the **authoritative commission event**, and the 20-day lock starts from it. The Batch 7 service-fee payment confirmation stays purely "money in from the student" and must never create commission.

## What exists today (verified)

- Authoritative commission table: `rewards` (one row per recipient per case, `reward_type` = `team` | `referral` | `network_split` | `master_override`).
- Commission engine: `record_case_commission(case_id, total_payment_ils)` — guarded by `cases.commission_split_done`.
- It fires from two places: the `auto_split_payment` trigger when `cases.status` becomes `enrollment_paid`, and the `admin-mark-paid` edge function (which calls the RPC first, then flips the status).
- Rates: `platform_settings.partner_commission_rate` (₪500 default), `team_member_commission_rate` (₪100), `master_partner_override_rate` (₪200), `ambassador_commission_rate` (₪300), with per-recipient overrides in `partner_commission_overrides` and `team_member_commission_overrides`, plus negotiated master/partner splits in `partner_rate_offers` via `get_effective_partner_split`.
- Lock + payouts: 20 days is computed ad hoc as `created_at + 20 days` inside `get_my_payout_preview`, `request_payout`, `request_payout_via_chat` and again in the Partner Earnings UI. Payouts live in `payout_requests` (reference `PAY-YYYY-######`), reviewed via `admin_respond_payout_request` / `confirm_payout_batch`.

## Problems this batch fixes

1. **No commission snapshot.** `rewards` stores only `user_id, amount, case_id, reward_type, admin_notes`. There is no rate used, base amount, recipient type, case reference, payment reference, or unlock timestamp. History is unexplainable and can only be reconstructed from today's admin rates.
2. **Lock date is derived, not stored.** `created_at + 20 days` is recomputed in four places (including frontend JS). A backfill, import, or clock change silently moves money.
3. **Weak duplicate protection.** The `ON CONFLICT DO NOTHING` in `record_case_commission` matches no unique index (the existing partial indexes only cover old `Auto-generated…` note text), so only the `commission_split_done` flag prevents doubles.
4. **Commission can be created without the school money milestone** — the edge function records commission before the status transition and accepts any admin-typed amount.
5. **Team cannot request a payout at all** — `request_payout_via_chat` rejects anyone who is not partner/ambassador, yet team commissions are written to `rewards`.
6. **Frontend recomputes balances.** Partner Earnings mixes `get_my_payout_preview` totals with its own 20-day filter; Team Analytics sums `rewards` client-side.

## Work plan

### Phase A — Commission integrity (migrations)

1. Extend `rewards` with the snapshot: `recipient_role`, `case_reference`, `payment_reference` (nullable), `rate_used`, `base_amount`, `rate_source` (`platform_settings` | `partner_override` | `team_override` | `negotiated_offer`), `unlock_at timestamptz`, `commission_reference` (`COM-YYYY-######` via a sequence + trigger), `created_by_event`.
2. Backfill existing rows: `unlock_at = created_at + 20 days`, case reference from `cases`, rate/base from the current amount, and mark them `rate_source = 'legacy_backfill'` so history is never rewritten by today's settings.
3. Add a real unique index — `(case_id, user_id, reward_type)` — so a duplicate insert is rejected by the database, not by a flag.
4. Rewrite `record_case_commission` to fill the snapshot columns, set `unlock_at = now() + 20 days`, take an advisory lock on the case, and stay idempotent on both the flag and the new unique index.
5. Add a guard so the function refuses to run unless the case has actually reached the enrollment milestone.

### Phase B — Authoritative trigger

6. Make the enrollment milestone the single entry point: `auto_split_payment` remains the only creator, and `admin-mark-paid` stops pre-calling the RPC (it flips the status and lets the trigger do the money). The amount comes from `case_submissions.service_fee` server-side, not from an admin-typed field.
7. Record a `case_events` row per commission created (who, when, case, amount, recipients) so the audit trail is not just mutable current state.

### Phase C — Lock and balances

8. Replace all derived 20-day math with the stored `unlock_at` in `get_my_payout_preview`, `request_payout`, `request_payout_via_chat`, and remove the duplicate filter from Partner Earnings.
9. New RPC `get_my_earnings_summary()` returning one authoritative object: `total`, `locked`, `available`, `requested`, `paid`, plus a per-case breakdown with case reference, commission reference, amount and unlock date. Categories are mutually exclusive by status, so `total = locked + available + requested + paid`.
10. Partner Earnings and Team Analytics both consume that RPC — no client-side balance math.

### Phase D — Payouts

11. Allow team members to request payouts through the same `request_payout_via_chat` path (role check widened to team, request stamped with `requestor_role`), keeping identical available-balance enforcement.
12. Keep the existing single-pending-request unique index and advisory lock; add explicit "already confirmed" handling to `confirm_payout_batch` so a repeat confirmation reports success instead of raising, without a second `transaction_log` row or a second notification.
13. Admin payout detail already returns linked cases; extend it with commission reference, rate used and unlock date so every shekel is traceable.

### Phase E — Verification (no code, evidence only)

14. Two-case lock test: Case A unlocked, Case B locked — partner sees exactly one as available.
15. Duplicate tests: repeat enrollment event, double payout request, double payout confirmation.
16. RLS/manipulation tests: partner tries to read another partner's rewards, change an amount, change `unlock_at`, change payout status.
17. Mobile check of partner and team finance screens at 390px.
18. Export check: commission/payout rows in the Spreadsheet Hub carry case, payment, commission and payout references with correct ILS amounts.

## Explicitly out of scope

Master Partner recruitment flow, negotiated-rate accept/decline UI, Student Dashboard rebuild, any new spreadsheet system. Master-partner and negotiated-rate fields are audited and reported only.

## Technical notes

- All schema changes go through tracked migrations; no data edits inside migrations.
- `record_case_commission` stays `SECURITY DEFINER`, execute granted to `service_role` only.
- Timestamps stay `timestamptz` in UTC; display uses Asia/Jerusalem, matching the existing case/payout reference generators.
- Legacy `commissions`, `payments`, `services`, `transaction_log` (write-only log) and `src/services/PaymentService.ts` are reported as legacy — not deleted in this batch.
