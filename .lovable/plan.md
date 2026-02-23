

# Two-Part Fix: Early Payout Release + Data Purge

## Part A: Early Payout Release (WhatsApp Button + Timer Fix)

### Problem
When admin marks a case as "paid", a 20-day lock starts on the rewards. Even if the admin decides to pay the influencer/team member early, the system still shows a countdown timer and the WhatsApp payout button stays disabled.

### What Changes

**1. New Edge Function: `admin-early-release`**
- Admin-only function that takes a `case_id`
- Finds all `pending` rewards linked to that case (via `admin_notes LIKE '%case_id%'`)
- Backdates each reward's `created_at` by 21 days so the 20-day lock is satisfied
- Creates a `payout_request` with status `paid` and marks rewards as `paid`
- Logs the action in `admin_audit_log`

**2. UI: "Release Early" Button on Admin Student Cases**
- On paid cases showing the countdown timer (locked state), add a small "Release Early" button
- Clicking it shows a confirmation dialog: "This will immediately release payout to the influencer/team member. Are you sure?"
- On confirm, calls the `admin-early-release` edge function
- After success, the countdown badge changes from "X days left" to "Payout Ready" (or disappears)

**3. Countdown Badge Logic Update**
- In `StudentCasesManagement.tsx`, check if the linked rewards are already `paid`
- If rewards are paid, show a green "Paid Out" badge instead of the countdown timer
- This handles both early release and normal 20-day completion scenarios

**4. EarningsPanel Already Works**
- The EarningsPanel WhatsApp button checks `reward.status === 'pending'` and the 20-day lock
- When admin releases early (marks rewards as `paid`), the button correctly shows nothing to request (rewards are already paid)
- The "Paid" KPI card updates automatically via realtime subscription

### Files to Create/Modify

| File | Change |
|---|---|
| `supabase/functions/admin-early-release/index.ts` | New edge function for early payout release |
| `src/components/admin/StudentCasesManagement.tsx` | Add "Release Early" button + confirmation dialog on locked countdown cases |
| `public/locales/en/dashboard.json` | Add i18n keys for early release UI |
| `public/locales/ar/dashboard.json` | Add Arabic i18n keys |

### What Does NOT Change
- Commission calculation (auto_split_payment trigger untouched)
- 20-day lock logic in `request_payout` RPC (untouched)
- EarningsPanel logic (already correct)
- Case status flow (paid remains terminal)

---

## Part B: Data Purge (Keep Accounts, Delete Operations Data)

### What Gets Deleted
All operational data will be purged using SQL DELETE statements:

1. `case_service_snapshots` (depends on student_cases)
2. `case_payments` (depends on student_cases)
3. `appointments` (depends on student_cases)
4. `commissions` (depends on student_cases)
5. `rewards` (all)
6. `payout_requests` (all)
7. `student_cases` (all)
8. `leads` (all)
9. `referrals` (all)
10. `notifications` (all)
11. `admin_audit_log` (all)

### What Gets Preserved
- `profiles` (all user accounts)
- `user_roles` (all role assignments)
- Auth users (untouched)
- `eligibility_config`, `eligibility_thresholds`
- `checklist_items`, `master_services`
- `major_categories`, `majors`
- `contact_submissions`
- `documents`, `services`, `payments` (student-owned)

### Execution Order
Deletions must happen in dependency order to avoid foreign key violations. This will be executed via the data operation tool (not migration).

---

## Safety Guarantees
- No database schema changes
- No commission formula changes
- No case flow changes
- All user accounts preserved
- Edge function is admin-only with role verification
- Each change is independently reversible

