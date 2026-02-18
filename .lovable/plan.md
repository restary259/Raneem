
# Unified Data Access Layer — Implementation Plan

## Assessment of Current State

The previous audit fixes already applied `safeQuery` isolation to all `Promise.all()` calls. The dashboards are now crash-safe. This plan focuses on the next level: creating a **centralized data service and shared hook** so all dashboards share one reliable, consistent data-fetching pattern — eliminating duplicate code, inconsistent error states, and scattered subscription logic.

---

## What Will Be Built

### 1. `src/integrations/supabase/dataService.ts` (NEW FILE)
A centralized module with typed fetch functions for each dashboard type.

**Functions:**
- `getInfluencerDashboard(userId)` — Fetches leads (filtered by `source_id`), student cases, and profile in parallel. Returns `{ leads, cases, profile }`.
- `getTeamDashboard(userId)` — Fetches assigned cases, appointments, then derives leads from case `lead_id` list. Returns `{ cases, leads, appointments, profile }`.
- `getAdminDashboard()` — Fetches all 13 tables in parallel with `safeQuery` on each. Returns the full admin state shape.

Each function:
- Uses `safeQuery` isolation on every individual promise
- Logs errors to console with descriptive labels
- Returns safe fallbacks (`[]` or `null`) on failure — never throws
- Returns a typed `{ data, error }` result

### 2. `src/hooks/useDashboardData.ts` (NEW FILE)
A single hook that wraps the data service with React state management.

**Features:**
- Accepts `{ userId, type: 'influencer' | 'team' | 'admin', onError? }`
- Manages `isLoading`, `error`, and `data` state
- Exposes a stable `refetch` callback (via `useCallback`)
- Can be connected to existing `useRealtimeSubscription` calls
- Prevents stale closure issues via `useCallback` dependency on `userId` and `type`

### 3. `src/components/dashboard/DashboardContainer.tsx` (NEW FILE)
A reusable wrapper component that handles the three universal states:
- **Loading** — centered spinner with "Loading..." text
- **Error** — card with error message and "Try Again" button that calls `onRetry`
- **Empty** — configurable message and icon
- **Content** — renders `children` when data is ready

This replaces the repeated `if (isLoading) return <spinner>` blocks in each dashboard page.

### 4. Update `src/pages/InfluencerDashboardPage.tsx`
- Replace the inline `fetchData` + scattered `useState` + `useRealtimeSubscription` calls with `useDashboardData({ userId, type: 'influencer' })`
- Remove duplicate `safeQuery` helper (now in dataService)
- Wrap render in `<DashboardContainer>` for consistent loading/error/empty states
- Keep all existing UI (KPI cards, funnel chart, student cards, tabs) — only the data layer changes
- Keep existing `useRealtimeSubscription` calls but point them to `refetch` from the hook

### 5. Update `src/pages/TeamDashboardPage.tsx` (Key sections only)
- Replace `fetchCases` + `fetchAppointments` with `useDashboardData({ userId, type: 'team' })`
- Remove the separate `fetchCases` and `fetchAppointments` functions
- Extract `cases`, `leads`, `appointments` from `data?.cases ?? []` etc.
- The full 1084-line business logic (profile form, appointment modal, case actions) stays unchanged — only the top-level data loading is refactored

### 6. Update `src/pages/AdminDashboardPage.tsx`
- Replace `fetchAllData` with `useDashboardData({ type: 'admin' })`
- Extract all 13 state setters from `data` object
- Keep `useRealtimeSubscription` calls pointing to `refetch`
- The `renderContent()` switch and all tab components stay unchanged

---

## Files to Create / Modify

| File | Action | Scope |
|------|--------|-------|
| `src/integrations/supabase/dataService.ts` | CREATE | New centralized fetch layer |
| `src/hooks/useDashboardData.ts` | CREATE | New React hook wrapping dataService |
| `src/components/dashboard/DashboardContainer.tsx` | CREATE | New reusable loading/error/empty UI |
| `src/pages/InfluencerDashboardPage.tsx` | MODIFY | Replace data fetching, wrap in container |
| `src/pages/TeamDashboardPage.tsx` | MODIFY | Replace fetchCases/fetchAppointments only |
| `src/pages/AdminDashboardPage.tsx` | MODIFY | Replace fetchAllData with hook |

---

## Technical Details

### The `safeQuery` Helper (moved to dataService)
```typescript
const safeQuery = <T>(p: Promise<{ data: T | null; error: any }>) =>
  p.catch((err) => ({ data: null as T | null, error: err }));
```

### Return Shape from `useDashboardData`
```typescript
{
  data: T | null,       // null until first load
  error: string | null, // human-readable error
  isLoading: boolean,
  refetch: () => Promise<void>  // stable callback for realtime use
}
```

### How Realtime Still Works
The existing `useRealtimeSubscription` calls in each dashboard are kept. They just call `refetch` (from `useDashboardData`) instead of the inline `fetchData`. This means no change to realtime behavior.

### TeamDashboardPage Strategy
The team dashboard is 1084 lines. Only the top ~170 lines (data loading section) will be modified. Everything from `getLeadInfo` downward — the profile form, case cards, appointment modals, analytics — stays byte-for-byte identical. This is the safest approach given the complexity.

### DashboardContainer Props
```typescript
interface DashboardContainerProps {
  isLoading: boolean;
  error: string | null;
  isEmpty?: boolean;
  onRetry: () => void;
  emptyMessage?: string;
  children: React.ReactNode;
}
```

---

## What Does NOT Change
- All existing UI markup and component layouts
- All business logic (case transitions, profile form validation, checklist actions)
- All RLS policies and database schema
- All translation keys and i18n usage
- Realtime subscription behavior
- The `useRealtimeSubscription` hook itself

---

## Expected Outcome
After implementation:
1. One place to debug data fetching issues for any dashboard
2. Consistent loading, error, and empty states across all 3 dashboards
3. No duplicate `safeQuery` definitions across files
4. Easier to add new data sources — just extend the dataService function
5. All existing functionality preserved with zero regression risk
