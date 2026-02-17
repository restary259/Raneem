

# Full System Audit and Fixes

## Issues Detected

### 1. "Today's Appointments" Shows Wrong Count (CRITICAL - Visible in Screenshot)

**Root Cause:** The KPI counter at line 186 counts ALL appointments today regardless of status:
```
const todayAppts = appointments.filter(a => isToday(new Date(a.scheduled_at))).length;
```

The "Today's Appointments" summary on the Cases tab (line 433-437) filters by time-not-ended, but NOT by status. Neither filters out cancelled/completed appointments.

**Database Evidence:** There are 4 appointments for today (Feb 17). Three at 08:00 (already ended by duration) and one at 14:02. The screenshot shows "3" which means the KPI is counting expired ones too.

**Fix:** Filter both the KPI and today's summary to only count `status = 'scheduled'` appointments that haven't ended yet.

### 2. Duplicate Appointments for Same Case

**Database Evidence:** Case `74ebe0a8` has TWO appointments (IDs `2aab6fe9` and `6af55130`), both for "raneem dawahde". This inflates counters.

**Fix:** When creating a new appointment for a case that already has one, update the existing appointment instead of inserting a duplicate. Also add a cleanup query for existing duplicates.

### 3. Appointments Without Case Link (Orphaned)

**Database Evidence:** Appointment `4e28c141` (student "Yhshs") has `case_id = null`. This creates ghost data in analytics.

**Fix:** The appointment creation form should require a valid case_id. Existing orphaned appointments should be flagged.

### 4. Show Rate Calculation Incorrect

Line 197-199: `showRate` divides completed by (scheduled + completed). This includes ALL appointments ever, not just past ones. Future scheduled appointments shouldn't count as "no-shows".

**Fix:** Only count appointments where `scheduled_at` is in the past for show rate calculation.

### 5. Real-Time Subscriptions Already In Place (Verified OK)

Lines 128-132 already subscribe to `student_cases`, `appointments`, `leads`, `commissions`, and `payout_requests`. The `useRealtimeSubscription` hook also handles visibility-change refetch. This is working correctly.

### 6. Earnings Panel Missing Real-Time Refresh

The `EarningsPanel` component fetches data once on mount but has no real-time subscription. When a payment is processed, the earnings tab won't update until manual refresh.

**Fix:** Add `useRealtimeSubscription` for `rewards` and `payout_requests` tables inside `EarningsPanel`.

### 7. No Duplicate Payment Request Prevention

In `EarningsPanel` line 110-137, `submitPayoutRequest` doesn't check if a request is already in-flight. Double-clicking could create duplicate payout requests.

**Fix:** Add a `submitting` state guard and disable the button during submission.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/TeamDashboardPage.tsx` | 1. Fix `todayAppts` KPI to filter by `status === 'scheduled'` and not-ended. 2. Fix `todayAppointments` summary to also filter by `status === 'scheduled'`. 3. Fix `showRate` to only count past appointments. |
| `src/components/influencer/EarningsPanel.tsx` | 1. Add `useRealtimeSubscription` for `rewards` and `payout_requests`. 2. Add `submitting` guard to prevent duplicate payout requests. |
| `src/components/lawyer/AppointmentCalendar.tsx` | Add duplicate-prevention: when creating appointment for a case that already has one, update instead of insert. |
| Database cleanup (migration) | Remove duplicate appointments for same case. Flag orphaned appointments. |

---

## Technical Details

### KPI Fix (TeamDashboardPage.tsx lines 184-201)

```typescript
const todayAppts = appointments.filter(a => {
  if (!isToday(new Date(a.scheduled_at))) return false;
  if (a.status === 'cancelled' || a.status === 'deleted') return false;
  return true;
}).length;
```

And the todayAppointments filter (lines 433-437):
```typescript
const todayAppointments = appointments.filter(a => {
  if (!isToday(new Date(a.scheduled_at))) return false;
  if (a.status !== 'scheduled') return false;
  const end = new Date(new Date(a.scheduled_at).getTime() + (a.duration_minutes || 30) * 60000);
  return end > new Date();
});
```

### Show Rate Fix

```typescript
const pastAppts = appointments.filter(a => new Date(a.scheduled_at) < new Date());
const bookedPast = pastAppts.filter(a => a.status === 'scheduled' || a.status === 'completed').length;
const completedAppts = pastAppts.filter(a => a.status === 'completed').length;
const showRate = bookedPast > 0 ? Math.round((completedAppts / bookedPast) * 100) : 0;
```

### EarningsPanel Real-Time + Duplicate Guard

```typescript
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

// Inside component:
const [submitting, setSubmitting] = useState(false);
useRealtimeSubscription('rewards', fetchData, true);
useRealtimeSubscription('payout_requests', fetchData, true);

// In submitPayoutRequest:
if (submitting) return;
setSubmitting(true);
try { /* existing logic */ } finally { setSubmitting(false); }
```

### Appointment Duplicate Prevention (AppointmentCalendar)

Before inserting a new appointment, check if one already exists for the selected case_id. If yes, update it instead of creating a new one.

### Database Cleanup Migration

```sql
-- Remove duplicate appointments per case (keep the latest)
DELETE FROM appointments a
USING appointments b
WHERE a.case_id = b.case_id
  AND a.case_id IS NOT NULL
  AND a.created_at < b.created_at;
```

