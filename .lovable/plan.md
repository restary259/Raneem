

# Influencer Payout Tab + 20-Day Countdown System

## Overview

Add a dedicated **Influencers** sub-tab under the People section of the Admin Dashboard that provides full visibility into influencer payout timelines, commission tracking, and 20-day countdown status. All data is derived from the existing unified `student_cases`, `leads`, `rewards`, and `profiles` tables -- no new tables or columns needed.

---

## What Already Exists (No Changes Needed)

The database already has the right infrastructure:
- `student_cases.paid_countdown_started_at` -- server timestamp set by `admin-mark-paid` edge function
- `student_cases.influencer_commission` -- snapshot written by `auto_split_payment` trigger at payment time
- `student_cases.is_paid_admin` -- idempotency guard preventing double-clicks
- `rewards` table -- auto-generated influencer rewards with `pending` status
- `payout_requests` table -- tracks payout lifecycle

The `admin-mark-paid` edge function already:
- Sets `paid_at`, `paid_countdown_started_at`, `is_paid_admin` atomically
- Is idempotent (returns success if already paid)
- Triggers `auto_split_payment` which snapshots `influencer_commission` from the profile

**No database migrations are required.** The 20-day timer, commission snapshot, and idempotency are all already server-side and locked.

---

## Implementation Plan

### Step 1: Add "Influencers" Sidebar Item

**File: `src/components/admin/AdminLayout.tsx`**

Add a new entry `{ id: 'influencers', labelKey: 'admin.tabs.influencers', icon: Users }` to the People group in `sidebarGroups` (after `students`).

### Step 2: Create the Influencer Payouts Component

**New file: `src/components/admin/InfluencerPayoutsTab.tsx`**

This is the main new component. It receives the already-fetched admin data props (`cases`, `leads`, `influencers`, `rewards`, `payoutRequests`) and computes everything client-side from the unified data layer.

**Summary Cards (top):**
- Total Pending Payout (sum of influencer_commission for cases in countdown)
- Due This Week (cases where payout_due_date is within 7 days)
- Overdue (cases where payout_due_date has passed, no payout sent)
- Total Paid Out (from completed payout_requests)

**Per-Influencer Table:**
For each influencer, aggregate their linked cases (via `leads.source_id`):

| Column | Source |
|--------|--------|
| Influencer Name | `profiles.full_name` |
| Total Referred | Count of leads where `source_id = influencer.id` |
| Paid Students | Count of cases with `case_status = 'paid'` linked to their leads |
| Pending Countdown | Cases where `paid_countdown_started_at + 20d > now()` |
| Ready for Payout | Cases where countdown expired, reward still `pending` |
| Overdue | Cases where countdown expired > 7 days ago, reward still `pending` |
| Total Owed | Sum of `influencer_commission` for pending rewards |
| Total Paid | Sum of amounts from paid payout_requests for this influencer |
| Next Due Date | Earliest `paid_countdown_started_at + 20d` among active countdowns |
| Status Badge | Green (no pending) / Yellow (countdown active) / Red (overdue) |

**Expandable Row Detail:**
Clicking an influencer row expands to show individual case rows:

| Case Student | Paid Date | Payout Due Date | Days Remaining | Commission | Payment Status |
|---|---|---|---|---|---|

Where:
- `Paid Date` = `paid_countdown_started_at`
- `Payout Due Date` = `paid_countdown_started_at + 20 days`
- `Days Remaining` = ceiling of (due_date - now) in days; negative if overdue
- `Commission` = `student_cases.influencer_commission` (snapshot, locked at payment time)
- `Payment Status` = derived from reward status (`pending` / `approved` / `paid`)

**Filters:**
- "Ready for Payout" -- only cases where countdown expired, reward pending
- "Overdue" -- countdown expired > 0 days ago
- "Due in 7 Days" -- countdown expires within 7 days
- "All Pending" -- any case with active countdown or unpaid reward

**Sorting:** By payout due date (ascending) and by commission amount.

### Step 3: Wire the New Tab into AdminDashboardPage

**File: `src/pages/AdminDashboardPage.tsx`**

Add a new `case 'influencers':` in `renderContent()` that renders the new `InfluencerPayoutsTab` component, passing `cases`, `leads`, `influencers`, `rewards`, `payoutRequests`, and `onRefresh`.

### Step 4: Add Translation Keys

**Files: `public/locales/ar/dashboard.json` and `public/locales/en/dashboard.json`**

Add keys under `admin.influencerPayouts.*` for all new UI labels:
- `totalPendingPayout`, `dueThisWeek`, `overdue`, `totalPaidOut`
- `paidDate`, `payoutDueDate`, `daysRemaining`, `commissionAmount`, `paymentStatus`
- `readyForPayout`, `overdueFilter`, `dueIn7Days`, `allPending`
- `noPayoutsMsg`, `countdownActive`, `noPending`
- Column headers and status labels

---

## What This Does NOT Change

- No database schema changes (all columns exist)
- No edge function changes (`admin-mark-paid` already handles everything)
- No trigger changes (`auto_split_payment` already snapshots commissions)
- The existing "Team" tab (`InfluencerManagement`) remains unchanged for account management
- Real-time sync already works -- the new tab uses the same `data` from `useDashboardData` which is refreshed by existing subscriptions on `student_cases`, `rewards`, and `payout_requests`
- Commission amounts are already locked at payment time (snapshot in `auto_split_payment` trigger)
- Timer is already based on server time (`NOW()` in the edge function)
- Editing financial fields after paid does NOT reset `paid_countdown_started_at` (only `case_status` change to `paid` triggers the countdown)

---

## Technical Details

### Countdown Calculation (Pure Client-Side from Server Timestamps)

```text
paidAt = case.paid_countdown_started_at  (server-set, immutable after payment)
dueDate = paidAt + 20 days
daysRemaining = ceil((dueDate - now) / 86400000)

if daysRemaining > 0  --> Yellow badge "X days"
if daysRemaining <= 0 --> Red badge "Overdue" or Green "Ready"
if no paid_countdown_started_at --> No timer (organic/no-influencer case)
```

### Data Flow (No Extra Queries)

```text
AdminDashboardPage
  --> useDashboardData('admin')
    --> getAdminDashboard()
      --> cases (with paid_countdown_started_at, influencer_commission)
      --> leads (with source_id, source_type)
      --> influencers (profiles)
      --> rewards (with status, amount)
      --> payoutRequests (with status, amount)
  --> passes all to InfluencerPayoutsTab
    --> client-side aggregation per influencer
```

### Files Modified

| File | Change |
|------|--------|
| `src/components/admin/AdminLayout.tsx` | Add `influencers` sidebar item to People group |
| `src/pages/AdminDashboardPage.tsx` | Add `case 'influencers'` in renderContent |
| `public/locales/en/dashboard.json` | Add influencer payout translation keys |
| `public/locales/ar/dashboard.json` | Add influencer payout translation keys (Arabic) |

### Files Created

| File | Purpose |
|------|---------|
| `src/components/admin/InfluencerPayoutsTab.tsx` | New Influencer Payouts tab component |

