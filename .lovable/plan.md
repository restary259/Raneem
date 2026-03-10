## Full Audit Findings

### What the user actually wants (decoded from their message):

1. **"delete wire everything"** — remove stale/incorrect data wiring, rebuild all KPI cards from correct sources
2. **"when I click confirm on a student submission the money should move to pending"** — the `record_case_commission` runs and creates `rewards` with `status='pending'`. Currently this fires on `enrollment_paid` transition. The user wants this visible immediately when admin marks enrolled. This is already correct — BUT the `PartnerPayoutsPanel` only shows `Partner commission from case%` notes. Team commission rewards also show as pending. This is working.
3. **"only after I confirm payout the money should move to paid and show in partners dashboard"** — the partner dashboard `PartnerOverviewPage` shows "Paid This Month" and "Paid All Time" from the `rewards` table with `status='paid'`. This IS correctly wired. But the OverviewTab KPI in `AdminFinancialsPage.tsx` shows `partnerCommission = partnerCases * rate` (stale projection logic using `cases.partner_id`), NOT from the rewards table. This is the broken card.
4. **"add translation"** — all hardcoded English strings need i18n keys added to `en/dashboard.json` and `ar/dashboard.json translate the payout pages` 
5. **"make sure the setup is wired correctly with no logic overlapping or fighting for commands"** — audit and fix conflicting logic

### Specific bugs found:

**BUG 1 — `AdminFinancialsPage.tsx` OverviewTab KPIs are stale/wrong:**

- `partnerCommission` = `partnerCases * rate` where `partnerCases = cases.filter(c => !!c.partner_id)` — this uses the old single `partner_id` on cases, not the multi-partner `rewards` table
- `totalRevenue` and `serviceFees` are pulled from `case_submissions.service_fee` where `enrollment_paid_at IS NOT NULL` — this is correct but service_fee is NOT on the `cases` table; the overview pulls it from `case_submissions` which is correct
- `kpiReferralDiscounts` shows `discount_amount` from cases — this still exists and is harmless
- **Fix**: Replace `partnerCommission` KPI to read from `rewards WHERE admin_notes LIKE 'Partner commission%' AND status='pending'` (what's owed) + `status='paid'` (what's been paid). Also add a "Platform Net Revenue" KPI from `SUM(cases.platform_revenue_ils) WHERE status='enrollment_paid'`.

**BUG 2 — `AdminFinancialsPage.tsx` OverviewTab tabs have hardcoded English strings:**

- "Overview", "Agent Payouts", "Partner Payouts" tab labels are hardcoded
- "Partner Payouts" panel labels "Pending", "Paid this month", "All time", "Pay All Pending", "Confirm Payment", "Refresh" are all hardcoded English in `PartnerPayoutsPanel.tsx`
- ALL strings in `PartnerPayoutsPanel.tsx` are hardcoded (no i18n)

**BUG 3 — `PartnerPayoutsPanel.tsx` has no i18n at all**

**BUG 4 — `PartnerOverviewPage.tsx` — the "Paid This Month" and "Paid All Time" cards ARE correctly reading from `rewards` table. These are wired correctly.**

**BUG 5 — `PartnerEarningsPage.tsx` — The 3 summary cards at top use projection math:**

- "Total" = `earningCases.length * commissionRate` 
- "Pending" = `pendingCases.length * commissionRate`
- "Confirmed" = `confirmedCases.length * commissionRate`
- These labels overlap with the "Paid This Month / Paid All Time" cards on the overview page. The "Confirmed" card here shows "projection × rate for enrollment_paid cases" which is NOT the same as actual confirmed payout. This creates confusion.
- The "Payment History" section at the bottom correctly reads `rewards.status='paid'` ✓
- The user wants the partner dashboard to show actual `rewards` data — the history section is correct, but the top 3 cards still use projection. Need to clarify: the spec says top cards = projection (estimated), bottom section = actual paid. This is the intended design per the disclaimer text. So this is correct as-is.

**BUG 6 — `MoneyDashboard.tsx` "Mark as Paid" button on rewards** — This component has its OWN `handleMarkRewardPaid` function that directly updates `rewards.status='paid'` without password gate or audit log. This bypasses the proper flow and fights with `PartnerPayoutsPanel`. Needs to be removed or disabled for partner commission rewards.

**BUG 7 — Missing translation keys:**

- `admin.financials.kpiAdminNet` — new KPI not in locale files
- All of `PartnerPayoutsPanel.tsx` text — completely untranslated
- Tab labels "Overview", "Agent Payouts", "Partner Payouts" in `AdminFinancialsPage.tsx`
- `PartnerEarningsPage.tsx` payment history labels partially hardcoded (uses ternary `isAr ? ... : ...` instead of `t()` keys)

