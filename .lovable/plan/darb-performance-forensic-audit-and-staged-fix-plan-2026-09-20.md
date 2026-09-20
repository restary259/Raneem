# DARB performance: forensic audit and staged fix plan

No code changes yet. This is the audit result plus the implementation roadmap, for approval.

## 1. What I verified in the code (evidence, not guesses)

**Confirmed — the caching layer exists but almost nothing uses it.**
`src/router.tsx` configures a well-tuned query cache: `staleTime` 60s, `gcTime` 10 min, no refetch on window focus, and "keep showing previous data" on navigation. But a repo-wide scan finds only **6 files** that read through it (`AdminMembersPage`, `AdminFinancialsPage`, `AdminCommandCenter`, `AdminAnalyticsPage`, and two access hooks). At least **22 other dashboard pages fetch directly** with `useEffect` + `supabase.from/rpc` into local `useState`.

Consequence, and this is the single biggest cause of the complaint: local state dies with the component. Every route change and every tab switch unmounts the page, resets its data to empty, and refetches from scratch. Returning to a page visited five seconds ago costs the full round trip again. The cache that would have made it instant is never consulted.

**Confirmed — tab switches are full remounts.** `src/components/shell/TabHub.tsx` renders only the active tab (`active === tab.value &&`). That is correct for memory, but combined with the point above it means every tab switch inside Admin Finance, Pipeline, Messages, Agent hubs etc. is a cold load with a `LoadingState` skeleton.

**Confirmed — routes import pages eagerly.** Each file in `src/routes/` does a static top-level `import` of its page component, and the generated route tree statically imports every route file. Whether the build plugin still splits these into per-route chunks must be measured against the real build output before I claim a bundle problem.

**Confirmed — broad reads.** 75 occurrences of `select('*')` across `src/`. The largest pages are very large single components (AdminStudentsPage 1464 lines, AdminPipelinePage 1289, TeamAppointmentsPage 1214, WhatsAppInboxPage 1181), so a single state change re-renders a large tree.

**Confirmed — realtime is pooled but coarse.** `src/lib/realtimeRegistry.ts` correctly shares one channel per table and closes it when the last subscriber leaves. However `useRealtimeSubscription` debounces 300 ms and then calls the page's whole `load()` — so one row change re-runs every query on the page.

**Confirmed — auth is resolved once globally.** `AuthContext` fetches role and password flag once per session. Not a bottleneck; I will not touch it.

**Not yet proven (needs measurement, will not be asserted as fact):** actual per-route transition times, real chunk sizes, which Supabase queries are slow server-side, long-task counts, and whether any index is missing. An unmeasured index is not a finding.

## 2. Phase 0 — baseline before any fix (first work item)

The repo already has a real harness at `e2e/mobile_perf_audit.py` (paint/LCP/CLS/long-tasks/JS bytes/scroll frames under 4x CPU + Slow-4G). I will extend it into a navigation benchmark rather than build a second one, and run it against a production build.

Recorded per transition, for every role listed below: click→route change, →first paint, →usable content, request count, slowest request, duplicate requests. Cold / warm / repeat-visit / back-navigation / tab-cycle variants.

Routes: Admin (Members, Students, Pipeline, Messages, WhatsApp, Financials, Commission, Settings), Team (My Work, Cases, Appointments, Catalog, Partner Schools, Major Intelligence, Students, Messages), Agent, Partner, Student. Plus the specific cycles: thread A→B→A, country→school→back, today→week→month→today, Programs↔Accommodation.

Output: `docs/perf-report.md` with median/p95 per transition, plus server-side timings from the database's own slow-query statistics. No number goes in the report unless it was measured.

## 3. Prioritized findings

