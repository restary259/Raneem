
# Team Dashboard — Workflow & Tab Routing Fix

## Root Cause Analysis

The current case "Tsukuyomi" has `case_status: 'assigned'` (set by admin upon assignment). The `matchesFilter` function maps `'assigned'` to the `appointment_stage` filter — not the `new` tab. This is why the case appears under "مرحلة الموعد" (Appointment) instead of "جديد" (New).

## Problems to Fix

### Problem 1 — Wrong Tab Routing for Newly Assigned Cases
**File**: `src/pages/TeamDashboardPage.tsx`, line 88

Current:
```
appointment_stage → ['assigned', 'appointment_scheduled', 'appointment_waiting', 'appointment_completed']
new → ['new', 'eligible']
```

Correct:
```
new → ['new', 'eligible', 'assigned']   ← assigned = brand-new unworked case
appointment_stage → ['appointment_scheduled', 'appointment_waiting', 'appointment_completed']
```

**Why safe**: `'assigned'` is the status set by admin when a case is first assigned. It has no prior team-member action. It logically belongs in "New" because the team member hasn't done anything yet. This also aligns with `renderCaseActions` which already handles `'assigned'` in the "New" block (line 498: `['new', 'eligible', 'assigned']`).

---

### Problem 2 — Reassign Missing from Appointment Stage

Current `renderCaseActions` for appointment stage (line 528–551) shows: Call, Complete Profile, Reschedule, Delete. **Reassign is missing** — it only appears in the fallback "submitted/paid" case at line 566.

**Fix**: Add Reassign button to the appointment stage action group, alongside the existing buttons.

---

### Problem 3 — `getNeonBorder` Maps `'assigned'` to Appointment Color

Line 65: `['appointment_scheduled', 'appointment_waiting', 'appointment_completed', 'assigned']` uses the appointment neon border color.

Fix: Move `'assigned'` to the `new` neon border group.

---

## What the Correct Flow Will Look Like

```
Admin assigns case → case_status = 'assigned'
   ↓ appears in "New" tab (جديد)
   Actions: [Call] + [Mark as Contacted] + [Delete]

Team member calls + marks contacted → case_status = 'contacted'
   ↓ appears in "Contacted" tab (تم التواصل)
   Actions: [Call] + [Make Appointment]

Appointment created → case_status = 'appointment_scheduled'
   ↓ appears in "Appointment Stage" tab (مرحلة الموعد)
   Actions: [Call] + [Complete Profile] + [Reschedule] + [Delete] + [Reassign]

Profile completed → case_status = 'profile_filled'
   ↓ appears in "Completed Files" tab (ملفات مكتملة)
   Actions: [Call] + [Submit for Application]

Submitted → case_status = 'paid' / 'ready_to_apply'
   ↓ appears in "Submitted" tab (تم الإرسال للمسؤول)
```

---

## Safety Assessment

| Change | Risk | Mitigation |
|---|---|---|
| Moving `'assigned'` to `new` in `matchesFilter` | **Zero** — display-only change, no DB writes | No state mutation |
| Moving `'assigned'` to `new` in `getNeonBorder` | **Zero** — visual only | No logic change |
| Adding Reassign to appointment stage | **Low** — reuses existing `handleReassignCase` | Same validated handler, only registered lawyers in dropdown |
| Reassign restricted to registered team members | **Already implemented** — `allLawyers` populated from `user_roles` table with `role = 'lawyer'` | No change needed |

---

## Files to Change

Only **one file** changes: `src/pages/TeamDashboardPage.tsx`

### Specific line changes:

**1. `matchesFilter` function (line 84–92)**
- Move `'assigned'` from `appointment_stage` to `new`

**2. `getNeonBorder` function (line 62–69)**
- Move `'assigned'` from `appointment_stage` color group to `new` color group

**3. `renderCaseActions` appointment stage block (line 528–551)**
- Add Reassign button alongside existing Call, Complete Profile, Reschedule, Delete buttons

No database changes needed. No RLS changes needed. No new components needed.
