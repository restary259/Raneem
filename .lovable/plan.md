
# Fix: Admin Dashboard Crash — "p.catch is not a function"

## Root Cause (Confirmed)

The `safeQuery` helper in `src/integrations/supabase/dataService.ts` is defined as:

```typescript
const safeQuery = (p: Promise<any>): Promise<{ data: any; error: any }> =>
  p.catch((err) => ({ data: null, error: err }));
```

This calls `.catch()` directly on the argument. The Supabase JS client's query builder returns a **PostgrestFilterBuilder** — a thenable object, not a native `Promise`. When you pass it directly to `safeQuery`, the `.catch()` call fails because it's not a real Promise method on that object.

The fix is to `await` each query builder inside `safeQuery` so it becomes a real resolved/rejected Promise first. The correct pattern is:

```typescript
const safeQuery = async (p: any): Promise<{ data: any; error: any }> => {
  try {
    const result = await p;
    return { data: result.data, error: result.error };
  } catch (err) {
    return { data: null, error: err };
  }
};
```

This works with every Supabase query builder chain because `await` forces the thenable to resolve.

## Secondary Issue: Admin Dashboard Never Sets authReady Properly

Looking at `AdminDashboardPage.tsx` line 29-57, the `init()` function calls:

```typescript
setIsAdmin(true);
setAuthReady(true);
```

Only AFTER the edge function responds. If the edge function call fails with a network error (the `catch` block), it navigates away — this is fine. But `useDashboardData` is mounted with `enabled: authReady` immediately. Since `authReady` starts `false`, the data hook won't fire until `authReady` becomes `true`. That part is correct.

The **crash** is entirely in `safeQuery`. Fixing it will restore the admin dashboard.

## Verification of Other Dashboards

- **Team dashboard** (`getTeamDashboard`): Same `safeQuery` calls — will also crash for team members trying to log in.
- **Influencer dashboard** (`getInfluencerDashboard`): Same pattern — will also crash.
- All three dashboards share the broken `safeQuery`.

## What Changes

### 1. Fix `safeQuery` in `src/integrations/supabase/dataService.ts`

Replace the one-liner `.catch()` approach with an `async/try/catch` wrapper that properly awaits the Supabase query builder:

```typescript
// BEFORE (broken):
const safeQuery = (p: Promise<any>): Promise<{ data: any; error: any }> =>
  p.catch((err) => ({ data: null, error: err }));

// AFTER (correct):
const safeQuery = async (p: any): Promise<{ data: any; error: any }> => {
  try {
    const result = await p;
    return { data: result.data ?? null, error: result.error ?? null };
  } catch (err) {
    return { data: null, error: err };
  }
};
```

This is the **only change needed**. All existing calls to `safeQuery(...)` throughout the file are already passing Supabase query builder chains — they just need to be properly awaited instead of having `.catch()` called on them.

## What Does NOT Change

- No database migrations
- No RLS policy changes
- No other files — the fix is contained entirely within the `safeQuery` helper
- All existing query logic, column selectors, and data transformations remain the same

## Expected Outcome

1. Admin dashboard loads without the `p.catch is not a function` crash
2. Team dashboard loads correctly for lawyers
3. Influencer dashboard loads correctly for influencers
4. All real-time subscriptions continue to work (they call `refetch` which calls `safeQuery` again after the fix)
5. No regressions — the `safeQuery` signature change is fully backward-compatible since all callers pass Supabase query builders
