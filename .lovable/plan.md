

# Pull-to-Refresh + Fix Desktop Scroll

## Problem 1: Desktop App Can't Scroll with Mouse

In the PWA standalone mode CSS (`pwa.css`), the `overscroll-behavior-y: contain` on `body` combined with nested `overflow-auto` containers in `AdminLayout` (both the wrapper div on line 170 and the `<main>` on line 190) creates conflicting scroll contexts. On desktop PWA, the mouse wheel events get trapped or swallowed.

**Root cause:** The `AdminLayout` has `overflow-auto` on both the flex container (`div.flex-1.overflow-auto`) AND the `<main>` inside it. This double-nesting confuses desktop scroll behavior especially in standalone PWA mode.

**Fix:**
- Remove `overflow-auto` from the inner `<main>` element in `AdminLayout.tsx` (line 190) -- only the parent wrapper needs it
- In `pwa.css`, remove `overscroll-behavior-y: contain` from `body` in standalone mode -- this property was blocking mouse-wheel scroll propagation on desktop PWA

## Problem 2: Pull-to-Refresh for Table Views

Create a lightweight `PullToRefresh` wrapper component that:
- Only activates on **touch devices** (mobile) -- no interference with desktop mouse scrolling
- Only triggers when the user is at the **top of the scroll container** and pulls down
- Shows a spinner animation during refresh
- Prevents duplicate API calls with a loading guard
- Does **not** reload the entire page -- just calls the parent's `onRefresh` callback

### Where to apply it:
- Admin dashboard tables (LeadsManagement, StudentCasesManagement, MoneyDashboard, InfluencerManagement, StudentProfilesManagement)
- Team dashboard case list
- Influencer dashboard student list
- Student dashboard tabs

### Safety constraints:
- Disabled during form submissions, uploads, or payment processing (controlled via a `disabled` prop)
- Retains filters, sorting, search, and scroll position after refresh
- Compatible with RTL layouts

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/common/PullToRefresh.tsx` | Reusable pull-to-refresh wrapper component (touch-only) |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/AdminLayout.tsx` | Remove duplicate `overflow-auto` from `<main>` (line 190) |
| `src/styles/pwa.css` | Remove `overscroll-behavior-y: contain` from body in standalone mode |
| `src/components/admin/LeadsManagement.tsx` | Wrap table content with PullToRefresh |
| `src/components/admin/StudentCasesManagement.tsx` | Wrap table content with PullToRefresh |
| `src/components/admin/MoneyDashboard.tsx` | Wrap table content with PullToRefresh |
| `src/components/admin/InfluencerManagement.tsx` | Wrap table content with PullToRefresh |
| `src/components/admin/StudentProfilesManagement.tsx` | Wrap table content with PullToRefresh |
| `src/pages/TeamDashboardPage.tsx` | Wrap case list with PullToRefresh |
| `src/pages/InfluencerDashboardPage.tsx` | Wrap student list with PullToRefresh |

## Technical Details: PullToRefresh Component

```text
Props:
- onRefresh: () => Promise<void>  -- async callback to fetch data
- disabled?: boolean              -- disable during forms/uploads
- children: React.ReactNode       -- the table/list content

Behavior:
- Uses touchstart/touchmove/touchend events
- Only activates when scrollTop === 0 and touch moves downward > 60px
- Shows a rotating spinner at the top during refresh
- Calls onRefresh(), waits for completion, then hides spinner
- Guards against duplicate calls with an isRefreshing state lock
- No-op on desktop (mouse events are not intercepted)
```

## Security Note

No database or backend changes required. This is purely a frontend UX improvement. No new API calls or data access patterns are introduced.

