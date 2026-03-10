

## Root Cause Diagnosis

There are **three separate problems** all causing `0 ILS` to show:

### Problem 1 — The existing E2E test case has `commission_split_done = true` with `platform_revenue_ils = 0` already baked in (data problem)

The `Ahmad E2E Test` case was advanced to `enrollment_paid` via a SQL migration that called `record_case_commission(id, 0)` — hardcoded zero. The `commission_split_done` flag is now `true`, so the trigger will **never fire again** on this case. The fix to the trigger helps future cases only.

The existing case data must be **manually corrected** in the DB.

### Problem 2 — The trigger fix migration (`20260310125618`) only fixes the trigger function, but the existing case is already locked (`commission_split_done = true`)

The new `auto_split_payment` now correctly reads `case_submissions.service_fee`, but for the existing "Ahmad E2E Test" case with `commission_split_done=true`, the trigger will never run again. The `platform_revenue_ils` column on that row is stuck at `0`.

### Problem 3 — `AdminFinancialsPage` Overview reads `platform_revenue_ils` from `cases` — which is `0` for this case

The UI at line 56:
```typescript
const platformNetRevenue = cases.reduce((s, c) => s + (c.platform_revenue_ils || 0), 0);
```
This is correct logic — but the DB value is `0`.

### Problem 4 — `AdminFinancialsPage` `serviceFees` KPI also shows `0` because `case_submissions.service_fee` is `NULL` for this case

The case was advanced via SQL, bypassing `PaymentConfirmationForm`. So `case_submissions` has no `service_fee` row for this case at all (or `service_fee = 0`).

---

## What Needs to Happen

### Fix A — Data fix: Backfill `platform_revenue_ils` for the existing locked case

We need to:
1. Set `case_submissions.service_fee = 4000` for the Ahmad E2E Test case (it was entered as ₪4000 but the SQL migration bypassed the form)
2. Reset `commission_split_done = false` on that case temporarily, then call `record_case_commission` — but since rewards are already created, this would double them. Instead: **directly update `platform_revenue_ils = 4000 - 1500 - 1000 = 2500`** (math: service fee minus team commission minus partner commission)

### Fix B — Override the `platformNetRevenue` KPI calculation in `AdminFinancialsPage` to be smarter

Instead of reading `platform_revenue_ils` (which can be 0 if the case was split before the trigger fix), **compute it dynamically**: `service_fee - team_rewards - partner_rewards` per case.

This makes the KPI resilient to legacy data and future data gaps.

### Fix C — `serviceFees` KPI: join `case_submissions` properly

Currently queries `case_submissions` for `service_fee` separately (only rows with `enrollment_paid_at IS NOT NULL`). The Ahmad E2E Test case's `case_submissions` row has `service_fee = NULL` because it was created via SQL migration. We need to also handle this gracefully.

---

## Implementation Plan

### Step 1 — DB data fix (migration/SQL data patch)

Update the test case directly:
```sql
-- Set the service fee on case_submissions for the E2E test case
UPDATE public.case_submissions 
SET service_fee = 4000
WHERE case_id = (SELECT id FROM cases WHERE full_name = 'Ahmad E2E Test' LIMIT 1);

-- Set platform_revenue_ils = 4000 - 1500 (team) - 1000 (partner) = 2500
UPDATE public.cases 
SET platform_revenue_ils = 2500
WHERE full_name = 'Ahmad E2E Test';
```

### Step 2 — Fix `AdminFinancialsPage` `OverviewTab` KPI to compute admin net dynamically

Instead of reading `platform_revenue_ils` alone, compute:
```
adminNet = serviceFees - sum(team rewards for these cases) - sum(partner rewards for these cases)
```

This is more accurate and handles legacy/edge cases. Query:
- `case_submissions` → `service_fee` (total revenue)
- `rewards WHERE admin_notes LIKE 'Team commission from case%'` → team cost
- `rewards WHERE admin_notes LIKE 'Partner commission from case%'` → partner cost
- `adminNet = serviceFees - teamCommissions - partnerCommissions`

And still show `platform_revenue_ils` from DB as a secondary check.

### Files Changed

| File | Change |
|---|---|
| New DB data migration | `UPDATE cases SET platform_revenue_ils = 2500` and `UPDATE case_submissions SET service_fee = 4000` for Ahmad E2E Test |
| `src/pages/admin/AdminFinancialsPage.tsx` | Add team commission rewards to the parallel fetch; compute `platformNetRevenue` as `serviceFees - teamComm - partnerComm` (dynamically correct, not just reading stored column) |

### Result After Fix

```
Service Fees KPI:       ₪4,000  ✅
Admin Net Revenue KPI:  ₪2,500  ✅  (4000 - 1500 team - 1000 partner)
Partner Pending KPI:    ₪0      ✅  (partner reward was already paid)
Partner Paid KPI:       ₪1,000  ✅
```

