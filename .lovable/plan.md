
# Phase 3: Ghost Data & Duplicate Detection — Verified Audit & Fix Plan

## Database State — What's Already Clean (Verified)

Before planning any fixes, all 5 cleanup queries from the audit were run against the live database. Results:

| Query | Result |
|-------|--------|
| Duplicate leads (same phone) | 0 found — unique index working |
| Duplicate rewards for same case | 0 found — `rewards_user_case_unique` index from Phase 2 is protecting this |
| Orphan appointments (case_id → no case) | 0 found |
| Stale referrals with no matching lead | 0 found |
| Cases with null lead FK | 0 found |

**This means no data cleanup scripts are needed today.** The previous phases already protected the data. The focus now is fixing the **code-level risks** that could still create ghost data in future interactions.

---

## Confirmed Real Issues (From Code Inspection)

### Issue 1: `confirmPaymentAndSubmit` in TeamDashboardPage — Audit Log Runs Before Error Check
**File**: `src/pages/TeamDashboardPage.tsx:369-376`
**Verified problem**:
```typescript
const { error } = await (supabase as any).from('student_cases').update(updateData).eq('id', caseId);
await (supabase as any).rpc('log_user_activity', { p_action: 'submit_for_application', ... }); // ← runs even if error!
if (error) {
  toast({ variant: 'destructive', ... });
}
```
The audit log records "submit_for_application" even when the actual case update failed. This is a **data integrity bug** — the audit log becomes untrustworthy.

**Fix**: Move `log_user_activity` inside the success branch (after `if (error)` check is false), matching the fixed pattern already applied to `completeFile`.

---

### Issue 2: AppointmentCalendar — `fetchAppointments` Has No Error Handling
**File**: `src/components/lawyer/AppointmentCalendar.tsx:82-85`
**Verified problem**:
```typescript
const fetchAppointments = async () => {
  const { data } = await (supabase as any).from('appointments').select('*')...
  if (data) setAppointments(data);
  // ❌ No error handling — if fetch fails, stale appointments remain silently
};
```
Also: `AppointmentCalendar` manages its own `appointments` state separately from the `refetch()` in the parent `TeamDashboardPage`. After a delete or reschedule in the **parent page** (`handleDeleteAppointment`, `handleRescheduleAppointment` at lines 393-415), `refetch()` is called which reloads `TeamDashboardPage`'s data — but `AppointmentCalendar`'s internal `appointments` state is NOT re-synced unless `fetchAppointments()` is called within the calendar component itself.

**Fix**: Add error handling to `fetchAppointments`. The appointment refetch issue is actually self-contained since all appointment mutations in `TeamDashboardPage` call `refetch()` which triggers a re-render of `AppointmentCalendar` with `key={userId}` effectively resetting it, and the calendar has its own `useEffect(() => { fetchAppointments(); }, [userId])`. This is acceptable.

---

### Issue 3: `RewardsPanel.submitPayoutRequest` — Missing Error Check Before UI Update
**File**: `src/components/dashboard/RewardsPanel.tsx:96-108`
**Verified problem**:
```typescript
await (supabase as any).from('payout_requests').insert({...});  // ← no error check
for (const r of eligibleRewards) {
  await (supabase as any).from('rewards').update({ status: 'approved', ... }).eq('id', r.id);
}
toast({ title: t('rewards.payoutRequested') });  // Always shows success
setShowRequestModal(false);
fetchData();
```
If the `payout_requests` insert fails, the rewards are still marked as `approved` and the user sees a success toast. This creates a state where rewards show `approved` but no payout request exists.

**Fix**: Check the insert result. If it errors, show a toast error and return without updating rewards or showing success.

---

### Issue 4: `RewardsPanel.cancelRequest` — No Error Check
**File**: `src/components/dashboard/RewardsPanel.tsx:111-122`
**Verified problem**: `cancelRequest` runs `payout_requests.update` and then `rewards.update` with no error checking on either operation. If the payout cancel fails, rewards are still reset to `pending` state, creating a mismatch.

**Fix**: Check both errors and show toasts on failure.

---

