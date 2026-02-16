
# Team Dashboard -- Critical Bug Fixes

## Root Cause Analysis

### Bug 1: "Complete Profile" does NOT move case to next tab
**Root cause identified:** The finite-state machine (FSM) in `caseTransitions.ts` only allows `appointment_completed -> profile_filled`. But most cases sit in `appointment_scheduled` or `appointment_waiting`, so `canTransition()` returns `false` and the status is never updated. The data saves silently but the case stays in the same tab.

**Fix:** Update `ALLOWED_TRANSITIONS` to allow direct transitions from `appointment_scheduled` and `appointment_waiting` to `profile_filled` (completing the profile implicitly means the appointment stage is done).

### Bug 2: `gender` field is required but never saved
**Root cause:** The `gender` field is listed in `requiredProfileFields` but is NOT included in the `updateData` object sent to the database. The `student_cases` table does not have `gender`, `height`, or `eye_color` columns.

**Fix:**
1. Add a database migration to create `gender` column on `student_cases` (text, nullable).
2. Include `gender` in the `updateData` object in `saveProfileCompletion`.
3. Remove `gender` from the mandatory list OR keep it mandatory once the column exists (keep it -- user wants all fields mandatory).

### Bug 3: Delete case fails silently (RLS)
**Root cause:** The `student_cases` table RLS only grants DELETE to admins (`has_role(auth.uid(), 'admin')`). Lawyers have UPDATE and SELECT but NOT DELETE. So `handleDeleteCase` always fails.

**Fix:** Add an RLS policy allowing lawyers to delete their own assigned cases (restricted to `new`/`eligible` statuses for safety, enforced in the UI).

### Bug 4: Reschedule creates duplicate (potential)
The current code correctly uses `.update().eq('id', ...)` so this is NOT a bug in the current implementation. The reschedule flow is correct.

### Bug 5: Today's appointments already implemented
Already working. No change needed.

### Bug 6: Language school dropdown already implemented
Already using the 4-partner dropdown (`LANGUAGE_SCHOOLS`). No change needed.

---

## Changes

### 1. Database Migration
Add `gender` column to `student_cases` and an RLS policy for lawyer delete:

```sql
-- Add gender column
ALTER TABLE student_cases ADD COLUMN IF NOT EXISTS gender text;

-- Allow lawyers to delete their assigned cases
CREATE POLICY "Lawyers can delete assigned cases"
  ON student_cases FOR DELETE
  USING (
    has_role(auth.uid(), 'lawyer'::app_role)
    AND assigned_lawyer_id = auth.uid()
  );
```

### 2. Fix FSM transitions (`src/lib/caseTransitions.ts`)
Allow `appointment_scheduled` and `appointment_waiting` to transition directly to `profile_filled`:

```
APPT_SCHEDULED -> [APPT_COMPLETED, APPT_WAITING, PROFILE_FILLED]
APPT_WAITING   -> [APPT_SCHEDULED, APPT_COMPLETED, PROFILE_FILLED]
```

### 3. Fix `saveProfileCompletion` in `src/pages/TeamDashboardPage.tsx`
- Add `gender` to the `updateData` object so it gets saved to the database.
- The rest of the flow (mandatory validation, confirmation dialog, auto-switch to "profile_filled" tab) is already in place and will now work once the FSM allows the transition.

### 4. Fix `confirmCompleteFile` resilience
Add a fallback: if `canTransition` returns false for `PROFILE_FILLED`, force-set it anyway for appointment-stage statuses. This ensures the status always updates when the user confirms.

---

## Files Modified

| File | Change |
|------|--------|
| Database migration | Add `gender` column + lawyer DELETE RLS policy |
| `src/lib/caseTransitions.ts` | Add `PROFILE_FILLED` to allowed transitions from `APPT_SCHEDULED` and `APPT_WAITING` |
| `src/pages/TeamDashboardPage.tsx` | Include `gender` in `updateData`; add fallback in `confirmCompleteFile` to force status transition |

## Security Notes
- The new DELETE policy restricts lawyers to only deleting cases assigned to them.
- No changes to sensitive financial data flows.
- Audit logging already covers profile completion and delete actions.
