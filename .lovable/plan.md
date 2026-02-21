

# Full System Logic Audit Report

## Executive Summary

After thorough code review of the entire lead-case-influencer-commission flow, I identified **19 issues** across 5 severity levels. The most critical findings involve stage transition bypass paths, the NextStepButton allowing any role to mark cases as paid (bypassing the admin-only edge function), and a lack of DB-level enforcement of stage transitions.

---

## 1. Stage Flow Integrity

### 1.1 CRITICAL -- NextStepButton bypasses admin-only paid gating

**File**: `src/components/admin/NextStepButton.tsx` lines 48-56
**Risk**: HIGH

The `NextStepButton` component allows transitioning to `CaseStatus.PAID` via a direct client-side Supabase update. It auto-sets `paid_at` on line 54-55. This completely bypasses the `admin-mark-paid` edge function that was designed to be the only path to "paid" status. Any component using `NextStepButton` (admin dashboard) can mark paid without audit logging or countdown initialization.

**Impact**: `is_paid_admin`, `paid_countdown_started_at` are never set. Commission countdown never starts. The `auto_split_payment` trigger fires immediately, creating rewards without the 20-day lock.

**Fix**: Remove `CaseStatus.PAID` from `ALLOWED_TRANSITIONS[PROFILE_FILLED]` and `ALLOWED_TRANSITIONS[SERVICES_FILLED]`. The only path to paid should be the `admin-mark-paid` edge function. Or, modify NextStepButton to call the edge function when target is PAID.

### 1.2 MEDIUM -- confirmCompleteFile forces status skip

**File**: `src/pages/TeamDashboardPage.tsx` lines 353-358
**Risk**: MEDIUM

`confirmCompleteFile()` has a fallback on line 356-358 that forces `case_status = PROFILE_FILLED` for appointment-stage cases even when `canTransition()` returns false. This bypasses the transition guard for cases in `assigned` or `contacted` status.

**Fix**: Remove the fallback. If `canTransition` returns false, show an error toast instead of forcing the transition.

### 1.3 MEDIUM -- confirmPaymentAndSubmit forces services_filled skip

**File**: `src/pages/TeamDashboardPage.tsx` lines 397-402
**Risk**: MEDIUM

Line 400-401: If the case is `profile_filled` and `canTransition` returns false (it should return true since `PROFILE_FILLED -> SERVICES_FILLED` is allowed), there's a redundant fallback that sets `services_filled` without the guard check. This is a dead code path but introduces confusion and could mask future bugs.

**Fix**: Remove the redundant `else if` on line 400-401. The `canTransition` check on line 398 already covers this case.

### 1.4 LOW -- No DB-level stage transition enforcement

**Risk**: LOW (mitigated by RLS)

Stage transitions are only enforced in the frontend (`canTransition()`). A direct SQL update or any backend code using service role key can set any status. The `auto_split_payment` trigger only checks `case_status = 'paid'` but not whether the transition was valid.

**Fix**: Add a Postgres trigger `BEFORE UPDATE` on `student_cases` that validates `NEW.case_status` is a valid successor of `OLD.case_status` using the same transition map. This is a safety net, not urgent.

### 1.5 INFO -- Stage order mismatch between plan and code

The plan states: `New -> Contacted -> Appointments -> Profile -> Completed -> Submitted to Admin`

The code enforces: `New -> Eligible -> Assigned -> Contacted -> Appointment stages -> Profile Filled -> Services Filled -> Paid -> Ready to Apply -> Visa Stage -> Completed`

These are compatible but the plan's simplified view omits intermediary stages. No action needed, just noting the discrepancy.

---

## 2. Assignment & Reassignment

### 2.1 MEDIUM -- Reassign modal fetches team members via admin-only endpoint

**File**: `src/pages/TeamDashboardPage.tsx` lines 143-173
**Risk**: MEDIUM

The `get-team-members` edge function requires admin role. Team members (lawyers) who try to reassign will get a 403 from the edge function. The fallback on lines 156-160 queries `profiles` directly, but this depends on RLS -- lawyers don't have a policy to SELECT other lawyers' profiles.

**Impact**: Reassign modal may show empty list for non-admin team members.

**Fix**: Either (a) modify `get-team-members` to also allow `lawyer` role callers, or (b) add an RLS policy on `profiles` allowing lawyers to read other lawyers' basic info (id, full_name), or (c) create a dedicated RPC function.