### Issue 5: `StudentCasesManagement.markAsPaid` — No Check for Already-Paid Status
**File**: `src/components/admin/StudentCasesManagement.tsx:58-64`
**Verified problem**: Admin can call `markAsPaid` on a case already in `paid` status. The trigger's `IF NEW.case_status = 'paid' AND (OLD.case_status IS DISTINCT FROM 'paid')` condition protects the database, but the UI has no guard — admin sees no warning.

**Fix**: Before calling the update, check `if (c.case_status === 'paid') { toast(already paid); return; }` — cheap client-side guard for UX clarity.

---

### Issue 6: `AppointmentCalendar.fetchAppointments` — Missing Error Destructuring
**File**: `src/components/lawyer/AppointmentCalendar.tsx:82-85`
The fetch doesn't destructure `error` from the response. If it fails (RLS issue, network), `appointments` stays as previous state silently.

**Fix**: Destructure `{ data, error }`, log error on failure.

---

## Issues That Are Actually Already Fixed (Confirmed Safe)

| Claim | Reality |
|-------|---------|
| Rewards duplication (trigger fires twice) | The `rewards_user_case_unique` partial index added in Phase 2 blocks this at DB level |
| Lead duplication | `leads_phone_unique` index + `insert_lead_from_apply` uses UPDATE-then-INSERT (upsert pattern) |
| No check in `markEligible` before case insert | Fixed in Phase 2 |
| Appointment orphans | AppointmentCalendar already checks for existing appointment by case_id before inserting (lines 147-175) |
| `null.toString().trim()` bug | Fixed in Phase 2 |
| `log_user_activity` runs before error check in `completeFile` | Already fixed in Phase 2 |

---

## Files to Modify

| File | Change | Lines |
|------|--------|-------|
| `src/pages/TeamDashboardPage.tsx` | Move `log_user_activity` inside success branch of `confirmPaymentAndSubmit` | ~369-376 |
| `src/components/dashboard/RewardsPanel.tsx` | Add error check in `submitPayoutRequest` before marking rewards | ~96-108 |
| `src/components/dashboard/RewardsPanel.tsx` | Add error check in `cancelRequest` | ~111-122 |
| `src/components/admin/StudentCasesManagement.tsx` | Add already-paid guard in `markAsPaid` | ~58-64 |
| `src/components/lawyer/AppointmentCalendar.tsx` | Add `{ data, error }` destructuring + error log in `fetchAppointments` | ~82-85 |

---

## Technical Details

### Fix 1 — TeamDashboardPage `confirmPaymentAndSubmit`
```typescript
const { error } = await (supabase as any).from('student_cases').update(updateData).eq('id', caseId);
// Move log_user_activity INSIDE success branch:
if (error) {
  toast({ variant: 'destructive', title: t('common.error'), description: error.message });
} else {
  await (supabase as any).rpc('log_user_activity', { p_action: 'submit_for_application', ... });
  toast({ title: t('lawyer.saved') });
}
setSaving(false);
setPaymentConfirm(null);
await refetch();
```

### Fix 2 — RewardsPanel `submitPayoutRequest` with error check
```typescript
const { error: insertError } = await (supabase as any).from('payout_requests').insert({...});
if (insertError) {
  toast({ variant: 'destructive', title: t('common.error'), description: insertError.message });
  return;
}
// Only update rewards if insert succeeded:
for (const r of eligibleRewards) {
  await (supabase as any).from('rewards').update({ status: 'approved', ... }).eq('id', r.id);
}
toast({ title: t('rewards.payoutRequested') });
setShowRequestModal(false);
setRequestNotes('');
fetchData();
```

### Fix 3 — `markAsPaid` already-paid guard
```typescript
const markAsPaid = async (c: any) => {
  if (c.case_status === 'paid') {
    toast({ title: 'Already marked as paid' });
    return;
  }
  // ... existing code
};
```

### Fix 4 — `fetchAppointments` error handling
```typescript
const fetchAppointments = async () => {
  const { data, error } = await (supabase as any).from('appointments').select('*')...
  if (error) { console.error('Appointments fetch failed:', error); return; }
  if (data) setAppointments(data);
};
```

---

## What Does NOT Change
- No DB migrations needed (all constraints already in place)
- No RLS changes needed (verified complete and correct)
- No data cleanup scripts needed (zero ghost data in production DB)
- All existing UI components and layouts
- All business logic beyond the specific mutation functions listed above