| # | Pri | Finding | Root cause | Evidence |
|---|-----|---------|-----------|----------|
| F1 | P0 | Revisiting a page is as slow as the first visit | 22+ pages hold data in component state, not the query cache; unmount wipes it | 6 files use `useQuery` vs 22+ manual `useEffect` fetchers |
| F2 | P0 | Tab switch = cold load with skeleton | `TabHub` unmounts inactive tabs and there is no cache behind the remount | `TabHub.tsx` conditional render + F1 |
| F3 | P1 | One row change refetches a whole page | `useRealtimeSubscription` fires the page-level `load()` | `useRealtimeSubscription.ts` |
| F4 | P1 | Over-fetching for small summaries | 75 `select('*')`; counts computed in the browser | grep |
| F5 | P1 | Sequential request chains inside pages | multi-stage `await` loads in the biggest pages | to be confirmed per page in Phase 0 |
| F6 | P2 | Large single-component pages re-render wholesale | 1000–1400-line page components with many `useState` | line counts |
| F7 | P2 | Route/bundle weight | eager route imports; heavy libs (PDF, spreadsheet, charts, CV) | must be confirmed from build output |

## 4. Implementation phases (each independently shippable and testable)

- **Phase 1 — navigation responsiveness.** Route-level pending UI so a click responds within one frame; verify the existing layout-matched fallback covers every dashboard path.
- **Phase 2 — move dashboard reads onto the query cache (the big one).** Convert pages to `useQuery` with stable, semantic keys, highest-traffic first: Team My Work, Admin Students, Admin Pipeline, Messages/WhatsApp inbox lists, Catalog, Partner Schools, Agent/Partner overviews, Student pages. Cache policy per data class: catalog/schools/programs long, aggregates 30–60 s, money and permissions short but still cached across a round trip. Behaviour, permissions and error/empty handling stay identical.
- **Phase 3 — remove duplicate requests.** Build the data-source map, deduplicate shared reads (profile, role, unread counts, settings, catalogs) behind shared query keys.
- **Phase 4 — query and RPC tuning.** Replace `select('*')` with explicit columns, use exact head-counts for KPI numbers, move browser-side grouping into the existing RPCs where it already belongs. Indexes only where a measured plan justifies one.
- **Phase 5 — realtime.** Convert row events into targeted cache updates or narrow invalidations instead of page-wide reloads. Message correctness and permissions unchanged.
- **Phase 6 — rendering.** Memoize only what the profiler shows: derived lists, filter/sort/group work, chart transforms. Split the largest pages where it removes measured re-render cost.
- **Phase 7 — bundle.** Defer PDF, spreadsheet, CV-builder, campaign and chart code to interaction, guided by the measured build output.
- **Phase 8 — large lists.** Pagination/incremental loading where a list is actually large; no virtualization for small lists.
- **Phase 9 — perceived loading.** Distinguish first load, background refresh, and pending navigation. Skeletons sized to final content to stop layout jumps.
- **Phase 10 — mobile.** Re-run the mobile harness; confirm no desktop gain cost mobile anything.
- **Phase 11 — verification.** Re-run the identical benchmark, full lint/typecheck/test/e2e, before/after table in `docs/perf-report.md`.

## 5. Expected results

Targets, to be confirmed against the Phase 0 baseline: revisiting a cached page renders immediately with a background refresh instead of a full reload; tab switches inside hubs become cache-served; request count per repeat navigation drops sharply; one realtime row change stops triggering a page-wide refetch. I will publish measured before/after numbers, not estimates.

## 6. Risks and what must not change

Risks: stale-cache correctness on money and permission surfaces (mitigated by short stale times there and invalidation on mutation), realtime message ordering, and regressions from touching very large page components (mitigated by converting one page per commit).

Must not change: RLS and all security-definer boundaries; role-based navigation and access rules; WhatsApp permissions, single receiver endpoint and inbox; internal chat scroll behaviour (chat area scrolls internally, never expands the page); appointment month layout and drag/drop; catalog deep links; Arabic/RTL; PWA update safety; commission and case-stage business logic; visual design. No production migrations in this pass. Work happens on a dedicated branch via pull request, never directly on main.

## 7. Approval

On approval I start at Phase 0 and report the measured baseline before writing any optimization.
