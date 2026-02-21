
# Debug Report: Team Dashboard "Complete Profile" Freeze Fix

## Root Cause Analysis

The freeze occurs when `confirmCompleteFile()` encounters an unhandled exception. The function (line 422) performs a Supabase update followed by an RPC call, but has **no try-catch**. If either call throws (network timeout, AbortError from concurrent refetches), the cleanup code never runs:

- `setSavingProfile(false)` -- never called, so the button stays disabled
- `setCompleteFileConfirm(false)` -- never called, so the AlertDialog stays open and blocks all interaction
- The user sees a "frozen" screen with no way to dismiss the dialog

Contributing factors:
1. **Six realtime subscriptions** all trigger `refetch()` when the case updates. The case update triggers `auto_split_payment` and `notify_case_status_change` DB triggers, which touch additional tables. This creates a burst of 3-4 debounced refetch calls within 300ms, increasing the chance of AbortErrors.
2. **Other async handlers** (`handleMarkContacted`, `confirmPaymentAndSubmit`, `handleReassign`) also lack try-catch wrappers, making them vulnerable to the same freeze.

## Fix Plan

### 1. Wrap all async action handlers in try-catch (TeamDashboardPage.tsx)

Add try-catch-finally blocks to every async handler that sets loading states:

- `confirmCompleteFile` (line 422) -- **primary freeze source**
- `saveProfileCompletion` (line 357) -- already partially guarded but can still throw
- `handleMarkContacted` (line 252)
- `confirmPaymentAndSubmit` (line 465)
- `handleDeleteCase` (line 499)
- `handleReassign` (line ~530)
- `handleCreateAppointmentInline` (line 275)
- `handleRescheduleAppointment` and `handleDeleteAppointment`

Pattern for each:

```typescript
const confirmCompleteFile = async () => {
  if (!profileCase || !pendingUpdateData) return;
  setSavingProfile(true);
  try {
    // ... existing logic ...
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      toast({ variant: 'destructive', title: t('common.error'), description: err?.message || 'Unexpected error' });
    }
  } finally {
    setSavingProfile(false);
    setCompleteFileConfirm(false);
    setPendingUpdateData(null);
  }
};
```

### 2. Reduce realtime subscription noise

Currently 6 subscriptions each debounce at 300ms independently. When a case update triggers changes across multiple tables, up to 6 refetch calls queue up within a short window.

Fix: Remove redundant subscriptions. The team dashboard only needs to subscribe to:
- `student_cases` (primary data)
- `appointments` (scheduling)
- `leads` (contact status)

Remove subscriptions to `commissions`, `payout_requests`, and `rewards` -- team members do not see these on their dashboard and they only add noise.

### 3. Add error boundary to confirmation dialogs

Ensure the `AlertDialog` for "Complete File Confirmation" resets state if it closes for any reason:

```typescript
<AlertDialog
  open={completeFileConfirm}
  onOpenChange={(open) => {
    if (!open) {
      setSavingProfile(false); // Always reset
      cancelCompleteFile();
    }
  }}
>
```

### 4. Guard `refetch` after mutations

Wrap the `await refetch()` calls inside the action handlers with a safety net so a failed refetch does not cascade:

```typescript
// Safe refetch - swallow errors since realtime will sync anyway
try { await refetch(); } catch {}
```

## Files to Change

- `src/pages/TeamDashboardPage.tsx` -- All the fixes above (try-catch wrappers, subscription cleanup, dialog state guards)

## Verification Checklist

After fixes:
- Open a case in "appointment_scheduled" status, fill all fields, click Save, confirm -- should complete without freeze
- Simulate a network error (offline toggle) during save -- dialog should close gracefully with error toast
- Check all tabs (Cases, Today, Appointments, Analytics) load without lag
- Verify realtime updates still sync when data changes in another tab/browser
