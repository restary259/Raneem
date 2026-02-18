
# Critical Error Handling & Stability Fix Plan

## Audit Summary

After reviewing all flagged files in detail, here is a precise breakdown of every real issue found and the exact fix required for each.

---

## Issues Confirmed & Prioritized

### 🔴 CRITICAL — Application-Crashing Bugs

#### Issue 1: `Promise.all()` Without Error Isolation
**Files:** `AdminDashboardPage.tsx` (L72), `EarningsPanel.tsx` (L41), `RewardsPanel.tsx` (L40), `ChecklistTracker.tsx` (L36), `InfluencerDashboardPage.tsx` (L49), `MajorsManagement.tsx` (L86)

**Problem:** If any single database query in a `Promise.all()` block fails (e.g., network hiccup, RLS rejection, timeout), the entire `await` rejects and the dashboard shows a blank screen or crashes silently. Currently there are zero `.catch()` handlers on individual promises.

**Fix:** Wrap every query in a safe wrapper so each resolves independently:
```typescript
// Safe helper to add to each file:
const safeQuery = (p: Promise<any>) => p.catch(err => ({ data: null, error: err }));

// Usage:
const [p, s, pay, ...] = await Promise.all([
  safeQuery((supabase as any).from('profiles').select('*')...),
  safeQuery((supabase as any).from('services').select('*')...),
  // ...
]);
// Then check individually: if (p.data) setStudents(p.data);
// Individual failures are logged but don't crash other data
```

#### Issue 2: `validate_influencer_ref` RPC Has No `.catch()` in `ApplyPage.tsx`
**File:** `src/pages/ApplyPage.tsx` (L79)

**Problem:** If `validate_influencer_ref` fails (bad UUID, network error), the promise rejects silently and the referral attribution is silently lost.

**Fix:** Add `.catch(console.error)` to the chain.

#### Issue 3: Checklist update has no error handling or rollback
**File:** `src/components/dashboard/ChecklistTracker.tsx` (L56-68)

**Problem:** `setConfirmItem(null)` clears the modal state BEFORE the database write completes. If the `update` or `insert` fails, the UI shows the item as toggled but the DB still has the old value. `fetchData()` at the end will re-sync but only if it succeeds too.

**Fix:** Add error check after each Supabase operation. Show a toast on failure. Move `setConfirmItem(null)` after confirming success.

#### Issue 4: `log_user_activity` Runs Before Checking Update Success
**File:** `src/pages/TeamDashboardPage.tsx` (L327-329)

**Problem:** 
```typescript
const { error } = await supabase.from('student_cases').update(...).eq('id', ...);
await supabase.rpc('log_user_activity', {...}); // runs even if error exists!
```
The audit log records a "success" even when the actual update failed.

**Fix:** Move `log_user_activity` inside the `else` block (only after confirming no error).

---

### 🟠 HIGH — Silent Failures & Missing Feedback

#### Issue 5: `null.toString()` Bug in Team Dashboard Required Fields Check
**File:** `src/pages/TeamDashboardPage.tsx` (L284)

**Problem:**
```typescript
const missingFields = requiredProfileFields.filter(f => !profileValues[f]?.toString().trim());
```
If `profileValues[f]` is `null`, then `null?.toString()` returns `undefined`, and `undefined.trim()` throws. The `?.` only protects the `.toString()` call, not the `.trim()` call after it.

Actually reviewing this more carefully: `null?.toString()` → `undefined`, then `undefined.trim()` would throw. But wait — `.trim()` is being called on `undefined` here. This IS a real bug. If `profileValues[f]` is the literal string `"null"` it would pass, but if it's a JS `null`, this will crash on `.trim()`.

**Fix:** Change to explicit truthiness check:
```typescript
const missingFields = requiredProfileFields.filter(f => {
  const val = profileValues[f];
  return !val || String(val).trim() === '' || String(val).trim() === 'null';
});
```

#### Issue 6: `fetchProfileSafely` Creates Profile But Doesn't Fetch It
**File:** `src/pages/StudentDashboardPage.tsx` (L85-88)

**Problem:** When `createUserProfile` is called (because no profile exists), the function returns without re-fetching the newly created profile. The student sees a blank/fallback UI indefinitely until they reload.

**Fix:** After `createUserProfile` completes, call `fetchProfileSafely` again once to load the newly created profile.

#### Issue 7: No Error Logging on `Promise.all()` Individual Failures in `AdminDashboardPage.tsx`
**File:** `src/pages/AdminDashboardPage.tsx` (L72-86)

**Problem:** `if (p.data) setStudents(p.data)` silently ignores `p.error` — if a fetch failed, state is never updated AND no one knows why.

**Fix:** After wrapping with `safeQuery`, log and optionally toast on errors:
```typescript
if (p.error) console.error('Profiles fetch failed:', p.error);
if (p.data) setStudents(p.data);
```

#### Issue 8: `getInfluencerName` in `LeadsManagement.tsx` Has No Guard on `influencers`
**File:** `src/components/admin/LeadsManagement.tsx` (L204-209)

**Problem:** The component receives `influencers = []` as a default prop, which is safe. However, if `influencers` is somehow `undefined` (e.g., parent passes `undefined`), the `.find()` will crash.

**Fix:** Add a double-safety guard: `(influencers ?? []).find(...)`.

