

# Phase 8: Rewards & Payouts System Overhaul

This phase rebuilds the rewards and payouts system into a comprehensive, auditable financial management module -- covering influencer payouts, student cashback, payout request workflows, transaction logging, and admin export capabilities.

---

## Current State Assessment

The existing system has basic building blocks:
- `rewards` table with `status` (pending/approved/paid/cancelled), `amount`, `user_id`, `referral_id`
- `PayoutsManagement` admin component (simple approve/pay/cancel)
- `EarningsPanel` for influencers (20-day lock timer, request payout)
- `RewardsPanel` for students (similar 20-day lock, milestones)
- `ReferralManagement` creates reward records when referral status hits "paid"

**What's missing per the blueprint:**
- No `payout_requests` entity (grouped requests with linked students)
- No transaction log / audit trail for payments
- No payment method tracking
- No reject-with-reason flow
- No minimum payout threshold (configurable)
- No admin side-panel quick stats or advanced filters
- No CSV export for payouts
- No "linked students" clickable views
- No bulk approve/reject
- Student cashback not linked to case payments

---

## Implementation Plan

### 8A. Database: `payout_requests` Table

New table to group reward payouts into formal requests:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| requestor_id | uuid NOT NULL | The user requesting payout |
| requestor_role | text NOT NULL | 'influencer' or 'student' |
| linked_reward_ids | uuid[] NOT NULL | Array of reward IDs in this request |
| linked_student_names | text[] | Student names for display |
| amount | numeric NOT NULL | Total amount |
| status | text NOT NULL DEFAULT 'pending' | pending / approved / rejected / paid |
| payment_method | text | bank_transfer / paypal / cash |
| transaction_ref | text | Reference number after payment |
| reject_reason | text | Required when rejected |
| admin_notes | text | Optional notes |
| approved_by | uuid | Admin who approved |
| paid_by | uuid | Admin who marked paid |
| requested_at | timestamptz DEFAULT now() | |
| approved_at | timestamptz | |
| paid_at | timestamptz | |

RLS: Users SELECT own requests; Admins full access.

### 8B. Database: `transaction_log` Table

Immutable audit log for all financial actions:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| type | text NOT NULL | 'influencer_payout' / 'student_cashback' / 'commission' |
| payout_request_id | uuid | Link to payout_requests |
| related_student_ids | uuid[] | |
| amount | numeric NOT NULL | |
| approved_by | uuid | Staff who approved |
| payment_method | text | |
| transaction_ref | text | |
| notes | text | |
| created_at | timestamptz DEFAULT now() | |

RLS: Admin SELECT only. No user mutations.

### 8C. Add `min_payout_threshold` to `eligibility_config`

Insert a configurable row: field_name = 'min_payout_threshold', weight = 100 (meaning 100 NIS minimum). Admin can change via existing EligibilityConfig UI.

### 8D. Revamped Influencer EarningsPanel

Complete overhaul of `src/components/influencer/EarningsPanel.tsx`:

- **Top KPI Strip** (3 cards): Total Earned (green), Available for Payout (yellow), Paid (blue) -- using the blueprint color scheme (#1D4ED8, #10B981, #F59E0B)
- **Request Payout Button**: Opens a modal showing auto-populated linked students, total amount, optional notes, and confirm/cancel. Checks:
  - Minimum payout threshold from `eligibility_config`
  - Only fully paid student leads count (20-day lock)
- **Payout Requests Table** with columns: Request ID (short), Date, Linked Students, Amount, Status (color-coded badges), Cancel action (if pending)
- Clicking "Linked Students" shows a mini-profile popover
- Mobile: card layout instead of table

### 8E. Revamped Student RewardsPanel

Similar overhaul of `src/components/dashboard/RewardsPanel.tsx`:

- Same KPI strip design
- Request Payout with modal (same flow)
- Payout Requests table with linked referrals
- Milestones section preserved
- Mobile card layout

### 8F. Revamped Admin PayoutsManagement

Complete rebuild of `src/components/admin/PayoutsManagement.tsx`:

- **Top KPI Strip** (4 cards):
  - Pending influencer payouts (yellow)
  - Pending student cashback (yellow)
  - Total paid (green)
  - Total rejected (red)
- **Side Panel** (collapsible on mobile):
  - Quick Stats: pending count, total amount, requests by role
  - Filters: date range, status, role (influencer/student)
- **Main Table** columns:
  - Requestor Name / Role (badge: Influencer or Student)
  - Request ID (short)
  - Linked Students (clickable, opens modal)
  - Amount
  - Status (color-coded: pending=yellow, approved=blue, paid=green, rejected=red)
  - Request Date
  - Approval Date
  - Payment Method
  - Notes
  - Actions: Approve / Reject / Mark Paid
- **Approve Modal**: Optional note, confirm button
- **Reject Modal**: Mandatory reason, confirm button
- **Mark Paid Modal**: Payment method select (Bank/PayPal/Cash), Transaction ID input, optional notes. Creates `transaction_log` entry, sends notification
- **Bulk Actions**: Checkbox selection with "Bulk Approve" and "Bulk Reject"
- **CSV Export**: All columns with conditional status formatting
- Mobile: card layout with sticky action buttons

### 8G. Linked Students Modal

New component `src/components/admin/LinkedStudentsModal.tsx`:
- Shows mini-profile for each linked student
- Fields: Name, course/school, city, payment status, referral source
- Clickable "View Full Profile" link

### 8H. Notifications Integration

When payout requests change status:
- Request created: notify admin
- Approved: notify requestor
- Rejected: notify requestor with reason
- Paid: notify requestor with payment details

Uses existing `notifications` table and `NotificationBell` system.

### 8I. Translation Keys

Add comprehensive keys to both `en/dashboard.json` and `ar/dashboard.json` for:
- Payout request modal labels
- Transaction log labels
- Status names
- KPI card labels
- Export button labels
- Modal confirmation text

---

## Technical File Summary

| File | Action |
|------|--------|
| DB Migration | Create `payout_requests`, `transaction_log` tables + RLS + realtime |
| DB Migration | Insert `min_payout_threshold` config row |
| `src/components/influencer/EarningsPanel.tsx` | Full rewrite with blueprint design |
| `src/components/dashboard/RewardsPanel.tsx` | Full rewrite with blueprint design |
| `src/components/admin/PayoutsManagement.tsx` | Full rewrite with KPIs, filters, bulk actions, CSV export |
| `src/components/admin/LinkedStudentsModal.tsx` | New component |
| `src/components/admin/PayoutActionModals.tsx` | New component (approve/reject/mark-paid modals) |
| `public/locales/en/dashboard.json` | Add payout/transaction keys |
| `public/locales/ar/dashboard.json` | Add payout/transaction keys |

## Implementation Order

1. Create `payout_requests` and `transaction_log` tables with RLS
2. Insert min payout threshold config
3. Build `LinkedStudentsModal` and `PayoutActionModals` components
4. Rebuild `PayoutsManagement` (admin side)
5. Rebuild `EarningsPanel` (influencer side)
6. Rebuild `RewardsPanel` (student side)
7. Add notification triggers for payout status changes
8. Add translation keys
9. Test end-to-end flow

