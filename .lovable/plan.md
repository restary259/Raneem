# Dashboard navigation performance: measure, fix, re-measure

Performance-only work. No redesign, no business-logic changes, no RLS/security changes, no framework swaps. UI, routes, permissions and financial math must stay identical.

## Root cause (verified in code)

The QueryClient in `src/App.tsx` is tuned for instant navigation (`staleTime` 60s, `gcTime` 10m, `refetchOnWindowFocus: false`, `placeholderData: keep-previous`) — but dashboard pages never use it. A repo scan shows `useQuery` is imported in only one dashboard page (`AdminMembersPage`); ~37 page files fetch with hand-rolled `useEffect` + `useState` + `useCallback` (`fetchData`/`load`).

Because every dashboard route is `lazy()` and `TabHub` mounts only the active tab, each navigation or tab switch unmounts the page, resets local state to empty, and refetches from scratch. Returning to a page visited seconds ago pays the full network cost again. The route-level Suspense fallback is a blank `<div />`, so nothing paints until the chunk loads. That is the 1–2s "waiting to wake up".

Contributing: intra-page request waterfalls (AdminCommandCenter's two sequential `Promise.allSettled` waves; `getAdminDashboard`'s sequential profile lookups; AdminStudentsPage's 4-stage fetch), `select('*')` with `limit(5000)` for KPIs computed in the browser, realtime events re-running whole multi-query fetches, and unmemoized analytics derivations.

Ruled out: bundle chunking (recharts/pdf/exceljs already isolated in `vite.config.ts`), the service worker (bypasses Supabase, SWR for assets), and auth init (one-time, not per-navigation).

## Step 1 — Baseline (before any change)

- Production build + preview (`npm run build`, `npm run preview`). No dev-mode numbers.
- New repeatable Playwright benchmark in `e2e/` that signs in with the existing safe test strategy and walks real routes from `src/App.tsx`:
  - Admin: `/admin` → `/admin/pipeline` → `/admin/students` → `/admin/financials` → `/admin/team` → `/admin/referrals` → `/admin/programs` → `/admin/settings` → `/admin`
  - Team: `/team` → `/team/cases` → `/team/appointments` → `/team/analytics` → `/team`
  - Finance hub tab switches: Financials ↔ Spreadsheet ↔ Analytics
- Per transition record: click→route change, →first paint, →meaningful content, →network idle, →interactive. Use `performance.mark`/`measure` and readiness selectors — never `waitForTimeout`.
- Report median / p75 / p95 / worst for cold, warm-cache and repeated navigation. Write baseline to `docs/perf-report.md`.
- Capture passing baseline of `npm run lint`, `npm test`, `npm run test:e2e`.

## Step 2 — Fixes, highest impact first

**F1 (P0) Move dashboard fetching onto TanStack Query.** Convert the highest-traffic pages to `useQuery` with stable semantic keys so tab round-trips are cache-served: `AdminCommandCenter`, `useDashboardData` (admin/team/influencer, keyed by type+userId), `TeamWorkPage`, `TeamAnalyticsPage`, `StudentFeesPage`, then the remaining manual-fetch pages. `staleTime` chosen per data semantics — catalog data long (5–10m), aggregates 30–60s, financial/permission data short but still cached across a round-trip. Preserve existing error/empty handling, including AdminCommandCenter's failed-vs-empty distinction.

**F2 (P0) Remove intra-page waterfalls.** Merge AdminCommandCenter's two independent `Promise.allSettled` waves into one batch. Run `getAdminDashboard`'s two follow-up profile lookups together. Parallelize AdminStudentsPage stages 3 and 4 (both depend only on stage 2).

**F3 (P1) Tame realtime refetch storms.** AdminCommandCenter re-runs all 7 queries per `cases`/`activity_log` event. Coalesce events (~500ms) or invalidate specific query keys instead. Audit the other realtime pages (PartnerEarningsPage 6 subs, PartnerOverviewPage 5, AdminPipelinePage) for the same pattern. Realtime behaviour stays.

**F4 (P1) Reduce KPI over-fetch.** Replace `select('*')` + `limit(5000)` with column projections or `{ count: 'exact', head: true }` where the value is a pure count/sum. Verify every KPI and financial total is identical before/after.

**F5 (P1) Finance hub + Analytics.** Give each Finance hub child its own query key so switching tabs is cached. In `AdminAnalyticsPage`: `useMemo` the `funnelData` / `sourceData` / `avgDays` derivations (currently 9+ full array scans per render) and defer the three Recharts containers so KPIs paint first. Same chart data, same appearance.

**F6 (P2) Perceived performance.** Replace the blank route-level Suspense fallback with a lightweight layout-matched shell using the existing `LoadingState`/shell primitives. Keep `placeholderData` so cached pages render instantly. Skeletons only for genuine waits.

**F7 (P3, optional) Prefetch.** On sidebar link hover/focus, prefetch the lazy chunk and lightweight next-destination data for high-probability targets only.

No blanket `React.memo`; memoization only where profiling shows a real repeated render. Chunking and service worker untouched.

## Step 3 — Verify

- Re-run the identical benchmark; record after-numbers with the same methodology.
- `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e` all green.
- Add a statistical (non-flaky) performance assertion for the key Admin/Team transitions.
- Final `docs/perf-report.md`: executive summary, before/after table per route (median/p75/p95/worst + % change), bottleneck classification, bundle notes, network/refetch changes, and honest remaining bottlenecks. No claimed win without a measured one; no invented numbers.