### 2.2 LOW -- Reassignment does not preserve stage (correctly)

**File**: `src/pages/TeamDashboardPage.tsx` lines 459-487

The `handleReassignCase` function correctly only updates `assigned_lawyer_id`, `reassigned_from`, `reassignment_notes`, and `reassignment_history`. It does NOT change `case_status`. This is correct behavior per requirements.

**Status**: PASS

### 2.3 LOW -- No double-click protection on reassign

**File**: `src/pages/TeamDashboardPage.tsx` line 460

`setReassigning(true)` is set but the button's `disabled` prop should check `reassigning`. This appears to be handled. Let me verify...

The reassign button is at line 565 -- it doesn't check `reassigning` state. Rapid double-clicks could create duplicate history entries.

**Fix**: Add `disabled={reassigning}` to the reassign button trigger, or add idempotency check in `handleReassignCase`.

### 2.4 LOW -- Reassigning to deactivated member is possible

The lawyer list is fetched from `get-team-members` which filters by `neq('student_status', 'inactive')`. However, the fallback direct query on lines 157-160 does NOT filter by status.

**Fix**: Add `.neq('student_status', 'inactive')` to the fallback query.

---

## 3. Admin "Mark as Paid" & Countdown

### 3.1 CRITICAL -- auto_split_payment trigger conflicts with countdown model

**DB Function**: `auto_split_payment()`
**Risk**: CRITICAL

The `auto_split_payment` trigger fires `BEFORE UPDATE` on `student_cases` when `NEW.case_status = 'paid'`. It immediately creates rewards and commissions with status `pending`. This happens at the moment the `admin-mark-paid` edge function sets `case_status = 'paid'`.

Per the approved plan, commissions should NOT be created until 20 days after marking paid. But the trigger creates them immediately. The `request_payout` RPC enforces the 20-day lock on rewards (line: `AND (NOW() - created_at) < INTERVAL '20 days'`), so influencers can't cash out early. However, the rewards already exist with `created_at = now()`, which means the 20-day lock is based on reward creation time, NOT `paid_countdown_started_at`.

**Assessment**: The current system works differently from the plan's ideal model but is functionally correct:
- Rewards are created immediately when marked paid (via trigger)
- `request_payout` RPC enforces 20-day lock on rewards
- The lock uses `rewards.created_at`, not `paid_countdown_started_at`

**Risk**: If the trigger is disabled or the reward creation timing changes, the lock breaks. The `paid_countdown_started_at` column exists but is NOT used by any payout logic.

**Fix**: Either (a) update `request_payout` RPC to use `paid_countdown_started_at` from the related case instead of `rewards.created_at`, or (b) document that the current model uses reward creation date as the lock anchor and `paid_countdown_started_at` is informational only.

### 3.2 MEDIUM -- Idempotency gap in admin-mark-paid

**File**: `supabase/functions/admin-mark-paid/index.ts` lines 49-55
**Risk**: LOW

The function checks `if (caseRow.is_paid_admin)` and returns success. This is correct idempotency. However, it does NOT check if `case_status` is already `'paid'` independently of `is_paid_admin`. A case could be in `paid` status (set by NextStepButton bypass) with `is_paid_admin = false`, and calling admin-mark-paid would then set `is_paid_admin = true` and overwrite `paid_at`.

**Fix**: Also check `if (caseRow.case_status === 'paid')` as a secondary guard.

### 3.3 LOW -- Countdown uses client-side Date in influencer UI

**File**: `src/pages/InfluencerDashboardPage.tsx` lines 117-122

`getTimerInfo` uses `Date.now()` (client time) vs `new Date(paidAt)` (server time). If client clock is wrong, countdown display will be inaccurate. However, the actual lock enforcement is server-side in `request_payout` RPC, so this is cosmetic only.

**Status**: Acceptable. Cosmetic risk only.

### 3.4 INFO -- No background scheduler exists

The plan mentions a scheduler to check `paid_countdown_started_at + 20 days` and create commissions. No such scheduler or cron job exists. The current system relies on the `auto_split_payment` trigger (immediate creation) + `request_payout` RPC (20-day lock). This is a simpler but different model than planned.

**Status**: Document this architectural decision. No scheduler is needed in the current model.

---

## 4. Commission State Machine

### 4.1 MEDIUM -- Commission status field is unused

The `commissions.status` column (default `'pending'`) was added per the plan, but no code reads or updates it based on the countdown lifecycle. The `auto_split_payment` trigger sets it to `'pending'` on creation. Nothing transitions it to `'countdown'`, `'available'`, or `'paid'`.

