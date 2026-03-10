
## Root Cause

The `case_submissions` row for "Ahmad E2E Test" **does not exist** — the previous backfill migration ran `UPDATE` on a non-existent row (0 rows affected). So:

- `case_submissions.service_fee` query returns 0 rows → `serviceFees = 0`
- `platformNetRevenue = max(0, 0 - 1500 - 1000) = 0`
- Yet the DB has `cases.platform_revenue_ils = 2500` ✅ and `rewards` are correct ✅

The UI `fetchData` correctly trusts `case_submissions`, but that table has no row for this case.

## Two-part fix

### Fix 1 — DB migration: INSERT the missing `case_submissions` row
```sql
INSERT INTO public.case_submissions (case_id, service_fee, enrollment_paid_at)
VALUES (
  '77ab3958-60e7-4598-bd1a-0bfd9992e7dc',
  4000,
  now()
)
ON CONFLICT (case_id) DO UPDATE SET
  service_fee = 4000,
  enrollment_paid_at = COALESCE(case_submissions.enrollment_paid_at, now());
```
After this: `case_submissions.service_fee = 4000`, `enrollment_paid_at = set` → the UI query picks it up.

### Fix 2 — UI resilience: fallback to `platform_revenue_ils` when `case_submissions` is missing
Update `OverviewTab` in `AdminFinancialsPage.tsx`:

- Also fetch `cases` columns: `platform_revenue_ils` (already fetched)
- Compute `serviceFees` as: `sum(case_submissions.service_fee)` **OR** `sum(cases.platform_revenue_ils + team_commissions + partner_commissions)` for cases with no submission row

Concretely: after computing `serviceFees` from `case_submissions`, if it's still 0 but there are enrolled cases, fall back to summing `platform_revenue_ils + teamCommissionsTotal + partnerCommissionsTotal` across cases as the revenue estimate.

Actually cleaner: in the `cases` fetch, also fetch `platform_revenue_ils`. Then:
```
serviceFees = max(
  sum(case_submissions.service_fee),           // primary
  sum(cases.platform_revenue_ils) + teamTotal + partnerTotal  // fallback
)
```

But the cleanest single fix is just the DB insert — it's the correct data to have anyway.

### Files changed

| File | Change |
|---|---|
| New DB migration | `INSERT INTO case_submissions` with `service_fee=4000, enrollment_paid_at=now()` for the E2E test case |
| `src/pages/admin/AdminFinancialsPage.tsx` | Add UI fallback: if `serviceFees = 0` but `cases` with `enrollment_paid` exist, compute `serviceFees` from `platform_revenue_ils + teamCommissions + partnerCommissions` to handle legacy/missing submission rows |

### Expected result after fix
```
Service Fees KPI:       4,000 ILS  ✅
Admin Net Revenue:      2,500 ILS  ✅  (4000 - 1500 team - 1000 partner)
Partner Paid KPI:       1,000 ILS  ✅
Partner Pending KPI:    0 ILS      ✅  (partner reward already paid)
Recent Enrolled table:  Shows Ahmad E2E Test row with ₪4,000  ✅
```
