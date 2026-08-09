# Batch 6 — Finance, cost breakdown, 40-week course calculation & case financial summary

Scope: case-level money only. No partner payouts, no student dashboard redesign, no recruitment, no commission redesign.

## What the audit found (read-only, verified this turn)

Authoritative today:
- `case_services` — one row per selected service, with `unit_price` copied from the catalog at selection time (Batch 5 `set_case_services` RPC). This is the price snapshot and it works.
- `case_payments` — money received, `amount` + `paid_status` + `paid_date` + `recorded_by`.
- `case_submissions` — euro school costs (`program_price`, `accommodation_price`, `insurance_price`, `*_weeks`).
- `platform_settings` — one row: team ₪1,000, ambassador ₪500, master override ₪200, partner rate 0, VAT 0.18.
- `record_case_commission(case_id, total)` — fires once from the `enrollment_paid` trigger, guarded by `cases.commission_split_done` plus `ON CONFLICT DO NOTHING` on rewards. No duplicate-money bug found; documented, not redesigned.

Problems found:
1. **Legacy conflicting writer.** `CaseCostingService.ensureCaseServices()` bulk-inserts *every* active catalog service straight into `case_services`. It contradicts Batch 5's checkbox selection and now fails under the new RLS for team users. It is called from `CasePaymentService.recordServiceFeePayment()`, i.e. on every fee collection.
2. **No backend total.** Every total is summed in the frontend (`useCaseServices`, `useCasePayments`). There is no single server-side answer to "what does this case cost / what is paid / what remains".
3. **Payment state is not authoritative.** Team RLS allows insert/update/delete on `case_payments` for their own cases, and `CasePayments.tsx` writes `paid_status: 'paid'` directly. A team member can make money look admin-confirmed. There is no `submitted` vs `confirmed` distinction and no admin-only confirm step.
4. **No duplicate protection.** No unique/idempotency constraint on `case_payments`; double-click creates two rows.
5. **No currency column** on `case_services` / `case_payments`; ILS is implicit while `case_submissions` holds EUR. Nothing labels the mix.
6. **Amount is fully client-supplied** — a team member can post any amount, above or below the case total.
7. **Financial history** exists only via `case_events` triggers on `case_services`; payment edits/deletes leave no audit row.
8. `cases.influencer_commission / lawyer_commission / school_commission / discount_amount` appear to be legacy columns superseded by `rewards`. To be documented, not dropped in this batch.

40-week check: `COURSE_DURATION_WEEKS = 40` and `computeWeeklyCost()` each exist exactly once and are consumed by `CaseProfileForm`, `CaseCostingService` and the submission wizard. No duplicated multiplier. Verify only.

## What this batch builds

### Migration 1 — currency + payment lifecycle
- `case_services`: add `currency text not null default 'ILS'`.
- `case_payments`: add `currency text not null default 'ILS'`, `status text` lifecycle (`pending` → `submitted` → `confirmed` / `rejected`), `submitted_by`, `submitted_at`, `confirmed_by`, `confirmed_at`, `rejected_reason`. Backfill existing `paid` rows as `confirmed`.
- Partial unique index preventing two non-rejected `service_fee` payments per case per amount within the same submission window (idempotency key column `idem_key`).
- Tighten RLS: team may INSERT/SELECT only; no UPDATE/DELETE once `status <> 'pending'`; only admin may reach `confirmed`.
- Audit trigger writing every payment insert/status change into `case_events`.

### Migration 2 — authoritative money RPCs
- `submit_case_payment(case_id, amount, note, idem_key)` — team-callable, validates the case is theirs, validates amount > 0 and not greater than the case service total (rejects overpayment; partial payments allowed and tracked), writes `status='submitted'`, returns the row. Re-running with the same `idem_key` returns the existing row instead of inserting.
- `confirm_case_payment(payment_id)` / `reject_case_payment(payment_id, reason)` — admin-only, sets `confirmed`, stamps actor + time, emits a case event.
- `get_case_financials(case_id)` — the single authoritative read: service lines (description, qty, unit price, line total, currency), ILS service total, euro school lines (course weekly × weeks, accommodation, insurance) with the 40-week note, total confirmed, total submitted-not-confirmed, remaining. Rounded to 2 decimals server-side. Access-checked for admin / assigned team / owning student.

### Frontend
- Delete `ensureCaseServices()` and its call in `CasePaymentService`; fee collection no longer seeds the catalog.
- `CaseFinance.tsx` / new `CaseFinancialSummary` — one transparent breakdown fed by `get_case_financials`: student, school, course (`€rate/week × 40 weeks = €total`, labelled as an estimate, actual school invoice shown when present), accommodation, insurance, each ILS service line, ILS total, paid, remaining, payment status. Mobile-first stacked cards, no tables that scroll horizontally.
- `CasePayments.tsx` — team submits via `submit_case_payment` (button disabled while in-flight); admin sees Confirm / Reject with full context (reference, student, team member, expected vs submitted, history).
- All amounts formatted with the existing `formatILS` / `en-US` helper; EUR lines explicitly marked `€`.

### Verification (each reported as its own STEP)
- Three controlled demo cases: course only / course + accommodation + insurance / Full Service, plus one-service and no-optional-service combinations. UI total compared against `get_case_financials` and against raw SQL sums.
- Price-snapshot test: record a case price, change the admin catalog price, reopen the old case (must be unchanged), create a new selection (must take the new price).
- Duplicate test: double-click, refresh-and-resubmit, repeat submit.
- Tamper test: submit an inflated amount; submit as team into another team's case; team attempts confirm; partner/student attempt any financial write.
- Mobile viewport screenshot of the summary.
- Full financial E2E: school → course → 40-week cost → accommodation → services → team breakdown → team submits → admin reviews → admin confirms → DB reflects confirmed.

## Technical notes
- Rounding: money stored as `numeric`, all RPC output rounded to 2 decimals at the boundary; no intermediate rounding, so frontend and backend cannot disagree.
- Currency stays explicit per row; ILS is the business currency, EUR only for school-billed lines from `case_submissions`.
- `record_case_commission` stays connected to `enrollment_paid` as today — documented in the final report, redesign deferred.
- Legacy `cases.*_commission` columns and any orphaned finance tables are documented with their references; no destructive cleanup this batch.

## Deferred to Batch 7+
Partner/team payout execution, commission redesign, invoice PDF generation, dropping legacy commission columns.

## Known blocker
Admin-side UI verification still hits the admin 2FA prompt. Admin steps will be verified against the database and via a team/student browser session; a TOTP code (or a temporary bypass) is needed to finish the admin UI walkthrough.
