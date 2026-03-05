## Strict Case Management Workflow System

### Current State Analysis

also when i click open full case and i get redirected it should show all the info we attached to that student with documents it should really show full case 

**CaseDetailPage.tsx** — Already has most pipeline logic but needs:

- Delete case/appointment buttons with confirmation dialogs
- Stage-skipping prevention (currently `updateStatus` can be called with any value)
- `new` status: restrict actions to only "Mark Contacted" and "Delete Case"

**TeamCasesPage.tsx** — Currently creates cases at `appointment_scheduled` status (skips `new` and `contacted`). Needs:

- New case creation → status `new`
- Remove mandatory appointment from creation form (appointment comes at `contacted` stage)
- `new` re-added to STATUS_FILTERS

**AdminSubmissionsPage.tsx** — Needs enriched view showing full case info, documents, and confirmation dialog with password re-auth before marking enrolled.

**AdminSettingsPage.tsx** — Needs a "Data Reset" tab with super admin purge function (password confirmation + warning dialog).

**CaseDetailPage.tsx** — Missing delete confirmations for appointments and cases.

### Files to Change

**1. `src/pages/team/TeamCasesPage.tsx**`

- New case creation → `status: 'new'`, no appointment required at creation
- Add `'new'` back to `STATUS_FILTERS`
- Case creation form: just name + phone (appointment scheduled separately in `contacted` stage)

**2. `src/pages/team/CaseDetailPage.tsx**` — Major changes:

- `**new` stage**: Only show "Mark as Contacted" + "Delete Case" — no scheduling, no profile, nothing else
- `**contacted` stage**: Show "Schedule Appointment" + "Delete Case" — no skipping
- `**appointment_scheduled**`: Show appointment + "Record Outcome" + "Reschedule" + "Delete Appointment" (with confirm) + "Delete Case"
- `**profile_completion**`: Form or payment — no skip to payment without saving
- `**payment_confirmed**`: Payment summary + "Submit to Admin" only
- `**submitted`/`enrollment_paid**`: Read-only display
- Add pipeline guard in `updateStatus()` — only allow sequential transitions (no skipping)
- Add **Delete Case** button (visible in all non-terminal stages, requires confirmation dialog)
- Add **Delete Appointment** button per appointment card (requires confirmation)
- Pipeline progress bar at top showing all 7 stages

**3. `src/pages/admin/AdminSubmissionsPage.tsx**` — Enrich detail view:

- Show full profile `extra_data` from `case_submissions`
- Show documents list (query `documents` where `case_id`)
- "Mark as Enrolled" button requires password re-auth dialog before executing
- Add "View Full Case" link

**4. `src/pages/admin/AdminSettingsPage.tsx**` — Add "Data Reset" tab:

- Password confirmation input
- Two-step warning dialog: "This will delete ALL cases, students, payments, appointments. Type CONFIRM to proceed."
- On confirm + correct password → execute purge queries: truncate cases, appointments, case_submissions, documents, profiles (non-admin), user_roles (non-admin)
- Log the purge in admin_audit_log

**5. No DB migrations needed** — all tables exist, all statuses valid.

### Pipeline Enforcement Logic (CaseDetailPage)

```text
STRICT_NEXT: {
  new              → contacted
  contacted        → appointment_scheduled
  appointment_scheduled → profile_completion  (via outcome modal only)
  profile_completion → payment_confirmed      (via PaymentConfirmationForm)
  payment_confirmed  → submitted              (via Submit to Admin)
  submitted          → enrollment_paid        (admin only)
}
```

The `updateStatus` function will validate: `new→contacted`, `contacted→appointment_scheduled` (only via scheduler modal), etc. No arbitrary jumps.

### Delete Functions

```text
Delete Case:
  - Confirmation dialog: "Delete this case? This cannot be undone."
  - Deletes: case row + appointments + case_submissions + documents
  - Navigate back to cases list

Delete Appointment:
  - Confirmation: "Delete this appointment?"
  - Sets appointment as deleted (or hard delete)
  - If no remaining appointments, case stays at appointment_scheduled with "Schedule new appointment" prompt
```

### Admin Submissions Enhancement

The detail dialog will show:

- Student name, phone, education info
- Program start/end, service fee, translation fee
- `extra_data` fields (DOB, address, passport, school, etc.)
- Documents section with download links
- Password re-auth gate before "Mark Enrolled"

### Data Reset (Admin Settings)

```text
Step 1: Click "Data Reset" tab
Step 2: Warning card — lists what will be deleted
Step 3: Type "RESET" in confirmation input  
Step 4: Enter admin password
Step 5: Execute purge — calls supabase deletes in sequence
Step 6: Success + redirect to dashboard
```

Purge sequence (order matters for FK constraints):

1. DELETE documents
2. DELETE appointments
3. DELETE case_submissions
4. DELETE cases
5. DELETE rewards, commissions, payout_requests
6. DELETE user_roles WHERE role != 'admin'
7. DELETE profiles WHERE id NOT IN (admin ids)

### Pipeline Progress Bar

Visual stepper at top of CaseDetailPage showing:
`New → Contacted → Appointment → Profile → Payment → Submitted → Enrolled`

Current stage highlighted, completed stages shown with checkmark.

### Summary of Files


| File                       | Changes                                          |
| -------------------------- | ------------------------------------------------ |
| `TeamCasesPage.tsx`        | Case creation starts at `new`, no mandatory appt |
| `CaseDetailPage.tsx`       | Delete buttons, pipeline guard, progress bar     |
| `AdminSubmissionsPage.tsx` | Full profile view, documents, password re-auth   |
| `AdminSettingsPage.tsx`    | Data reset tab with purge function               |
