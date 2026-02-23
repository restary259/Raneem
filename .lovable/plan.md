# System Stability, Translation, and Session Control Fixes

## Phase 1: Session Logout Popup Fix (CRITICAL)

**Root Cause Identified**: The `kicked` state in `useSessionGuard.ts` is set to `true` but never set back to `false`. When the user clicks "OK" (`acknowledgeKick`), the function calls `signOut()` and `navigate()`, but does NOT call `setKicked(false)`. Since the component re-renders on navigation, the modal can remain stuck open or flash.

Additionally, the `handleKick` function has a 10-second auto-dismiss `setTimeout` that fires `signOut()` + `navigate()` regardless of whether the user already clicked "OK", creating a potential race condition.

**Fix (2 files)**:


| File                           | Change                                                                                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/useSessionGuard.ts` | Add `setKicked(false)` at the start of `acknowledgeKick`. Add a `dismissedRef` to prevent the auto-dismiss timeout from firing after the user clicks OK. Clear the timeout on cleanup. |
| `src/App.tsx`                  | Move hardcoded Arabic session modal text to i18n keys (see Phase 2). No logic change needed -- the modal `open={kicked}` will now properly close.                                      |


**Specific code changes in `useSessionGuard.ts**`:

- Store the timeout ID in a ref (`autoKickTimerRef`)
- In `acknowledgeKick`: clear the timeout, set `kicked = false`, then sign out and navigate
- In `handleKick`: store the timeout ID so it can be cancelled
- On cleanup: clear the timeout if still pending

---

## Phase 2: Translation Audit and Hardcoded String Fixes

**Issues Found**:

1. `**src/App.tsx` (line 113-123)**: Session kick modal uses inline Arabic/English ternaries instead of i18n keys
2. `**src/pages/TeamDashboardPage.tsx` (line 349)**: `{isAr ? 'مرحبًا' : 'Hi'}` -- hardcoded greeting
3. `**src/pages/InfluencerDashboardPage.tsx` (line 152)**: Same hardcoded greeting pattern

**Translation coverage status**: Both `en/dashboard.json` and `ar/dashboard.json` have comprehensive coverage (1223 lines each) with matching key structures. No missing namespace issues found. All status labels, filter labels, KPI labels, and form labels have proper translations. double cheak every thing in the influncer and team dashboard is translated 

**Fix (4 files)**:


| File                                    | Change                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `public/locales/en/dashboard.json`      | Add `session.kickedTitle`, `session.kickedDesc`, `session.ok` keys      |
| `public/locales/ar/dashboard.json`      | Add matching Arabic session keys                                        |
| `src/App.tsx`                           | Replace inline ternaries with `t('dashboard:session.kickedTitle')` etc. |
| `src/pages/TeamDashboardPage.tsx`       | Replace `isAr ? 'مرحبًا' : 'Hi'` with `t('lawyer.hi', 'Hi')`            |
| `src/pages/InfluencerDashboardPage.tsx` | Same fix as above                                                       |


---

## Phase 3: Profile Completion Freeze

**Status: ALREADY FIXED** in the previous edit. The loading guard was changed from `if (!authReady || isLoading)` to `if (!authReady || (isLoading && !data))` at line 241 of `TeamDashboardPage.tsx`.

The `ProfileCompletionModal` component correctly:

- Calls `onClose()` before `refetch()` (line 142-144)
- Has proper `setSavingProfile(false)` in the `finally` block
- Uses `AlertDialog` for confirmation which is independent of the parent loading state

No additional changes needed for this phase.

---

## Phase 4: Case Over-Generation Audit

**Analysis**: The case creation happens via:

1. Admin assigns a lead to a team member in `LeadsManagement.tsx` -- creates one `student_cases` record
2. The `insert_lead_from_apply()` RPC creates a `leads` record, NOT a case
3. `ProfileCompletionModal` only calls `.update()` on an existing case, never `.insert()`

**Finding**: There is NO duplicate case creation risk from the current code paths. The Apply page creates leads, the admin creates cases from leads, and the team updates existing cases. Each path is isolated.

**Recommendation**: No code change needed. The system already has proper separation. The user's observation about "Team 02 seeing 3 cases" was caused by the RLS issue (already fixed in the previous implementation).

---

## Phase 5: Team Dashboard Performance

**Current state**: The dashboard fires 3 realtime subscriptions (`student_cases`, `appointments`, `leads`) and uses `useDashboardData` for the initial fetch. Each realtime event triggers a full `refetch()`.

**Improvements (1 file)**:


| File                              | Change                                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/pages/TeamDashboardPage.tsx` | Debounce the `refetch` callback so rapid-fire realtime events (e.g., multiple case updates) don't trigger multiple full fetches. Add a 500ms debounce using a ref-based timer. |


This prevents the "lag" when multiple mutations happen quickly (e.g., completing profile triggers both a case update and a lead update, which fires 2 refetches).

---

## Phase 6: Bottom Navigation (Team Dashboard)

**Current state**: The Team Dashboard already has a proper fixed bottom nav at lines 585-605 with:

- `position: fixed; bottom: 0; left: 0; right: 0; z-index: 50`
- `paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))'` for iOS safe area
- Only shown on mobile (`isMobile && ...`)

The main content area has `pb-20 lg:pb-0` at line 394 to account for the bottom nav height.

**Finding**: The bottom nav implementation is already correct. The global `BottomNav` component in `App.tsx` already hides itself on dashboard routes (line 22 of `BottomNav.tsx` checks for `/team-dashboard` and `/lawyer-dashboard`), so there is no conflict.

No changes needed.

---

## Summary of Actual Changes


| Priority | Phase             | Files Changed                                                                   | Risk                            |
| -------- | ----------------- | ------------------------------------------------------------------------------- | ------------------------------- |
| CRITICAL | Session Popup Fix | `useSessionGuard.ts`                                                            | Low -- state management only    |
| HIGH     | Hardcoded Strings | `App.tsx`, `TeamDashboardPage.tsx`, `InfluencerDashboardPage.tsx`, 2 JSON files | Zero -- text only               |
| MEDIUM   | Debounced Refetch | `TeamDashboardPage.tsx`                                                         | Low -- additive performance fix |
| NONE     | Profile Freeze    | Already fixed                                                                   | N/A                             |
| NONE     | Case Duplication  | No issue found                                                                  | N/A                             |
| NONE     | Bottom Nav        | Already correct                                                                 | N/A                             |


## What Will NOT Change

- Commission calculation formulas
- Case status definitions and transitions
- Payment marking logic
- RLS policies
- Database schema
- Edge functions
- Financial aggregation queries
- Role permissions

## Rollback

Each fix is independent and reversible:

1. Session guard: revert `useSessionGuard.ts` to remove `setKicked(false)` and timeout cleanup
2. Translation: revert inline ternaries in `App.tsx`
3. Debounce: remove the debounce wrapper around `refetch`