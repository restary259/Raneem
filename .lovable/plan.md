

# Critical Logic Correction and Flow Enforcement Plan

## Priority Assessment

Based on the screenshot and code analysis, there are **3 critical issues** and **3 important improvements** to implement.

---

## CRITICAL FIX 1: Team Data Isolation (HIGHEST PRIORITY)

**Root Cause Found**: Two compounding problems cause Team 02 to see all 3 cases:

1. **RLS Policy Too Permissive**: The `student_cases` RLS policy "Lawyers can view all active cases" uses `(has_role(auth.uid(), 'lawyer') AND (deleted_at IS NULL))` -- this returns ALL non-deleted cases to every lawyer, not just their assigned ones.

2. **Query Missing Filter**: `dataService.ts` line 94-99 fetches `student_cases` with `.is('deleted_at', null)` but does NOT include `.eq('assigned_lawyer_id', userId)`.

**Fix (Two-Layer Defense)**:

- **Database Layer**: Modify the RLS SELECT policy for lawyers on `student_cases` to:
  `has_role(auth.uid(), 'lawyer') AND assigned_lawyer_id = auth.uid() AND deleted_at IS NULL`

- **Query Layer**: Add `.eq('assigned_lawyer_id', userId)` to the `getTeamDashboard` cases query as defense-in-depth.

- **Client Layer**: Add a defensive `cases.filter(c => c.assigned_lawyer_id === userId)` in TeamDashboardPage as final safety net.

**Impact**: Zero disruption. Cases already have `assigned_lawyer_id` set correctly. Only visibility scope changes.

---

## CRITICAL FIX 2: Reassignment Stage Restriction

**Current State**: The reassign button appears on ALL case statuses including `paid`, `services_filled`, and `completed`.

**Required Rule**: Reassignment only allowed for statuses: `assigned`, `contacted`, `appointment_scheduled`, `appointment_waiting`, `appointment_completed`.

**Fix**:
- In `TeamDashboardPage.tsx` `renderCaseActions`, conditionally render the reassign button only when `case_status` is in the allowed set.
- In `ReassignDialog.tsx`, add a server-side guard that checks status before executing the update.
- Add tooltip text on disabled states explaining why.

---

## CRITICAL FIX 3: Admin Case Visibility Timing

**Current State**: Admin `StudentCasesManagement` filters by `READY_STATUSES = ['profile_filled', 'services_filled', 'paid']`. Cases appear as soon as `profile_filled` is reached, even before team explicitly clicks "Submit to Admin".

**Required Behavior**: Cases should only appear in admin view after team clicks "Submit to Admin" (which sets `submitted_to_admin_at` and transitions to `services_filled`).

**Fix**:
- Change `READY_STATUSES` to `['services_filled', 'paid']` -- removing `profile_filled` so cases only appear after the explicit submit action.
- This ensures the team has a chance to review the profile before it reaches admin.

---

## IMPORTANT FIX 4: 20-Day Payment Confirmation Modal

**Current State**: Admin can mark any case as paid instantly via `admin-mark-paid` edge function with no warning about the 20-day countdown implications.

**Fix**:
- In `StudentCasesManagement.tsx`, before calling `markAsPaid`, show a confirmation dialog that:
  - Displays the student name
  - Shows "This will start a 20-day payout countdown"
  - Shows the expected payout eligibility date (today + 20 days)
  - Requires explicit confirmation
- No changes to the edge function itself (business logic preserved).

---

## IMPORTANT FIX 5: WhatsApp Link Centralization

**Current State**: WhatsApp links are hardcoded in 4+ files:
- `EarningsPanel.tsx`: `https://api.whatsapp.com/message/IVC4VCAEJ6TBD1`
- `SubmitVideo.tsx`: `https://wa.me/972524061225`
- `OfficeLocations.tsx`: `https://api.whatsapp.com/message/IVC4VCAEJ6TBD1`
- `Contact.tsx`: `https://api.whatsapp.com/message/IVC4VCAEJ6TBD1`
- `ApplyPage.tsx`: `https://chat.whatsapp.com/J2njR5IJZj9JxLxV7GqxNo` (group link, different)

**Fix**:
- Create `src/lib/contactConfig.ts` with centralized WhatsApp URLs.
- Replace all hardcoded references with imports from this config.
- The Apply page group link stays separate (it is a community group, not a support contact).

---

## IMPORTANT FIX 6: WhatsApp Payout Button Activation

**Current State**: The EarningsPanel WhatsApp button already works correctly -- it checks `eligibleRewards.length > 0 && availableAmount >= minThreshold` and the 20-day lock. This is already implemented properly.

**Verification**: No code change needed. The existing logic in `EarningsPanel.tsx` lines 70-76 correctly filters rewards by 20-day lock and pending status.

---

## Technical Implementation Details

### Files to Modify

| File | Change | Risk |
|---|---|---|
| Database migration (RLS) | Restrict lawyer SELECT on `student_cases` to `assigned_lawyer_id = auth.uid()` | Low -- narrows scope |
| `src/integrations/supabase/dataService.ts` | Add `.eq('assigned_lawyer_id', userId)` to team cases query | Low -- additive filter |
| `src/pages/TeamDashboardPage.tsx` | Add client-side filter + reassign button stage guard | Low -- UI only |
| `src/components/team/ReassignDialog.tsx` | Add status validation before reassignment | Low -- guard only |
| `src/components/admin/StudentCasesManagement.tsx` | Remove `profile_filled` from READY_STATUSES; add 20-day confirmation modal | Low -- UI filter change |
| `src/lib/contactConfig.ts` (new) | Centralized WhatsApp URLs | Zero risk |
| `src/components/influencer/EarningsPanel.tsx` | Import WhatsApp URL from config | Zero risk |
| `src/components/broadcast/SubmitVideo.tsx` | Import WhatsApp URL from config | Zero risk |
| `src/components/landing/OfficeLocations.tsx` | Import WhatsApp URL from config | Zero risk |
| `src/components/landing/Contact.tsx` | Import WhatsApp URL from config | Zero risk |
| `public/locales/en/dashboard.json` | Add i18n keys for confirmation dialogs | Zero risk |
| `public/locales/ar/dashboard.json` | Add i18n keys for confirmation dialogs | Zero risk |

### What Will NOT Change

- Commission calculation formulas (auto_split_payment trigger)
- Case status definitions (CaseStatus enum)
- Case transition rules (ALLOWED_TRANSITIONS)
- Financial aggregation queries
- 20-day lock timer logic
- Influencer dashboard lead visibility
- Admin dashboard data access
- Payment marking edge function logic

### Rollback Plan

Each fix is independent:
1. RLS policy can be reverted to previous `deleted_at IS NULL` condition
2. Query filter can be removed (one line)
3. Client filter can be removed (one line)
4. Reassign guard can be removed (condition removal)
5. READY_STATUSES can add back `profile_filled`
6. Config imports can be replaced with hardcoded strings

