
## End-to-End Money Flow Verification — Findings & Fix Plan

### What I Verified

I traced the complete flow through every component and the database schema. The cleanup is largely correct, but there is **one critical data gap** and **two secondary issues** that will cause incorrect KPIs.

---

### CRITICAL BUG: `service_fee` is NOT on the `cases` table

The `cases` table schema (from `types.ts` lines 476–508) has these financial columns:
- `influencer_commission`, `lawyer_commission`, `school_commission`, `referral_discount`, `discount_amount`
- **NO `service_fee` column**

`service_fee` lives on `case_submissions` (a separate 1:1 table keyed by `case_id`).

**Impact:**
- `MoneyDashboard.tsx` line 144: `if (c.service_fee > 0)` → always `false` → **service fee revenue row never appears**
- `MoneyDashboard.tsx` line 169: `totalServiceFees` → always `0`
- `KPIAnalytics.tsx` line 52: `totalRevenue` → `0 + school_commission` only (misses service fees entirely)
- `AdminFinancialsPage.tsx` already queries `case_submissions` directly — this one is **correct**

**Root cause:** `dataService.ts` `getAdminDashboard()` does `from('cases').select('*')` — but `service_fee` is not on `cases`. The admin KPI "Total Revenue" will always be ₪0 in service fees.

---

### Secondary Bug 1: `admin-weekly-digest` edge function still reads legacy

`supabase/functions/admin-weekly-digest/index.ts` line 25:
```
from("student_cases").select("id, case_status, service_fee, ...")
```
Still using `student_cases` + `case_status === 'paid'` and even shows `€` in the notification body (line 54: `${weekRevenue}€`). This function sends admins a weekly summary using dead data.

---

### Secondary Bug 2: `StudentCasesManagement.tsx` is fully legacy

`StudentCasesManagement.tsx` lines 29, 53–56, 365:
- Filters `READY_STATUSES = ['services_filled', 'paid']` — these are `student_cases.case_status` values (neither exist in `cases` table)
- Reads `c.case_status`, `c.assigned_lawyer_id`, `c.lead_id` — all `student_cases` fields
- Saves to `from('student_cases').update(moneyValues)` on line 365
- This component will always show **empty** because `cases` table has no `case_status` field

This component is used only in the legacy admin panel and is fed the `cases` prop from `dataService.ts` (which now returns `cases` table rows). The status filter `['services_filled', 'paid']` will match nothing.

**However:** This component appears to be a legacy admin panel widget that may no longer be the primary financial editor — `AdminSubmissionsPage.tsx` has replaced it for the actual enrollment flow. It should be evaluated for removal or replacement with a `cases`-aware version.

---

### What Works Correctly

| Component | Status |
|---|---|
| Team: `PaymentConfirmationForm` → writes `service_fee` to `case_submissions` | ✅ Correct |
| Team: `SubmitNewStudentPage` → writes `service_fee` to `case_submissions` | ✅ Correct |
| Admin: `AdminSubmissionsPage` → reads `case_submissions.service_fee`, shows split preview, calls `admin-mark-paid` | ✅ Correct |
| `admin-mark-paid` edge function → updates `cases.status = 'enrollment_paid'`, calls `record_case_commission` | ✅ Correct |
| `record_case_commission` DB fn → reads `partner_commission_overrides` + `platform_settings`, writes `cases.influencer_commission` + `cases.lawyer_commission`, inserts `rewards` rows | ✅ Correct |
| Partner: `PartnerEarningsPage` → counts qualifying `cases` × `commissionRate` | ✅ Correct |
| Team: `EarningsPanel` → reads from `rewards` table | ✅ Correct |
| `dataService.ts` role names: `social_media_partner`, `team_member` | ✅ Fixed |
| `dataService.ts` team dashboard: `cases` + `assigned_to` | ✅ Fixed |
| Student: `PaymentsSummary` → reads `payments` table (student-only, no split info) | ✅ Correct — students see no earnings |
| `KPIAnalytics` currency `₪` | ✅ Fixed |
| `KPIAnalytics` funnel statuses | ✅ Fixed |

---

### Fix Plan

**Fix 1 — Critical: `MoneyDashboard` and `KPIAnalytics` service_fee**

`dataService.ts` `getAdminDashboard()` must JOIN `case_submissions` to get `service_fee` per case. The cleanest approach: enrich the cases array after fetching by joining with `case_submissions`.

Change `getAdminDashboard()` to also fetch `case_submissions` and merge `service_fee` onto each case object, so `MoneyDashboard` and `KPIAnalytics` can read `c.service_fee` as before.

```
cases (id, status, influencer_commission, lawyer_commission, school_commission, ...)
   JOIN
case_submissions (case_id, service_fee, enrollment_paid_at, ...)
   → merged: { ...case, service_fee: submission.service_fee || 0 }
```

**Fix 2 — `admin-weekly-digest` edge function**

- Switch from `student_cases` to `cases` table
- Use `status === 'enrollment_paid'` instead of `case_status === 'paid'`
- Join `case_submissions` to get `service_fee`
- Change `€` to `₪` in the notification body string

**Fix 3 — `StudentCasesManagement.tsx`**

This component is effectively dead since it filters by `['services_filled', 'paid']` which are legacy `student_cases` statuses. Two options:
1. **Remove it** from `AdminDashboardPage.tsx` or wherever it's rendered (if `AdminSubmissionsPage` covers the same use case)
2. **Rewrite** to use `cases` table + `enrollment_paid` status as the display list

I will check where it's rendered and decide the best approach. If it's used in the admin tabs, option 2 is safer.

---

### Files to Change

| File | Change |
|---|---|
| `src/integrations/supabase/dataService.ts` | In `getAdminDashboard()`: fetch `case_submissions` and merge `service_fee` onto each case row so MoneyDashboard/KPIAnalytics read it correctly |
| `src/components/admin/MoneyDashboard.tsx` | No change needed once `service_fee` is merged in dataService |
| `src/components/admin/KPIAnalytics.tsx` | No change needed once `service_fee` is merged in dataService |
| `src/components/admin/StudentCasesManagement.tsx` | Update `READY_STATUSES` and field references to use new `cases` table fields (`status`, `assigned_to`) — or remove if superseded by `AdminSubmissionsPage` |
| `supabase/functions/admin-weekly-digest/index.ts` | Switch to `cases` table + `enrollment_paid`, join `case_submissions` for `service_fee`, fix `€` → `₪` |

### No DB Migration Needed

The `cases` table schema is correct as-is. The fix is purely in the data-fetching layer — merge `service_fee` from `case_submissions` into the cases array at query time.