### Files to change:


| File                                           | What changes                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/admin/AdminFinancialsPage.tsx`      | Fix OverviewTab KPIs: pull partner commission from `rewards` table (pending + paid totals), add platform net KPI from `cases.platform_revenue_ils`. Replace hardcoded tab labels with `t()` keys.                                                                                                             |
| `src/components/admin/PartnerPayoutsPanel.tsx` | Add full i18n — replace all hardcoded strings with `t()` calls from `dashboard` namespace                                                                                                                                                                                                                     |
| `src/components/admin/MoneyDashboard.tsx`      | Remove/disable the "Mark as Paid" button for rewards whose `admin_notes` starts with `'Partner commission'` — those must go through `PartnerPayoutsPanel` flow only. Keep it for team commission rewards.                                                                                                     |
| `public/locales/en/dashboard.json`             | Add missing keys: `admin.financials.kpiAdminNet`, `admin.financials.kpiPartnerPending`, `admin.financials.kpiPartnerPaid`, `admin.financials.tabOverview`, `admin.financials.tabAgentPayouts`, `admin.financials.tabPartnerPayouts`; new `admin.partnerPayouts.*` block for all `PartnerPayoutsPanel` strings |
| `public/locales/ar/dashboard.json`             | Same keys in Arabic                                                                                                                                                                                                                                                                                           |


### Commission flow — confirmed correct, no changes needed:

- Admin marks case enrolled → `admin-mark-paid` edge function called → `record_case_commission(case_id, total_payment_ils)` runs → creates `rewards` rows with `status='pending'` for team + each qualifying partner
- `commission_split_done = true` prevents double-split
- Partner's overview page reads `rewards.status='paid'` for actual paid totals — correct
- Admin confirms payout in `PartnerPayoutsPanel` → `rewards.status` → `'paid'`, `paid_at` set → partner sees it in realtime ✓

### Logic conflicts to resolve:

1. `MoneyDashboard.tsx` has its own "Mark as Paid" for rewards — fights with `PartnerPayoutsPanel`. Fix: hide this button for partner commission rewards.
2. `AdminFinancialsPage.tsx` OverviewTab shows `partnerCommission = partnerCases * rate` (projection) but `PartnerPayoutsPanel` shows real rewards. These show different numbers. Fix: OverviewTab should show real `rewards` sums.

### New i18n keys needed:

`**admin.financials` additions (EN):**

```json
"kpiAdminNet": "Platform Net Revenue",
"kpiPartnerPending": "Partner Commissions Pending",
"kpiPartnerPaid": "Partner Commissions Paid",
"tabOverview": "Overview",
"tabAgentPayouts": "Agent Payouts",
"tabPartnerPayouts": "Partner Payouts"
```

**New `admin.partnerPayouts` block (EN):**

```json
"title": "Partner Payouts",
"subtitle": "Manage and confirm partner commission payments",
"totalPending": "Total Pending",
"totalPaid": "Total Paid",
"refresh": "Refresh",
"noParters": "No partner commission rewards found.",
"noPartnersHint": "Partner rewards appear here once cases reach enrollment_paid status.",
"pending": "Pending",
"paidThisMonth": "Paid this month",
"allTime": "All time",
"payAllPending": "Pay All Pending ({{count}})",
"confirmPayment": "Confirm Payment",
"showPaidHistory": "Show paid history ({{count}})",
"hidePaidHistory": "Hide paid history ({{count}})",
"paid": "Paid",
"confirmed": "Confirmed",
"passwordTitle": "Re-enter Password",
"confirmSingle": "Confirm payment of ₪{{amount}} to {{partner}} for case {{student}}?",
"confirmBulk": "Confirm payment of ₪{{total}} to {{partner}} covering {{count}} cases?",
"confirm": "Confirm",
"cancel": "Cancel",
"successTitle": "Payment confirmed",
"successDesc": "{{amount}} confirmed for {{partner}}"
```

### Execution order:

1. Update `public/locales/en/dashboard.json` — add all new keys
2. Update `public/locales/ar/dashboard.json` — add Arabic translations
3. Update `AdminFinancialsPage.tsx` — fix OverviewTab KPIs + add i18n to tab labels
4. Update `PartnerPayoutsPanel.tsx` — add i18n throughout
5. Update `MoneyDashboard.tsx` — hide "Mark as Paid" button for partner commission rows