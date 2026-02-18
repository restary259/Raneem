
# Fix: Admin Dashboard Flickering (AbortError Race Condition)

## Confirmed Root Causes

There are three compounding bugs causing the flicker loop on desktop:

### Bug 1: Unstable `onError` callback recreates `refetch` on every render (PRIMARY)

In `AdminDashboardPage.tsx`, the `onError` prop passed to `useDashboardData` is an **inline arrow function**:

```typescript
onError: (err) => toast({ variant: 'destructive', title: 'خطأ في التحميل', description: err }),
```

Every time the component re-renders, a new function reference is created. Inside `useDashboardData`, `refetch` is a `useCallback` that depends on `onError`. So:

```
new render → new onError ref → new refetch ref → useEffect([refetch]) fires → new fetch starts → previous fetch gets ABORTED → AbortError → component updates → new render → loop
```

This is exactly what the console shows: every single query firing `AbortError: signal is aborted without reason` repeatedly.

### Bug 2: No concurrent fetch guard in `useDashboardData`

When `refetch` is recreated mid-fetch, the new call starts a fresh `Promise.all` in `getAdminDashboard()` while the old one is still running. Supabase internally aborts the stalled requests, producing the flood of AbortErrors.

### Bug 3: React StrictMode double-execution

In development, React 18 StrictMode runs every `useEffect` twice. Without a `useRef` guard, the initial fetch fires twice even before the auth race begins.

---

## What Changes

### 1. `src/hooks/useDashboardData.ts`

- Store `onError` in a `useRef` so changes to the callback reference **do not** recreate `refetch`. The ref always points to the latest version of the callback without being a dependency.
- Add an `isFetchingRef` guard so concurrent calls to `refetch` are skipped if one is already running — this eliminates the AbortError flood.

```typescript
// Store callback in ref — changes to it don't recreate refetch
const onErrorRef = useRef(onError);
useEffect(() => { onErrorRef.current = onError; });

// Guard against concurrent fetches
const isFetchingRef = useRef(false);

const refetch = useCallback(async () => {
  if (!enabled) return;
  if (isFetchingRef.current) return; // already in-flight, skip
  isFetchingRef.current = true;
  setIsLoading(true);
  // ... fetch logic using onErrorRef.current instead of onError
  isFetchingRef.current = false;
  setIsLoading(false);
}, [type, userId, enabled]); // onError no longer in deps
```

### 2. `src/pages/AdminDashboardPage.tsx`

- Add a stable `sessionReady` state that only becomes `true` once auth is fully resolved. This replaces the combined `authReady && isAdmin` check.
- Add a `hasFetchedRef` to prevent double execution under React StrictMode.
- Keep the `onError` callback stable using `useCallback` so it doesn't recreate `refetch`.
- Show a single, stable loading screen until `sessionReady` is true — no more flicker between "checking permissions" and "loading data" states.

```typescript
const [sessionReady, setSessionReady] = useState(false);
const hasFetchedRef = useRef(false);

const onError = useCallback((err: string) => {
  toast({ variant: 'destructive', title: 'خطأ في التحميل', description: err });
}, [toast]);

useEffect(() => {
  if (hasFetchedRef.current) return;
  hasFetchedRef.current = true;

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { navigate('/student-auth'); return; }
    setUser(session.user);
    // ... admin-verify call ...
    setIsAdmin(true);
    setSessionReady(true); // only now is it safe to fetch data
  };
  init();
}, []); // empty deps — runs once, protected by ref

// useDashboardData is gated on sessionReady
const { data, error, isLoading, refetch } = useDashboardData({
  type: 'admin',
  enabled: sessionReady,
  onError,
});

// Single loading gate — show spinner until fully ready
if (!sessionReady) return <FullScreenLoader message="جاري التحقق من الصلاحيات…" />;
```

### 3. `src/integrations/supabase/dataService.ts`

- Silently ignore `AbortError` (treat as a no-op, not a real failure). If the request was aborted because a component unmounted or a newer fetch started, there is nothing to display — logging it as an error and propagating it causes unnecessary toasts and re-renders.

```typescript
const safeQuery = async (p: any): Promise<{ data: any; error: any }> => {
  try {
    const result = await p;
    return { data: result.data ?? null, error: result.error ?? null };
  } catch (err: any) {
    // Silently ignore aborted requests — not a real error
    if (err?.name === 'AbortError') return { data: null, error: null };
    return { data: null, error: err };
  }
};
```

---

## Files Changed

| File | What Changes |
|---|---|
| `src/hooks/useDashboardData.ts` | Store `onError` in ref, add `isFetchingRef` concurrent guard |
| `src/pages/AdminDashboardPage.tsx` | Add `sessionReady` state, `hasFetchedRef`, memoize `onError` with `useCallback` |
| `src/integrations/supabase/dataService.ts` | Silently swallow `AbortError` in `safeQuery` |

---

## Expected Outcome

After this fix:
- ONE session fetch on login
- ONE dashboard data fetch, no repeats
- No AbortErrors in console
- No spinner flicker — stable loading screen until auth + data are both ready
- StrictMode safe in development
- Real-time subscriptions continue to work correctly (they call `refetch` which now has a concurrency guard)