The actual payout lifecycle uses `rewards.status` (`pending` -> `approved` -> `paid`) and `payout_requests.status` instead.

**Fix**: Either implement the commission state machine or remove the `status` column to avoid confusion. Currently it's dead data.

### 4.2 LOW -- Multiple commissions per case possible

The `auto_split_payment` trigger uses `ON CONFLICT DO NOTHING` for commission inserts. However, `commissions` has no unique constraint on `case_id`. If a case is moved away from `paid` and back (refund then re-pay), a second commission row is created.

The trigger does cancel old commissions when moving away from paid (lines: `UPDATE rewards SET status = 'cancelled'...`), and old commissions get cancelled too. But on re-entry to paid, new rows are created rather than restoring old ones.

**Fix**: Add a unique index on `commissions(case_id)` or change the trigger to upsert.

---

## 5. Role-Based Permission Audit

### 5.1 PASS -- Team member cannot access admin-mark-paid

The `admin-mark-paid` edge function checks admin role. Team dashboard no longer sets `paid` status (confirmPaymentAndSubmit now sets `services_filled`). PASS.

### 5.2 CRITICAL -- NextStepButton can be used by any admin to set PAID without edge function

As noted in 1.1, the `NextStepButton` component (used in admin dashboard) can transition directly to PAID via client-side update, bypassing the edge function. This means `is_paid_admin` and `paid_countdown_started_at` are never set.

**Fix**: Same as 1.1.

### 5.3 PASS -- Team member Earnings tab removed

`TeamDashboardPage.tsx` line 41-47: `TabId` type no longer includes `'earnings'`. PASS.

### 5.4 PASS -- Influencer cannot modify stages

Influencer dashboard is read-only for case data (no update buttons). RLS on `student_cases` only allows SELECT for influencers. PASS.

### 5.5 LOW -- delete-account allows self-deletion without case transfer

**File**: `supabase/functions/delete-account/index.ts`

The self-delete path (lines 25-41) does not check for assigned cases. A team member with active cases can delete their own account, orphaning cases. The `purge-account` function handles this properly, but `delete-account` does not.

**Fix**: Add case count check to `delete-account` or redirect self-deletion through the purge flow.

---

## 6. Data Integrity & Constraints

### 6.1 MEDIUM -- No foreign key on student_cases.lead_id

The `leads` table has no FK constraint to `student_cases.lead_id`. If a lead is hard-deleted (not soft-deleted), the case becomes orphaned. Currently mitigated by soft-delete architecture, but a hard DELETE would break integrity.

**Status**: Acceptable given soft-delete pattern. Document as constraint.

### 6.2 LOW -- housing_description and has_translation_service not included in PDF export

**File**: `src/components/admin/StudentCasesManagement.tsx` lines 103-111

The `bulkExportPDF` function exports basic fields but does NOT include `housing_description`, `has_translation_service`, or `accommodation_status`. The plan requires these in PDF.

**Fix**: Add these columns to the PDF export headers and row mapping.

### 6.3 LOW -- student_cases.assigned_lawyer_id can be null

A case can exist with `assigned_lawyer_id = null` (e.g., after force-purge). Cases in this state won't appear in any team member's dashboard. The `requires_reassignment` flag exists but nothing in the admin UI surfaces cases needing reassignment.

**Fix**: Add a filter/badge in admin's Student Cases tab showing cases where `requires_reassignment = true`.

---

## 7. Concurrency & Race Conditions

### 7.1 MEDIUM -- No optimistic locking on case updates

Multiple users (admin + team member) can update the same case simultaneously. The last write wins. Example: admin marks paid while team member submits, resulting in inconsistent state.

**Fix**: Add a version column or use `updated_at` as an optimistic lock check.

### 7.2 LOW -- Reassignment history is append-only JSON but not transactional

The `handleReassignCase` reads `reassignment_history`, appends, and writes back. If two reassignments happen simultaneously, one history entry is lost.

**Fix**: Use a Postgres function that atomically appends to the JSON array using `jsonb_set` or `||` operator.

---

## 8. Logging & Observability

### 8.1 PASS -- Assignment logged via admin_audit_log in LeadsManagement
### 8.2 PASS -- Reassignment logged via log_user_activity RPC
### 8.3 PASS -- Submit to admin logged via log_user_activity RPC
### 8.4 PASS -- Admin mark paid logged in edge function
### 8.5 PASS -- User purge logged in purge-account edge function
### 8.6 MISSING -- Commission availability transition not logged

