
## Analysis

The user wants these fixes on the team side:

### 1. "No next step after appointment" bug
**Root cause**: In `CaseDetailPage.tsx`, the "Next Action" card shows `appointment_scheduled` only if `latestAppt` exists. BUT the query on line 74 does:
```
.is('outcome', null)
```
After an appointment outcome is recorded (via `record-appointment-outcome` edge function), the appointment gets `outcome` set — so it's FILTERED OUT of `appointments`. Then `latestAppt` is `undefined`. The `appointment_scheduled` branch says `latestAppt && (...)` — no `latestAppt`, nothing renders. Fix: fetch ALL appointments (not just `outcome IS NULL`), and in the `appointment_scheduled` block, show "Record Outcome" if not yet recorded OR show the outcome result + next step if already recorded.

Actually deeper: after recording outcome = `completed`, the edge function moves case to `profile_completion`. So if status IS `profile_completion`, the ProfileCompletionForm SHOULD show. But the user says "no next step" — this suggests the edge function isn't moving the status OR the `appointment_scheduled` block doesn't show properly because there's no pending appointment.

I need to check `record-appointment-outcome` edge function.

### 2. Remove "New" from sidebar, put profile stage after appointment
**Sidebar**: Remove `new` status from the team sidebar nav (it's not a sidebar item — it's a status filter on the Cases page). The user means remove `new` from STATUS_FILTERS in `TeamCasesPage.tsx`. When a team member creates a case manually, it starts at `appointment_scheduled` (not `new`). Cases from apply page start at `new` but are assigned by admin, so team members shouldn't see `new` at all. Remove it from the filter pills.

### 3. Pipeline: appointment → profile_completion → payment_confirmed → submitted → enrollment_paid
The current "Next Action" panel is mostly right but:
- After appointment outcome = completed → move to `profile_completion` (done by edge function)  
- `profile_completion` → shows `ProfileCompletionForm` (inline in card — ✅ correct)
- After profile saved → move to `payment_confirmed` (done in `ProfileCompletionForm.handleSave` with `status: 'profile_completion'` — **BUG**: it sets status to `profile_completion` instead of leaving it there after saving and waiting for explicit "Confirm Payment")
  
Actually the flow spec says: profile form is at `profile_completion` stage. When team completes it, it stays at `profile_completion` until they confirm payment (which moves to `payment_confirmed`). Then after payment confirmed, they can "Submit to Admin" (moves to `submitted`). Only admin can move to `enrollment_paid`.

Current `ProfileCompletionForm.handleSave` sets status to `profile_completion` — this is already correct (it saves the form but keeps status at `profile_completion`). After saving, the "Next Action" card should show a "Confirm Payment" button (the `PaymentConfirmationForm`). But currently PaymentConfirmationForm shows when status is ALREADY `payment_confirmed` — that's wrong. It should show at `profile_completion` stage AFTER profile is saved.

Wait re-reading CaseDetailPage:
- `profile_completion` → shows `ProfileCompletionForm` inline (which saves data and keeps status at `profile_completion`)
- `payment_confirmed` → shows `PaymentConfirmationForm` + submit button

**The bug**: There's no progression button from `profile_completion` to `payment_confirmed`. The `ProfileCompletionForm` keeps status at `profile_completion` but doesn't advance. The team member needs a separate "Move to Payment" button after profile is filled.

Fix: In `ProfileCompletionForm.handleSave`, after saving, DON'T change status — show a success state + "Proceed to Payment" button. OR add a "Mark Profile Complete → Proceed to Payment" button in `CaseDetailPage` next action card when status is `profile_completion` AND `submission` exists.

### 4. "My Students" page — click student → see all case info
When clicking a student card in `TeamStudentsPage`, it navigates to `/team/cases/${c.id}` (CaseDetailPage). CaseDetailPage already shows the full case info. But the user wants to see: info, course, payment, dates. CaseDetailPage shows this in the Submission card. Need to make the CaseDetailPage student view richer when accessed from My Students (submission details, course info, payment amounts, etc.).

