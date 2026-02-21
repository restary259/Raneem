

# Remove Today's Appointments from Appointments Tab, Inline Scheduling Modal, and Data Consistency

## Overview

Three changes:
1. Remove the "Today's Appointments" summary card from the Appointments tab (since the dedicated "Today" tab already covers this)
2. Replace the "Make Appointment" button redirect with an inline scheduling dialog that opens on the Cases tab
3. Ensure delete and reschedule operations trigger a full data refetch so all tabs stay consistent

---

## 1. Remove Today's Appointments from Appointments Tab

**File: `src/pages/TeamDashboardPage.tsx`** (lines 893-950)

Remove the `todayAppointments` summary card block (lines 895-948) from inside `{activeTab === 'appointments' && ...}`. Keep only the `AppointmentCalendar` component.

The Appointments tab will become:
```
{activeTab === 'appointments' && (
  <div className="space-y-4">
    {user && <AppointmentCalendar userId={user.id} cases={cases} leads={leads} onAppointmentChange={refetch} />}
  </div>
)}
```

---

## 2. Inline "Schedule Appointment" Dialog on Cases Tab

**File: `src/pages/TeamDashboardPage.tsx`**

### New state variables:
- `scheduleForCase` (any | null) -- holds the case for which we're scheduling
- `scheduleDate` (string), `scheduleTime` (string, default '10:00'), `scheduleDuration` (number, default 30), `scheduleLocation` (string), `scheduleNotes` (string)

### Update `handleMakeAppointment` (line 257-261):
Instead of switching to the Appointments tab, open the inline scheduling dialog:
```typescript
const handleMakeAppointment = (caseId: string) => {
  const c = cases.find(cs => cs.id === caseId);
  const lead = c ? getLeadInfo(c.lead_id) : null;
  setScheduleForCase(c);
  setScheduleDate(format(new Date(), 'yyyy-MM-dd'));
  setScheduleTime('10:00');
  setScheduleDuration(30);
  setScheduleLocation('');
  setScheduleNotes('');
};
```

### New function `handleCreateAppointmentInline`:
- Insert appointment into the `appointments` table
- Auto-advance case status to `appointment_scheduled` if transition is valid (same logic as AppointmentCalendar)
- Call `refetch()` to update all tabs
- Close dialog

### New Dialog (added after the existing Reschedule Dialog):
A small Dialog with fields: Date, Time, Duration, Location, Notes. The student name is auto-filled from the linked case/lead. Similar to the AppointmentCalendar create dialog but self-contained.

---

## 3. Data Consistency: Delete and Reschedule Sync

The existing `handleDeleteAppointment` (line 439-447) and `handleRescheduleAppointment` (line 449-462) already call `await refetch()` after mutation, which refreshes all data (cases, leads, appointments) from the centralized data layer. This is correct.

However, the `AppointmentCalendar` component has its own local `appointments` state and its own `fetchAppointments` function. When a delete or reschedule happens from the Today tab (via the parent), the calendar's local state won't update.

### Fix: Add `onAppointmentChange` callback prop to `AppointmentCalendar`

**File: `src/components/lawyer/AppointmentCalendar.tsx`**

- Add `onAppointmentChange?: () => void` to `AppointmentCalendarProps`
- After `handleCreate` and `handleDelete` succeed, call `onAppointmentChange?.()` in addition to `fetchAppointments()`
- This way, when an appointment is created/deleted from the calendar, the parent's `refetch()` is called, keeping the Today tab and Cases tab in sync

**File: `src/pages/TeamDashboardPage.tsx`**

- Pass `onAppointmentChange={refetch}` to `AppointmentCalendar`

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `src/pages/TeamDashboardPage.tsx` | Remove today summary from appointments tab; add inline schedule dialog state + handler + UI; pass `onAppointmentChange` to calendar |
| `src/components/lawyer/AppointmentCalendar.tsx` | Add `onAppointmentChange` prop; call it after create/delete |

### No Regression Risk:
- No changes to case status flow, financial logic, or RLS
- Influencer/commission logic untouched
- Real-time subscriptions unchanged -- `refetch()` already covers consistency

