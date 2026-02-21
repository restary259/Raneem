

# Admin Dashboard — Comprehensive Audit Report

## Executive Summary

The Admin Dashboard is architecturally sound with a well-structured data layer, proper RLS enforcement, and a clean UI layout. However, the audit identified **14 findings** across UI, database integrity, workflow logic, financial attribution, and real-time sync. None are critical blockers, but several are **HIGH risk** if left unaddressed at scale.

---

## 1. DATABASE INTEGRITY AUDIT

### 1.1 All Existing Cases Are Soft-Deleted — HIGH RISK
- **Finding**: All 3 `student_cases` rows have `deleted_at` set (non-null). The `dataService.ts` admin query filters `.is('deleted_at', null)`, so the Admin Dashboard currently shows **zero cases** in all views.
- **Impact**: Overview KPIs (active cases, revenue, conversion), Funnel, Analytics, Student Cases tab, and Money Dashboard all display empty/zero.
- **Root Cause**: Previous testing left cases soft-deleted. The seeded test case (`19b3303a`) also has `deleted_at` set.
- **Fix**: Clear `deleted_at` on valid paid cases, or seed fresh test data without soft-deletion.

### 1.2 Commissions Table Out of Sync — MEDIUM RISK
- **Finding**: Commission records (`14ab61fc`) show `influencer_amount: 0, lawyer_amount: 0` despite the corresponding case having `influencer_commission: 0, lawyer_commission: 1000`. The trigger `auto_split_payment` captures values at the time of payment, but if financial fields are edited after payment, the commissions table diverges.
- **Impact**: If admin uses the commissions table for financial reporting (currently not used in KPIs — good), data would be stale.
- **Fix**: No code change needed. The current design correctly uses `student_cases` as the source of truth for KPIs, and the comment in `dataService.ts` line 184 confirms this. Document this pattern.

### 1.3 Rewards Status vs Case Deletion — MEDIUM RISK
- **Finding**: Case `c49606db` has reward status `cancelled` (correct — case was soft-deleted). But the case itself shows `case_status: paid` with `deleted_at` set. If the case is ever restored (`deleted_at` cleared), the rewards remain cancelled.
- **Fix**: Add logic in `markEligible` or a restore function to re-activate cancelled rewards when a deleted paid case is restored.

### 1.4 Translation Reward Attribution Gap — LOW RISK
- **Finding**: Cases `c49606db` and `14ab61fc` have `translation_added_by_user_id: null` despite `has_translation_service: true`. Only `ea1f5973` correctly has the team member ID. This means the trigger skipped translation rewards for the first two cases.
- **Cause**: The `translation_added_by_user_id` column was added after those cases were created.
- **Impact**: Historical data only. New cases correctly set this field.

---

## 2. UI FIELDS vs DATABASE VERIFICATION

### 2.1 Case Detail Modal Fields — PASS
The profile tab displays 12 fields that all map correctly to `student_cases` columns: `student_full_name`, `student_email`, `student_phone`, `student_age`, `passport_number`, `nationality`, `country_of_birth`, `student_address`, `language_proficiency`, `selected_city`, `selected_school`, `intensive_course`.

### 2.2 Money Tab Fields — PASS
All 6 financial fields (`service_fee`, `school_commission`, `influencer_commission`, `lawyer_commission`, `referral_discount`, `translation_fee`) match database columns exactly.

### 2.3 Missing Field: `gender` — LOW RISK
- **Finding**: The `student_cases` table has a `gender` column, but the case detail modal does not display it.
- **Fix**: Add `gender` to the profile tab grid.

### 2.4 Missing Field: `housing_description` in Profile Tab — LOW RISK
- **Finding**: `housing_description` is shown in the Services tab but not in the Profile tab where accommodation-related fields would be expected.
- **Status**: Acceptable — shown under Services.

---

## 3. STATUS FLOW & SKIP LOGIC AUDIT

### 3.1 StudentCasesManagement Shows Only Terminal Statuses — BY DESIGN
- **Finding**: `READY_STATUSES = ['profile_filled', 'services_filled', 'paid']`. Only cases at these stages appear. Earlier pipeline stages (new, assigned, contacted, appointment) are managed in LeadsManagement.
- **Assessment**: Correct separation of concerns.