### 5. "Create Student Account" button on top of My Students page
User wants to click "Create Student Account" from My Students page → choose a case from a dropdown (cases that don't have `student_user_id` yet, in status `profile_completion`+) → create account with temp password. This is SEPARATE from the existing button in CaseDetailPage.

Currently CaseDetailPage has the button already. The user wants it also on the TeamStudentsPage header. We add a "Create Student Account" button at the top of TeamStudentsPage that opens a modal with:
1. A dropdown/search to pick a case (fetch cases where `student_user_id IS NULL` and status in eligible statuses)
2. Email input
3. Submit → calls `create-student-from-case` edge function
4. Shows temp password modal with copy + WhatsApp

### 6. Reschedule appointments
Each appointment card needs a "Reschedule" button that opens a datetime picker and updates the appointment. The `RescheduleDialog` component exists already. Need to wire it up in `CaseDetailPage`.

### 7. Each stage has a button to move to next step
Current state:
- `new` → "Mark as Contacted" ✅
- `contacted` → "Schedule Appointment" ✅
- `appointment_scheduled` → "Record Outcome" ✅ (but breaks after outcome recorded)
- `profile_completion` → form shows but NO progression button to payment stage ❌
- `payment_confirmed` → PaymentConfirmationForm + Submit to Admin ✅ (but PaymentForm is showing AT payment_confirmed which means you already moved there — how?)

**Root issue**: The stage transitions are:
1. `new` → contacted (via button)
2. `contacted` → appointment_scheduled (via scheduler)
3. `appointment_scheduled` → profile_completion (via outcome modal, edge function)
4. `profile_completion` → payment_confirmed (MISSING button — profile form saves but doesn't advance)
5. `payment_confirmed` → submitted (via Submit to Admin)
6. `submitted` → enrollment_paid (admin only)

Fix for step 4: After `ProfileCompletionForm` saves successfully, show a "Confirm Payment" section (PaymentConfirmationForm moves case to `payment_confirmed`). Currently `PaymentConfirmationForm` is shown ONLY when status is `payment_confirmed` — that's wrong. It should be shown at `profile_completion` AFTER the profile is filled (i.e., `submission` exists). 

Let me redesign the Next Action panel:
- `profile_completion` AND no submission yet → show ProfileCompletionForm
- `profile_completion` AND submission exists → show "Profile saved ✅" + PaymentConfirmationForm
- `payment_confirmed` → show "Payment confirmed ✅" + Submit to Admin button
- `submitted` → "Awaiting admin"
- `enrollment_paid` → "Enrolled"

This is the cleanest fix.

### Files to change:

**1. `src/pages/team/CaseDetailPage.tsx`** — Major changes:
   - Fix appointment query: fetch ALL appointments (remove `.is('outcome', null)`)
   - Fix Next Action panel:
     - `appointment_scheduled`: show latest appt with outcome if recorded, if no outcome show "Record Outcome". If ALL appointments have outcomes but status still `appointment_scheduled` → show "Outcome was recorded — check edge function" (shouldn't happen normally)
     - `profile_completion` + no submission → show ProfileCompletionForm
     - `profile_completion` + submission exists → show "Profile complete ✅" + PaymentConfirmationForm
     - Remove `payment_confirmed` → PaymentConfirmationForm block (PaymentForm now lives at `profile_completion` after submission)
     - `payment_confirmed` → show payment summary + "Submit to Admin" button
   - Add Reschedule button on each appointment card (wire up `RescheduleDialog`)
   - Fix appointment section to show ALL appointments (past + future with outcomes shown)

**2. `src/pages/team/TeamCasesPage.tsx`** — Minor:
   - Remove `new` from `STATUS_FILTERS` array (team members shouldn't see/filter by `new`)

**3. `src/pages/team/TeamStudentsPage.tsx`** — Add "Create Student Account" modal:
   - Add button at top
   - Modal: fetch cases where `student_user_id IS NULL` and status in `['profile_completion','payment_confirmed','submitted','enrollment_paid']` and `assigned_to = user.id`
   - Dropdown to select case + email input
   - Call `create-student-from-case` 
   - Show temp password + copy + WhatsApp

**4. `supabase/functions/record-appointment-outcome/index.ts`** — Verify it moves case to `profile_completion` on `completed` outcome. Need to read this file.

Let me check the edge function first.

After reviewing the code, the plan is:

### Detailed changes:

**CaseDetailPage.tsx:**
1. Change appointment query to fetch ALL appointments (not just `outcome IS NULL`):
   ```
   supabase.from('appointments').select('*').eq('case_id', id).order('scheduled_at', { ascending: false })
   ```
2. `latestAppt` = first appointment regardless of outcome
3. Next Action panel logic:
   - `appointment_scheduled`:
     - If `latestAppt` with no outcome → show appt time + "Record Outcome" + "Reschedule" buttons
     - If all appointments have outcomes (latestAppt has outcome) → show outcome badge + note "Status update may be pending"
   - `profile_completion`:
     - If no `submission` → show ProfileCompletionForm
     - If `submission` exists → show "✅ Profile saved" summary + PaymentConfirmationForm inline
   - `payment_confirmed`:
     - Show payment summary (fee amounts from submission)
     - Show "Submit to Admin" button (already exists)
   - Remove the old `payment_confirmed` → PaymentConfirmationForm block
4. Appointment list: show ALL (past with outcome badges, future without)
5. Add "Reschedule" button on each appointment → open `RescheduleDialog`
6. Import `RescheduleDialog`

**TeamCasesPage.tsx:**
- Remove `'new'` from `STATUS_FILTERS` constant

**TeamStudentsPage.tsx:**
- Add "Create Student Account" button at top
- New state: `showCreateModal`, `eligibleCases`, `selectedCaseId`, `createEmail`, `creating`, `tempPwResult`
- On modal open: fetch cases where `assigned_to = user.id`, `student_user_id IS NULL`, `status IN ['profile_completion','payment_confirmed','submitted','enrollment_paid']`
- Select dropdown showing case `full_name (status)`
- Email input
- Submit → call edge function → show temp password modal

No DB migration needed.

### Also: check `record-appointment-outcome` edge function to ensure it properly moves status
