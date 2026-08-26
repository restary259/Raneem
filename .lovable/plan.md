# Mobile Scrolling & Performance Audit — measured, not assumed

## What I already measured (facts, this session)

Chromium mobile emulation, 390x844, DPR 3, touch, **4x CPU throttle**, against the running dev server. Programmatic scroll pass over the full page height, sampling every animation frame.

| Route | FCP | DOMContentLoaded | DOM nodes | Requests | Frame median | Frame p95 | Frames >50ms |
|---|---|---|---|---|---|---|---|
| `/` (landing) | 248 ms | 1708 ms | 540 | 182 | 16.7 ms | 16.7 ms | 0 |
| `/faq` | 144 ms | 1174 ms | 326 | 175 | 16.7 ms | 16.8 ms | 0 |
| `/resources` | 184 ms | 1195 ms | 349 | 180 | 16.7 ms | 16.7 ms | 0 |

Reading: public marketing pages scroll at a locked 60 fps with zero dropped frames even at 4x CPU throttle. Scroll smoothness on the public site is not a problem.

Static findings (code-verified, not measured yet):
- No list virtualization anywhere (`react-window` / `react-virtual` / `virtuoso` absent from `package.json`); long dashboard tables render every row.
- `DashboardLayout` uses `h-screen overflow-hidden` with a single inner `overflow-y-auto` main region — correct pattern, but nested scrollers exist in `MemberDetailDrawer` (3), `AdminSettingsPage` (2), and several list pages, which is where mobile scroll-chaining bugs usually live.
- `overscroll-contain` is applied in the chat message list but not on the other nested scrollers.
- Two queries fetch up to 200 rows unpaginated (`AgentStudentsPage`, `AuthFailuresPanel`).
- Route chunks are well split in `vite.config.ts` (charts/pdf/supabase isolated).

**Honest limitation:** the numbers above are from the dev server on public pages. They say nothing about the authenticated dashboards, which is where the app is heavy. I will not rate the app on those numbers.

## What the full audit will do

### 1. Production baseline
Build for production and serve the built output, so measurements reflect real bundle sizes and minified JS — dev-server numbers are excluded from the rating.

### 2. Authenticated dashboard measurement
Sign in as each role and measure the routes that actually matter, at 390x844 with 4x CPU throttle and Slow-4G network emulation:
- Admin: overview, pipeline, students, financials, members, spreadsheet, commission hub
- Team: work, cases, case detail, catalog, analytics
- Student: next steps, documents, fees, messages
- Partner / Agent: overview, students, earnings

### 3. Metrics captured per route
- **Load:** FCP, LCP, Time to Interactive, total blocking time, JS transferred + parsed
- **Scroll:** frame-time median / p95 / max, dropped-frame count, jank events during a full-height scroll and during a fast fling
- **Scroll correctness:** momentum on iOS-style touch, scroll chaining between nested scrollers, sticky-header stability, position restoration on back navigation, keyboard-open behavior in chat, pull-to-refresh interference, bottom-nav overlap of last content row
- **Runtime:** long tasks >50 ms, layout-shift score, DOM node count, re-render storms from realtime subscriptions
- **Navigation:** click → route change → meaningful content, cold vs. warm

### 4. Rating
Each area gets a 1–10 score with the measurement that produced it printed next to it — no score without a number behind it:
Initial load · Route navigation · Scroll smoothness (public) · Scroll smoothness (dashboards) · Long-list handling · Scroll correctness/UX · Chat scrolling · Runtime responsiveness under load · Overall.

### 5. Deliverable
`docs/mobile-perf-audit.md`: the full table of measurements, per-area scores with evidence, a ranked list of the actual bottlenecks with the file and line responsible, and screenshots/traces for any visible scroll defect. Fixes are proposed, not applied — you approve those separately.

## Technical notes
Measurement harness lives in `e2e/` as a repeatable Playwright script using `performance.mark`/`measure`, the Long Task and Layout Shift observers, and CDP `Emulation.setCPUThrottlingRate` / `Network.emulateNetworkConditions`. No `waitForTimeout`-based timing. No product code changes in this audit.
