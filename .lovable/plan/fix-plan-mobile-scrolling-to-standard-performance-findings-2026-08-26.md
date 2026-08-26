# Fix plan — mobile scrolling to standard + performance findings

Scope: scrolling behaviour and rendering performance only. No business logic, RLS, financial math, routes, or permissions change. Each fix below is tied to a finding, and each gets a before/after measurement with the same harness that produced the baseline.

## Confirmed defects to fix

**D1 — Dashboard scroll position never resets on navigation.**
`src/App.tsx:207` calls `window.scrollTo(0, 0)` on route change, but `DashboardLayout` scrolls an inner element (`DashboardLayout.tsx:522`, `overflow-y-auto` inside `h-screen overflow-hidden`). The window is not the scroller, so navigating from a scrolled admin list into a detail page lands mid-page.

**D2 — Nested scrollers chain to the page.**
`MemberDetailDrawer` (three nested scroll regions, lines 280/723/735) and the `max-h-[90vh] overflow-y-auto` dialogs in `AdminSettingsPage` (645, 893) have no `overscroll-behavior`. On touch, reaching the end of the inner list scrolls the page behind the sheet/dialog. Only the chat list currently sets `overscroll-contain`.

**D3 — Body scroll not locked behind mobile sheets/drawers.**
Same surfaces: the page behind stays scrollable while the overlay is open.

**D4 — No list virtualization anywhere.**
No `react-window` / `@tanstack/react-virtual` / `virtuoso` in `package.json`. Long admin/team lists mount every row. Two known unpaginated 200-row fetches: `AgentStudentsPage.tsx:49`, `AuthFailuresPanel.tsx:36`.

**D5 — Momentum/rubber-band inconsistency.**
`-webkit-overflow-scrolling: touch` is set in `styles/base.css` and `styles/layouts.css` but not on the dashboard main scroller or the drawer/dialog scrollers.

**D6 — Unverified surfaces** (measured in step 1 before any change): sticky header stability while scrolling, bottom-nav overlap of the last content row, chat behaviour when the mobile keyboard opens, and realtime-driven re-render storms on pages with multiple subscriptions.

## Work plan

### Step 1 — Baseline the authenticated dashboards
Production build served locally, 390x844, DPR 3, touch, 4x CPU throttle, Slow-4G. Playwright harness in `e2e/` using `performance.mark`/`measure`, Long Task and Layout Shift observers, and CDP throttling — no `waitForTimeout` timing. Routes: Admin (overview, pipeline, students, financials, members, spreadsheet, commission hub), Team (work, cases, case detail, catalog, analytics), Student (next steps, documents, fees, messages), Partner/Agent (overview, students, earnings). Per route: FCP, LCP, TBT, long tasks >50 ms, CLS, DOM nodes, JS transferred, frame median/p95/max over a full-height scroll and a fast fling, and dropped-frame count. Written to `docs/mobile-perf-audit.md` as the "before" table.

### Step 2 — Scroll correctness fixes (D1, D2, D3, D5)
- Add a scroll-reset that targets the actual dashboard scroll container on route change, keeping the existing `window.scrollTo` for public pages. Preserve position on back navigation where the browser would.
- Apply `overscroll-behavior: contain` to every nested scroller: the drawer body and inner lists in `MemberDetailDrawer`, the `max-h-[90vh]` dialog bodies in `AdminSettingsPage`, and the remaining list-page scrollers found in the sweep.
- Lock body scroll while a mobile sheet/drawer/dialog is open, released on close (including the back-button path).
- Add touch momentum to the dashboard main scroller and overlay scrollers so iOS Safari matches the rest of the app.
- Add a small shared scroll-container primitive so future scrollers inherit contain + momentum by default instead of each surface re-deciding.

### Step 3 — Long-list fixes (D4)
- Paginate or cap-with-"load more" the two 200-row fetches, keeping the same queries and filters.
- Introduce virtualization only where step 1 shows a real cost (frame p95 above ~24 ms or DOM nodes past a few thousand). Applied per list, verified per list — not a blanket rewrite.

### Step 4 — Runtime jank (D6)
Address only what step 1 proves: coalesce realtime-triggered refetches on pages that re-run whole fetch waves per event, memoize derivations that scan large arrays on every render, and fix sticky-header/bottom-nav overlap if measurement or screenshots show it.

### Step 5 — Re-measure and rate
Identical harness, same conditions, "after" table alongside "before" in `docs/mobile-perf-audit.md`, with per-area 1–10 scores each printed next to the number that produced it: initial load, route navigation, scroll smoothness (public), scroll smoothness (dashboards), long-list handling, scroll correctness/UX, chat scrolling, runtime responsiveness, overall. Any area that does not improve is reported as unchanged, not spun.

Gate before finishing: `npm run build`, `npx vitest run`, and the e2e suite all green.

## Out of scope
Framework or router changes, redesigns, business logic, RLS/security, commission math, and any change to what data a role can see.
