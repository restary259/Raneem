
# Financial Consistency Fix — Admin Dashboard

All changes are confined to admin dashboard components. Zero impact on Influencer or Team dashboards.

---

## Problem Summary

Three tabs (Overview, Analytics, Money) compute and display financial figures differently:

- **Overview** mixes currencies: `revenueThisMonth = service_fee + school_commission` but school_commission is EUR
- **Overview** shows "Housing Commission" in EUR (`€`)
- **Analytics** ignores school_commission entirely in revenue
- **Money** shows school_commission as separate EUR revenue, excludes it from net profit
- **StudentCasesManagement** shows school_commission in EUR (`€`) in case details
- Default service fee fallback is 8000 instead of 4000

---

## Changes

### 1. Unify school_commission to ILS everywhere

All `school_commission` values will be treated and displayed as ILS (shekels), not EUR. This means changing currency labels from `€` to `₪` in:

- `AdminOverview.tsx` line 99: `€` to `₪`
- `MoneyDashboard.tsx` line 139: transaction row `currency: 'EUR'` to `'NIS'`
- `MoneyDashboard.tsx` line 403: KPI card `€` to `₪`
- `MoneyDashboard.tsx` line 449: breakdown card remove `suffix: '€'`
- `StudentCasesManagement.tsx` lines 234, 251: `€` to `₪`

### 2. Include school_commission in net profit calculation

Net profit should be: `service_fee + school_commission - all expenses`

- **MoneyDashboard.tsx** (line 174): Change `totalRevenueNIS = totalServiceFees` to `totalRevenueNIS = totalServiceFees + totalSchoolComm`
- Remove the separate `totalRevenueEUR` KPI card (line 397-406) — replace it with a "School Commission (₪)" card showing `totalSchoolComm` in ILS as part of revenue
- **Net profit** (line 177): Already `totalRevenueNIS - totalExpensesNIS`, so once `totalRevenueNIS` includes school_commission, net profit auto-corrects
- **StudentCasesManagement** `getNetProfit` (line 89): Add `+ (c.school_commission || 0)` to the formula

### 3. Make Analytics tab consistent with Money tab

- **AdminAnalytics.tsx** line 27: Change `totalRevenue` to include school_commission: `service_fee + school_commission`
- Line 28: Same for `revenueThisMonth`
- Lines 45, 77: Team perf and monthly chart revenue should also include school_commission

### 4. Make Overview tab consistent

- **AdminOverview.tsx** line 44: `revenueThisMonth` already sums both — this is now correct since both are ILS
- Rename "Housing Commission" card (line 98-100) to "School Commission" and change `€` to `₪`
- Line 52: `infRevenue` should also include school_commission for accurate ROI

### 5. Default service fee: 4000 instead of 8000

- **StudentCasesManagement.tsx** line 273: Change `|| 8000` to `|| 4000`

---

## Files Modified (5 files, visual/display only)

| File | Changes |
|------|---------|
| `AdminOverview.tsx` | EUR to ILS on housing commission card; include school_commission in infRevenue |
| `AdminAnalytics.tsx` | Include school_commission in all revenue calculations |
| `MoneyDashboard.tsx` | School commission currency EUR to NIS; include in totalRevenueNIS; remove separate EUR card; fix breakdown suffix |
| `StudentCasesManagement.tsx` | EUR to ILS labels; include school_commission in getNetProfit; default service_fee 4000 |
| `admin-weekly-digest/index.ts` | Already sums both — no change needed |

---

## What does NOT change

- No database schema changes
- No RPC or edge function changes
- No changes to Influencer dashboard, Team dashboard, or Student dashboard
- No changes to how data is stored or fetched
- No changes to payout/commission logic or triggers
- No changes to case status workflow