#### Issue 9: `AdminOverview.tsx` — Props With `leads.forEach(...)` Without Guard
**File:** `src/components/admin/AdminOverview.tsx` (L61-79)

**Problem:** The component sets defaults (`leads = []`, `cases = []`) but the usage in the compute block calls `.forEach()` on them, which is safe since defaults are arrays. **This is actually safe** as-is. However the `onStageClick` prop is optional but passed as callback — that's fine. No fix needed here.

---

### 🟡 MEDIUM — Missing Fallbacks & UX Gaps

#### Issue 10: `MyApplicationTab.tsx` — No Guard on `studentCase`
**File:** `src/components/dashboard/MyApplicationTab.tsx` (L215)

**Problem:** `studentCase.selected_city` is accessed directly. The component's own data-fetch logic could result in `studentCase` being null during loading. 

**Fix:** Ensure `studentCase` guard is present before rendering the grid at L209. The file likely already has a guard earlier, but confirm the details grid renders only when `studentCase` is truthy.

#### Issue 11: `InfluencerDashboardPage.tsx` — Compute on Potentially Empty Array
**File:** `src/pages/InfluencerDashboardPage.tsx` (L91)

**Problem:** `leads.filter(l => (l.eligibility_score ?? 0) >= 50)` — the array defaults to `[]` from `useState([])`, so this is actually safe. Not a crash risk.

---

## Global Safety Net

Add a global `unhandledrejection` event handler in `App.tsx` to catch any promise rejections that escape all the above fixes:

```typescript
useEffect(() => {
  const handler = (event: PromiseRejectionEvent) => {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault();
  };
  window.addEventListener('unhandledrejection', handler);
  return () => window.removeEventListener('unhandledrejection', handler);
}, []);
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/AdminDashboardPage.tsx` | Wrap all 13 queries in `safeQuery()`, log individual errors |
| `src/components/influencer/EarningsPanel.tsx` | Wrap 4 queries in `safeQuery()`, add error logging |
| `src/components/dashboard/RewardsPanel.tsx` | Wrap 5 queries in `safeQuery()`, add error logging |
| `src/components/dashboard/ChecklistTracker.tsx` | Add error check + toast after each DB write, fix state order |
| `src/components/admin/MajorsManagement.tsx` | Wrap 2 queries in `safeQuery()` |
| `src/pages/InfluencerDashboardPage.tsx` | Wrap 2 queries in `safeQuery()` |
| `src/pages/TeamDashboardPage.tsx` | Fix `log_user_activity` ordering + `null.toString()` bug |
| `src/pages/StudentDashboardPage.tsx` | Fix profile re-fetch after `createUserProfile` |
| `src/pages/ApplyPage.tsx` | Add `.catch()` to `validate_influencer_ref` call |
| `src/components/admin/LeadsManagement.tsx` | Add `?? []` guard on `influencers` in `getInfluencerName` |
| `src/App.tsx` | Add global `unhandledrejection` handler |

---

## Technical Details

### The `safeQuery` Pattern
A tiny helper that ensures each database query resolves (not rejects), returning `{ data: null, error }` on failure:

```typescript
const safeQuery = <T>(promise: Promise<{ data: T | null; error: any }>) =>
  promise.catch((err) => ({ data: null as T | null, error: err }));
```

This is added inline in each `fetchData` function — no shared utility file needed, keeping changes self-contained.

### Checklist Fix — Optimistic Update With Rollback
```typescript
const handleConfirm = async () => {
  if (!confirmItem) return;
  const { id: itemId, completed: currentlyCompleted } = confirmItem;
  setConfirmItem(null); // Clear modal immediately for UX

  // Optimistic UI update
  const prevCompletions = completions;
  
  const existing = completions.find(c => c.checklist_item_id === itemId);
  let dbError = null;
  
  if (existing) {
    const { error } = await (supabase as any).from('student_checklist')
      .update({ is_completed: !currentlyCompleted, ... }).eq('id', existing.id);
    dbError = error;
  } else {
    const { error } = await (supabase as any).from('student_checklist')
      .insert({ ... });
    dbError = error;
  }

  if (dbError) {
    toast({ variant: 'destructive', title: 'Error', description: dbError.message });
    setCompletions(prevCompletions); // Rollback
    return;
  }
  
  await fetchData(); // Re-sync
};
```

### TeamDashboard Fix — Correct Audit Log Ordering
```typescript
const { error } = await supabase.from('student_cases').update(finalData).eq('id', profileCase.id);
setSavingProfile(false);
setCompleteFileConfirm(false);

if (error) {
  toast({ variant: 'destructive', title: t('common.error'), description: error.message });
} else {
  // Only log on success
  await supabase.rpc('log_user_activity', { p_action: 'profile_completed', ... });
  toast({ title: isAr ? 'تم إكمال الملف' : 'File completed' });
  // ... rest of success handling
}
```

### StudentDashboard Fix — Profile Re-fetch
```typescript
const fetchProfileSafely = async (userId: string) => {
  // ... existing code ...
  if (error?.code === 'PGRST116' || ...) {
    await createUserProfile(userId);
    // RE-FETCH after creation:
    await fetchProfileSafely(userId); // Second call will hit the `if (data)` branch
    return;
  }
  // ...
};
```
Note: A guard is needed to prevent infinite recursion — track a `isRetry` boolean parameter.