### 3.2 Mark Paid Button Gating — PASS
- **Finding**: The "Mark Paid" button only appears for `services_filled` and `profile_filled` statuses (line 155). Cases already `paid` or with `is_paid_admin` are rejected by the edge function (idempotent check on lines 47-52 of `admin-mark-paid`).
- **Assessment**: No skip logic possible. Forward-only transitions enforced by `caseTransitions.ts`.

### 3.3 Mark Eligible Creates Case Without Assignment — MEDIUM RISK
- **Finding**: `markEligible()` in LeadsManagement creates a `student_cases` record without setting `assigned_lawyer_id`. The case defaults to `case_status: 'assigned'` (DB default), but has no lawyer assigned.
- **Impact**: The case appears in Team Dashboard but nobody owns it. Funnel shows "assigned" count inflated.
- **Fix**: Either change the DB default to `'new'` for cases created during eligibility marking, or require lawyer assignment at case creation time.

---

## 4. PAID CLICK LOGIC & 20-DAY TIMER AUDIT

### 4.1 Edge Function `admin-mark-paid` — PASS
- Verifies admin role server-side
- Idempotent (returns success if already paid)
- Sets `paid_at`, `is_paid_admin`, `paid_countdown_started_at`
- Triggers `auto_split_payment` via the status change

### 4.2 20-Day Timer Visibility — NOT SHOWN IN ADMIN — HIGH RISK
- **Finding**: The Admin Dashboard does NOT display the 20-day countdown timer. There is no UI element showing when each influencer's payout becomes eligible.
- **Impact**: Admin has no visibility into payout deadlines. Cannot plan cash flow or anticipate payout requests.
- **Fix**: Add a countdown badge on paid cases showing "X days until payout eligible" based on `paid_countdown_started_at`.

### 4.3 Payout Request Panel — Missing Deadline Display — HIGH RISK
- **Finding**: The Money Dashboard's payout request cards show `amount`, `date`, `requester`, `student names`, but NOT the payout eligibility date (i.e. when the 20-day lock expires).
- **Fix**: Calculate and display `paid_at + 20 days` as the "eligible since" date on payout request cards.

---

## 5. REAL-TIME SUBSCRIPTION AUDIT

### 5.1 Admin Dashboard Subscriptions — PASS
Six tables subscribed: `leads`, `student_cases`, `commissions`, `rewards`, `payout_requests`, `profiles`. Covers all critical data.

### 5.2 Missing Subscription: `appointments` — LOW RISK
- **Finding**: Admin does not subscribe to `appointments` table changes. If admin needs to see appointment activity in Overview/Analytics, they won't get real-time updates.
- **Impact**: Low — appointments are primarily a team-member concern.

### 5.3 Subscription Cleanup — PASS
`useRealtimeSubscription` properly returns cleanup in `useEffect` via `supabase.removeChannel(channel)`.

---

## 6. FLICKER, FREEZE & RERENDER AUDIT

### 6.1 Loading Gate — PASS
`AdminDashboardPage` uses `sessionReady` state with a single loading gate. No flicker between auth check and data loading.

### 6.2 `isFetchingRef` Guard — PASS
`useDashboardData` prevents concurrent fetches with `isFetchingRef`, eliminating AbortError cascades.

### 6.3 Multiple Real-Time Subscriptions Triggering Simultaneous Refetches — MEDIUM RISK
- **Finding**: 6 subscriptions all call the same `refetch()`. If a single DB operation touches multiple tables (e.g., `auto_split_payment` modifies `student_cases`, `commissions`, and `rewards`), 3 near-simultaneous refetch calls fire. The `isFetchingRef` guard drops 2 of them, but this means the first refetch may not include the rewards data that was just inserted.
- **Impact**: Stale data for ~1 refetch cycle. The visibility change handler or next subscription event will catch up.
- **Fix**: Add a debounce (300ms) to the refetch callback in `useRealtimeSubscription` so near-simultaneous events collapse into one.

---

## 7. FILTERING LOGIC AUDIT

### 7.1 Leads Filtering — PASS
Correctly excludes `deleted_at` leads, supports search by name/phone/email, status filter, and source filter.

### 7.2 Student Cases Filtering — PASS
Filters by `READY_STATUSES`, supports search and status sub-filter.

### 7.3 Money Dashboard Transactions — PASS
Derives transaction rows from paid cases with correct direction (in/out) tagging and supports type/status/search filtering.

