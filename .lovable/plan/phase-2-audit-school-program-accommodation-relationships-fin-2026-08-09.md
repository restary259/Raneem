# Phase 2 Audit — School / Program / Accommodation Relationships & Financial Calculations

Audit only. Findings first, then a fix plan per item.

## Findings

### 1. School → Program relationship — OK (real, DB-enforced)
`programs.school_id` (uuid) exists in the database. The Submit New Student wizard queries
`programs ... .eq("school_id", schoolId)` — the filter is in the *query*, not a client-side
`.filter()` on a full list, so another school's programs are never fetched. When no school is
picked, the program list is empty.

Caveat: `school_id` is nullable, so legacy programs with no school are invisible in the wizard.
Not a leak, but they are unreachable.

### 2. School → Accommodation relationship — OK (real, DB-enforced)
`accommodations.school_id` exists and the wizard queries `.eq("school_id", schoolId)` the same way.

### 3. Stale selection on school change — OK for program/accommodation, INCOMPLETE for weeks
A `useEffect` on `schoolId` clears `programId`, `accommodationId` and `accommodationWeeks`.
It does **not** clear `programWeeks`, `startMonth`, `courseStart`/`courseEnd`. Because costs are
derived (`useMemo` on the selected object), totals correctly drop to 0 when the program clears —
so no stale money. But a leftover `programWeeks` + auto-derived `courseEnd` from the previous
school's program survives and silently re-applies to the next program picked.

### 4. Weekly pricing (program) — CORRECT at capture, MIXED at display
- Capture: `computeWeeklyCost(program, weeks)` resolves a `price_tiers` band and returns
  `{weeks, weeklyRate, total}`. The wizard stores `program_weeks`, `program_weekly_price` and
  `program_price` (= total) on `case_submissions`.
- `CaseCostingService.loadProgrammeCosts` now prefers `submission.program_price` (total) and only
  falls back to tier computation. Correct.
- `CaseProgramTab` and `AdminSubmissionsPage` now render `weeks × weekly = total`. Correct.
- **Still wrong:** `CaseProgramTab` labels accommodation money as `/ per month` in one legacy
  string, and older submissions (created before the weekly columns existed) have
  `program_price` holding a bare weekly rate with `program_weeks = NULL`. Those legacy rows will
  display a weekly rate as a total. UNVERIFIED how many such rows exist.

### 5. Accommodation pricing — same as #4
Same tiering, same storage columns, same legacy-row risk.

### 6. Total case cost — SPLIT ACROSS TWO SYSTEMS (real problem)
There is no single "total case cost". Two independent stacks exist:
- **EUR side:** program + accommodation + insurance, read from `case_submissions` via
  `loadProgrammeCosts`, shown read-only.
- **ILS side:** `case_services` (billable lines) vs `case_payments`, shown in `CaseFinance`
  (`remaining = servicesTotal − totalPaid`).

`case_submissions.service_fee` participates in **neither** total on the case page. Nothing anywhere
sums EUR + ILS into one figure (arguably correct, since currencies differ — but no view states
this, so the number reads as "the total").

### 7. Service fee "disappears" — ROOT CAUSE FOUND
`SubmitNewStudentPage.handleSubmit` writes `service_fee` into `case_submissions` and sets
`payment_confirmed = true`, but — unlike `PaymentConfirmationForm` — it never calls
`ensureCaseServices(caseId)` and never inserts a `case_payments` row. `CaseFinance` reads only
`case_services` / `case_payments`, so the case opens with an empty finance panel and 0 paid, even
though the fee was collected. It *does* appear in Admin Submissions, Spreadsheet Hub and
`DashboardService` (all of which read `case_submissions.service_fee`) — which is why it looks like
an inconsistent/"lost" value rather than a missing write.

### 8. Insurance field in Submit New Student — PRESENT
The wizard loads the `insurances` catalogue (with `age_price_tiers`, `billing_period`), computes
`computeInsuranceCost(insurance, age, courseStart, courseEnd)` and stores `insurance_id` +
`insurance_price` (total). Data model is complete. No gap here.

### 9. Unpaid → Paid — REAL DB WRITE, but two divergent paths
`PaymentConfirmationForm` writes `case_submissions.payment_confirmed/_at/_by`, sets
`cases.status = 'payment_confirmed'`, inserts a `case_payments` row and calls `ensureCaseServices`
plus an audit log. All consumer views read from these tables, so Case / Admin / Team / Spreadsheet
stay in sync.
The wizard path (#7) sets the flags and status but skips services + payment row — that is the only
desync.

## Fix plan

**P0 — Service fee lost on the wizard path (item 7)**
- In `SubmitNewStudentPage.handleSubmit`, after the case + submission insert, call
  `ensureCaseServices(caseId, user.id)` and insert the matching `case_payments` row with
  `amount = service_fee`, `payment_type = 'service_fee'`, mirroring `PaymentConfirmationForm`.
- Extract the shared "confirm payment" writes into one helper in `CaseCostingService` (or a new
  `CasePaymentService`) so the two entry points can never drift again.

**P0 — Legacy submissions showing a weekly rate as a total (items 4/5)**
- Query how many `case_submissions` have `program_price IS NOT NULL AND program_weeks IS NULL`.
- Backfill `program_weeks` / `program_weekly_price` where derivable; where not, render such rows
  without an implied `× weeks` breakdown and flag the amount as unverified rather than a total.

**P1 — Case total clarity (item 6)**
- In `CaseFinance`, render two labelled blocks: "Agency fees (ILS)" and "School costs (EUR)" with
  their own subtotals, and show insurance inside the EUR block. No cross-currency sum.

**P1 — Stale weeks on school change (item 3)**
- Extend the `schoolId` reset effect to also clear `programWeeks`, `startMonth`, `courseStart`,
  `courseEnd`.

**P2 — Catalogue hygiene (items 1/2)**
- Report programs/accommodations with `school_id IS NULL` in the admin catalogue UI so they can be
  assigned; consider making `school_id` NOT NULL once clean.

**P2 — Label fix**
- Replace the hardcoded "per month" accommodation label in `CaseProgramTab` with the weekly wording.

## Technical notes
- Tables touched by the fixes: `case_submissions`, `case_services`, `case_payments`.
- No schema change is required for P0 other than the optional legacy backfill (a data migration,
  not DDL).
- Existing unit coverage: `src/lib/programPricing.test.ts` (5 tests, passing). New tests should
  cover the shared payment helper and the school-change reset.
