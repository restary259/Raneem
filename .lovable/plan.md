

# Fix: "Complete Profile" Screen Freeze

## Root Cause

The freeze happens because of this guard at line 241 of `TeamDashboardPage.tsx`:

```
if (!authReady || isLoading) {
    return (loading skeleton);
}
```

**What happens step-by-step:**

1. Team member clicks "Complete Profile" -- the modal opens fine
2. They fill in all fields and click Save, then confirm
3. The case is updated in the database (status changes to `profile_filled`)
4. The realtime subscription on `student_cases` fires immediately
5. `refetch()` is called, which sets `isLoading = true`
6. The `if (isLoading)` guard kicks in, replacing the ENTIRE page (including the modal) with a loading skeleton
7. The skeleton flashes or appears stuck, and the modal disappears abruptly
8. When `isLoading` goes back to `false`, the page re-renders but the modal is gone and the filter tab may not have updated visually

This makes the screen appear "frozen" -- the user sees the skeleton flash or the modal vanish without a clear transition to the next step.

## Fix

**Change the loading guard to only show the skeleton on the INITIAL load**, not on subsequent refetches:

```typescript
// BEFORE (line 241):
if (!authReady || isLoading) {

// AFTER:
if (!authReady || (isLoading && !data)) {
```

This way:
- First page load: Shows loading skeleton (no data yet)
- Subsequent refetches (realtime, manual): Keeps existing UI visible while data refreshes in the background
- The modal stays open and closes gracefully after the update completes

## Files to Change

| File | Change |
|---|---|
| `src/pages/TeamDashboardPage.tsx` | Change loading guard from `isLoading` to `isLoading && !data` (1 line) |

## Safety

- Zero risk to business logic
- No database changes
- No commission/payment logic affected
- Fully reversible (revert one line)