### 7.4 Funnel "assigned" Count Double-Counting — LOW RISK
- **Finding**: Funnel stage `assigned` uses `source: 'both'`, summing `leadCounts['assigned'] + caseCounts['assigned']`. Since leads are marked "assigned" AND cases default to "assigned" status, the count may inflate.
- **Fix**: Change funnel `assigned` stage to `source: 'case'` only since leads at "assigned" status means they already have a case.

---

## 8. PDF EXPORT AUDIT

### 8.1 Leads PDF — PASS
Exports: name, phone, passport, english, math, score, status, source, major, date. Matches displayed fields.

### 8.2 Student Cases PDF — PASS
Exports: name, email, phone, passport, nationality, city, school, course, status. Uses Arabic font (Amiri) for RTL support.

### 8.3 Money PDF — PASS with NOTE
Exports filtered transactions with summary rows (total revenue, expenses, net). However, the PDF summary uses `filtered` data not `all` data — this is correct behavior (exports what's visible), but could confuse admin if filters are active.

### 8.4 PDF Arabic Font — PASS
`registerArabicFont` and `processArabicText` are loaded. Amiri font used in styles.

---

## 9. EARNINGS & COMMISSION ATTRIBUTION AUDIT

### 9.1 Revenue Calculation — PASS
`Net Profit = (service_fee + school_commission) - influencer_commission - lawyer_commission - referral_discount - translation_fee`. Consistent across Overview, Analytics, StudentCases, and MoneyDashboard.

### 9.2 Admin Can Edit Financials Before Marking Paid — PASS
The "Edit Financials" button in case detail allows admin to set all 6 fields before clicking "Mark Paid". The trigger reads the case row values at payment time.

### 9.3 Translation Fee Attribution — PASS (with historical gap)
The `auto_split_payment` trigger correctly creates a translation reward for `translation_added_by_user_id` when `has_translation_service AND translation_fee > 0 AND translation_added_by_user_id IS NOT NULL`.

### 9.4 Influencer Commission Source — PASS
The trigger reads `commission_amount` from the influencer's profile and writes it to `student_cases.influencer_commission`. Admin can override via "Edit Financials".

---

## 10. RECOMMENDED UI IMPROVEMENTS (Non-Breaking)

| # | Improvement | Risk | Effort |
|---|------------|------|--------|
| 1 | Add 20-day countdown badge on paid cases in Student Cases tab | HIGH | Low |
| 2 | Show payout eligibility date on Money Dashboard payout request cards | HIGH | Low |
| 3 | Add debounce (300ms) to real-time refetch callback | MEDIUM | Low |
| 4 | Show `gender` field in case detail profile tab | LOW | Trivial |
| 5 | Change funnel "assigned" to `source: 'case'` to prevent double-counting | LOW | Trivial |
| 6 | Add "Restore deleted case" action in admin (currently no UI to undo soft-delete) | MEDIUM | Medium |
| 7 | Show translation_fee and translation attribution in paid case summary card (not just in modal) | LOW | Low |
| 8 | Add pagination to Money Dashboard transactions table (currently renders all rows) | MEDIUM | Low |
| 9 | Add "No lawyer assigned" warning badge on cases with `case_status = 'assigned'` but null `assigned_lawyer_id` | MEDIUM | Low |
| 10 | Show net profit inline on each transaction row in Money table for quick scanning | LOW | Low |

---

## RISK SUMMARY

| Risk Level | Count | Key Items |
|-----------|-------|-----------|
| HIGH | 3 | All cases soft-deleted (no data visible), 20-day timer not shown, payout deadline missing |
| MEDIUM | 5 | Commission table sync, reward restoration on case restore, concurrent refetch race, unassigned lawyer on eligible, pagination |
| LOW | 6 | Gender field, funnel double-count, missing appointments subscription, historical translation gap, PDF filter note, housing field |

---

## IMPLEMENTATION PRIORITY

**Phase 1 (Immediate):**
1. Seed fresh test data or clear `deleted_at` on valid cases so admin dashboard shows data
2. Add 20-day countdown badge on paid cases
3. Add payout eligibility date to payout request cards
4. Add debounce to real-time refetch

**Phase 2 (Next Sprint):**
5. Fix funnel "assigned" double-counting
6. Add gender field to case detail
7. Add "unassigned lawyer" warning badge
8. Add pagination to Money transactions

**Phase 3 (Polish):**
9. Case restore functionality
10. Translation attribution inline display
