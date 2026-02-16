

# Deterministic Case Status Machine + Auto-Advancing Workflow

## Overview

Implement a strict finite-state machine for case statuses that replaces free-form dropdowns with guided "Next Step" actions. Statuses auto-advance when conditions are met (e.g., appointment attended, profile saved, payment recorded). This eliminates manual status management and ensures data integrity across all dashboards.

## New Status Flow (13 stages)

```text
NEW --> ELIGIBLE --> ASSIGNED --> CONTACTED --> APPT_SCHEDULED --> APPT_WAITING (loop)
                                                    |
                                              APPT_COMPLETED --> PROFILE_FILLED --> SERVICES_FILLED
                                                                                        |
                                                                   PAID --> READY_TO_APPLY --> VISA_STAGE --> COMPLETED
```

Key rules:
- Forward-only transitions (no backward jumps from UI)
- Auto-advance on events (appointment attended, profile saved, services attached, payment recorded)
- Admin override with audit reason for exceptional rollbacks

---

## Files to Create

### 1. `src/lib/caseStatus.ts` -- Status enum
Define the canonical `CaseStatus` enum with all 13 stages, plus display labels and color mappings.

### 2. `src/lib/caseTransitions.ts` -- Transition rules
- `ALLOWED_TRANSITIONS` map defining which statuses can follow which
- `canTransition(current, next)` validator function
- `getNextSteps(current)` helper returning allowed next statuses
- Legacy status mapping (old statuses like `appointment`, `settled` mapped to nearest new equivalent)

### 3. `src/components/admin/NextStepButton.tsx` -- UI component
- Renders a primary "Mark as [next status]" button
- If multiple next states allowed, shows a small dropdown
- Calls Supabase update with transition validation
- Shows toast on success/failure
- Disabled state with tooltip when no transitions available

---

## Files to Modify

### 4. `src/pages/TeamDashboardPage.tsx`
- **Replace** the free-form status `<Select>` dropdown (line 374-377) with `<NextStepButton>`
- **Auto-advance on "Mark Contacted"**: already does this (line 207), keep it
- **Auto-advance on appointment attended**: when marking an appointment as attended in the calendar, also update case status to `appointment_completed` if transition is valid
- **Add progress indicator**: replace status badge with a compact horizontal step indicator showing current position in the 13-stage funnel
- **Profile modal save**: after saving profile fields, auto-advance to `profile_filled` if all required fields are present

### 5. `src/components/admin/CasesManagement.tsx`
- **Replace** status dropdown (lines 377-381) with `<NextStepButton>`
- **Make financial fields read-only** (lines 383-389): display them as text, not inputs. Financials are calculated from attached service snapshots only
- **Remove** manual number inputs for `service_fee`, `influencer_commission`, `lawyer_commission`, etc. from the edit form
- **Auto-advance on "Attach Services"**: after attaching services, auto-set status to `services_filled` if transition valid
- **Auto-advance on payment**: when status moves to `paid`, auto-set `paid_at` (already happens) and show "Submit for Ready to Apply" as the next step
- **Add "Ready to Apply" filter toggle**: a button/chip at the top to filter cases where `case_status === 'ready_to_apply'` (replaces the old separate ReadyToApplyTable tab)

### 6. `src/components/lawyer/AppointmentCalendar.tsx`
- When an appointment status is changed to "completed"/"attended", trigger auto-advance of the linked case to `appointment_completed` (using `canTransition` check)

### 7. `src/components/admin/StudentManagement.tsx`
- Add inline gating: show completion indicators for profile fields and services
- "Submit for Ready to Apply" button disabled until `profileComplete && servicesAttached && caseStatus === 'paid'`
- Tooltip explaining missing prerequisites when button is disabled

### 8. `src/components/admin/FunnelVisualization.tsx`
- Update funnel stages to include the new 13-stage model
- Group stages into visual phases for the funnel chart: Intake (new, eligible), Assignment (assigned, contacted), Appointment (scheduled, waiting, completed), Preparation (profile, services), Payment (paid), Application (ready, visa, completed)

---

## Auto-Advance Logic Summary

| Event | Triggers Status Change To |
|-------|--------------------------|
| Admin assigns case | `assigned` |
| Team clicks "Mark Contacted" | `contacted` |
| Team creates appointment for case | `appointment_scheduled` |
| Appointment marked attended | `appointment_completed` |
| Profile modal saved (all fields filled) | `profile_filled` |
| Services attached to case | `services_filled` |
| Payment recorded | `paid` |
| Team clicks "Submit for Ready" | `ready_to_apply` |
| Admin advances to visa | `visa_stage` |
| Admin marks complete | `completed` |

Each auto-advance checks `canTransition()` before updating -- if the case is already past that stage, no change occurs.

---

## Technical Details

### Transition Validation Pattern
```text
// Used in every status update handler:
1. Get current case status from state/DB
2. Call canTransition(current, targetStatus)
3. If false: show toast "Cannot skip to [status]" and abort
4. If true: update DB, show success toast, trigger refetch
```

### NextStepButton Component API
```text
Props:
  - caseId: string
  - currentStatus: CaseStatus
  - onStatusUpdated: (newStatus) => void

Renders:
  - Primary button: "Mark as [first allowed next status]"
  - Optional dropdown: additional allowed transitions
  - Disabled state when currentStatus === 'completed'
```

### Financial Fields (Read-Only)
In CasesManagement edit mode, financial fields will display as styled text boxes (not inputs). The values are auto-calculated from `case_service_snapshots`. The only way to change financials is to attach/remove services.

### No Database Changes Required
All 13 statuses are stored as plain strings in the existing `case_status` text column. No schema migration needed. The state machine is enforced purely in the frontend (with a recommendation to mirror server-side later).

### Localization
Add status labels for the 5 new statuses (`appointment_scheduled`, `appointment_waiting`, `appointment_completed`, `profile_filled`, `services_filled`) to both `en/dashboard.json` and `ar/dashboard.json`.