No log entry when a commission becomes "available" (if/when that logic is implemented). Currently the trigger creates rewards silently.

---

## 9. Error Handling

### 9.1 PASS -- All API calls have error handling with toast notifications
### 9.2 PASS -- Loading states disable buttons during processing
### 9.3 MEDIUM -- No double-click protection on Mark Paid button

**File**: `src/components/admin/StudentCasesManagement.tsx` line 156

The `disabled={loading}` prop exists, but `loading` is shared state. If two different case cards are visible, clicking Mark Paid on one disables all, which is correct. However, the edge function's idempotency guard (`is_paid_admin` check) provides server-side protection.

**Status**: Acceptable. Server-side idempotency covers this.

---

## Summary Table

| # | Severity | Area | Issue | File |
|---|----------|------|-------|------|
| 1.1 | CRITICAL | Stage Flow | NextStepButton bypasses admin-mark-paid edge function | NextStepButton.tsx:54 |
| 1.2 | MEDIUM | Stage Flow | confirmCompleteFile forces status skip | TeamDashboardPage.tsx:356 |
| 1.3 | MEDIUM | Stage Flow | Redundant fallback in confirmPaymentAndSubmit | TeamDashboardPage.tsx:400 |
| 1.4 | LOW | Stage Flow | No DB-level transition enforcement | N/A |
| 2.1 | MEDIUM | Reassign | get-team-members admin-only blocks team members | TeamDashboardPage.tsx:149 |
| 2.3 | LOW | Reassign | No double-click protection on reassign button | TeamDashboardPage.tsx:565 |
| 2.4 | LOW | Reassign | Fallback query doesn't filter inactive members | TeamDashboardPage.tsx:157 |
| 3.1 | CRITICAL | Commission | auto_split_payment creates rewards immediately vs 20-day plan | auto_split_payment trigger |
| 3.2 | MEDIUM | Mark Paid | Edge function doesn't check existing paid status | admin-mark-paid:49 |
| 4.1 | MEDIUM | Commission | commissions.status field unused | Schema |
| 4.2 | LOW | Commission | Multiple commissions per case possible | auto_split_payment trigger |
| 5.2 | CRITICAL | Permissions | NextStepButton allows PAID without edge function | NextStepButton.tsx |
| 5.5 | LOW | Permissions | delete-account allows self-delete with active cases | delete-account/index.ts |
| 6.2 | LOW | Data | PDF export missing housing and translation fields | StudentCasesManagement.tsx:103 |
| 6.3 | LOW | Data | No UI for requires_reassignment cases | Admin dashboard |
| 7.1 | MEDIUM | Concurrency | No optimistic locking on case updates | All case update paths |
| 7.2 | LOW | Concurrency | Reassignment history append not atomic | TeamDashboardPage.tsx:470 |
| 8.6 | LOW | Logging | Commission availability not logged | N/A |
| 9.3 | MEDIUM | Error | Mark Paid double-click (mitigated server-side) | StudentCasesManagement.tsx:156 |

---

## Recommended Fix Priority

### Immediate (Critical -- fix before next deployment)

1. **Remove PAID from NextStepButton transitions** -- Remove `CaseStatus.PAID` from `ALLOWED_TRANSITIONS[PROFILE_FILLED]` and `ALLOWED_TRANSITIONS[SERVICES_FILLED]` in `caseTransitions.ts`. The ONLY path to paid should be `admin-mark-paid` edge function.

2. **Decide on commission timing model** -- Either (a) accept the current model where `auto_split_payment` creates rewards immediately and `request_payout` RPC enforces 20-day lock via `rewards.created_at`, OR (b) modify the trigger to not create rewards until countdown completes. Option (a) is simpler and already works.

### Short-term (Medium -- fix this sprint)

3. Fix `get-team-members` to allow lawyer role callers (for reassign modal)
4. Remove forced status fallbacks in `confirmCompleteFile`
5. Add `housing_description` and `has_translation_service` to PDF export
6. Add secondary guard in `admin-mark-paid` for existing paid status

### Later (Low -- backlog)

7. Add DB-level transition trigger
8. Add optimistic locking
9. Add unique constraint on `commissions(case_id)`
10. Surface `requires_reassignment` cases in admin UI
11. Block self-delete when user has active cases

