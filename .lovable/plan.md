

# Audit Document vs. Codebase Cross-Reference

## Issues Already Fixed (9 of 17)

| Doc Issue | Status | Evidence |
|---|---|---|
| Issue 1: Funnel click doesn't filter | FIXED | `AdminDashboardPage.tsx` now passes `funnelFilter` as `initialFilter` to `LeadsManagement` and `StudentCasesManagement` |
| Issue 2: No per-button loading | FIXED | `actionLoadingId` state added in `TeamDashboardPage.tsx` line 44 with spinners on buttons |
| Issue 3: Silent partial failure | FIXED | `handleMarkContacted` checks both lead and case update results, shows warning toast on partial failure |
| Issue 4: paid_at vs case_status divergence | FIXED | `MoneyDashboard.tsx` line 134 now uses `!!c.paid_at` as sole filter |
| Issue 5: Admin auth hardcoded Arabic | FIXED | Uses `t('admin.auth.unauthorized')`, `t('common.error')` etc. |
| Issue 8: LeadsManagement single loading state | FIXED | `actionLoadingId` pattern added at line 80 |
| Issue 9: Delete appointment no confirmation | FIXED | `DeleteConfirmDialog` wraps deletion at line 567 |
| Issue B: Realtime subscription memory leak | FIXED | `useRealtimeSubscription.ts` returns `supabase.removeChannel(channel)` in cleanup |
| Issue C: Funnel keyboard accessibility | FIXED | `FunnelVisualization.tsx` already uses native `<button>` elements |
| Issue 10: Empty states | FIXED | Icons and hint text added to Team and Influencer dashboards |
| Issue 12: Mobile badge positioning | FIXED | Parent button has `relative` class at line 578 |
| Influencer paid badge sync gap | FIXED | Uses `linkedCase?.paid_at != null` (correct source of truth) |

## Issues Still Open (6 remaining)

### 1. Issue 6: Dead FILTER_LABELS in TeamConstants.ts
- `FILTER_LABELS` (lines 28-37) uses inline `{ ar, en }` objects but the actual UI at `TeamDashboardPage.tsx` line 396 uses `t('lawyer.filters...')` directly
- The export is dead code now -- should be removed to avoid confusion
- **Fix**: Delete `FILTER_LABELS` from TeamConstants.ts

### 2. Issue 7: Student Dashboard has no case progress stepper
- Students cannot see where their case is in the pipeline
- `MyApplicationTab` exists but shows minimal info
- **Fix**: Create a `CaseProgressStepper` component that fetches the student's case and renders a 6-step pipeline with accessible `role="progressbar"` attributes. Wire it into `MyApplicationTab`.

### 3. Issue A: No ref-based mutation rate-limiting guard
- `actionLoadingId` uses `useState` which is subject to React batching delays
- On slow networks, rapid clicks can dispatch duplicate API calls before state updates
- **Fix**: Add `const pendingRef = useRef(new Set<string>())` in TeamDashboardPage. Before each handler, check `if (pendingRef.current.has(id)) return;`, add on entry, delete in `finally`.

### 4. Issue D: No Error Boundaries per dashboard tab
- Student dashboard has `DashboardErrorBoundary` wrapper, but Admin, Team, and Influencer dashboards have none
- A render error in any tab crashes the entire dashboard
- The global `ErrorBoundary.tsx` has hardcoded Arabic strings (lines 57, 61, 70, 74, 91, 98, 109)
- **Fix**: Create a reusable `TabErrorBoundary` component. Wrap each tab's content in Admin, Team, and Influencer dashboards. Also update `ErrorBoundary.tsx` to use i18n.

### 5. Issue E: Student case ID not validated against auth user
- `StudentDashboardPage` fetches profile by `user.id` and RLS protects queries, so this is mitigated server-side by RLS
- However, the doc recommends an explicit client-side check as defense-in-depth
- **Fix**: After fetching profile, assert `profile.id === user.id`. If mismatch, clear state and redirect.

### 6. Issue 11: No "last refreshed" timestamp displayed
- `useDashboardData` already tracks `lastRefreshedAt` but no dashboard header displays it
- **Fix**: Add a small "Last refreshed: Xs ago" badge to each dashboard header area

---

## Implementation Plan

### Step 1: Remove dead code + add ref-based guard (Issues 6, A)
- Delete `FILTER_LABELS` export from `TeamConstants.ts`
- Add `pendingRef` guard to `TeamDashboardPage.tsx` action handlers

### Step 2: Create TabErrorBoundary + fix ErrorBoundary i18n (Issue D)
- Create `src/components/common/TabErrorBoundary.tsx` -- a lightweight error boundary that renders inline "This section encountered a problem" with a Retry button
- Wrap each dashboard tab's content in Admin, Team, and Influencer pages
- Update `ErrorBoundary.tsx` to use bilingual text (matching the session kick pattern)

### Step 3: Student case progress stepper (Issue 7)
- Create `src/components/dashboard/CaseProgressStepper.tsx`
- Fetches student's `student_cases` record (filtered by `student_profile_id`)
- Renders a horizontal step indicator using the `CASE_STATUS_ORDER` from `caseStatus.ts`
- Add `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Wire into `MyApplicationTab` component

### Step 4: Display last refreshed timestamp (Issue 11)
- Add a small muted text showing relative time since last refresh in Team, Influencer, and Admin dashboard headers

### Step 5: Student ownership validation (Issue E)
- Add explicit check in `StudentDashboardPage` after profile fetch: if `data.id !== userId`, clear profile and show error
- This is defense-in-depth since RLS already prevents cross-user access

### Step 6: i18n keys
- Add any missing keys for error boundary text and progress stepper labels to both `ar/dashboard.json` and `en/dashboard.json`

All changes are backward compatible, incremental, and preserve existing business logic and data flows.
