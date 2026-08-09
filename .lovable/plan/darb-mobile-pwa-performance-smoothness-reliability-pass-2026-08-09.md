# DARB — Mobile PWA Performance, Smoothness & Reliability Pass

Performance-only. No visual redesign, no route/logic/permission/content changes.

## Audit findings (verified against the codebase)

1. **Viewport allows pinch zoom** — `index.html` uses `maximum-scale=5.0`. No `touch-action` or iOS input font-size guard found in `src/index.css`.
2. **Eager public pages** — `App.tsx` eagerly imports Index, WhoWeAre, Services, Locations, Contact, EducationalDestinations, StudentAuth, ChatWidget, PWAInstaller, CookieBanner, BottomNav. Dashboards are already lazy — good.
3. **Heavy images** — `public/lovable-uploads` is 8.5 MB; several PNGs are 500–900 KB, hero poster 585 KB. Preloaded hero is a single desktop-size asset for all viewports.
4. **Duplicate/blocking font loading** — Tajawal is loaded twice (deferred stylesheet + preload) plus a second Google Fonts request with 3 extra families.
5. **Query defaults are thin** — `QueryClient` sets only `staleTime`/`gcTime`; no `refetchOnWindowFocus` control, no retry policy, so mobile background/foreground cycles cause refetch storms and permanent errors get retried.
6. **Broad selects** — 45 occurrences of `select('*')` across `src/`, several on list screens.
7. **Realtime** — channels exist in 9 modules; presence/typing hooks create channels. Needs a cleanup + de-duplication audit on repeat navigation (Cases ⇄ Dashboard).
8. **Service worker** — hand-rolled `public/service-worker.js` v4.0.0 with stale-while-revalidate + an update banner injected via raw DOM HTML, plus a 30-minute `registration.update()` interval. Needs review for stale-HTML and private-data caching safety.
9. **Autosave** — `CaseProfileForm` already debounces with a flush on unmount; will be verified, not rewritten.

## What will change

### A. Pinch-zoom and input zoom (minimal change)
- Set viewport to `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`.
- Add `touch-action: manipulation` on interactive elements only (buttons/links/inputs) — never a global `touch-action: none`.
- Ensure form controls compute to ≥16px on mobile so iOS never auto-zooms; done via a mobile-only min font-size rule that does not alter visual sizing on desktop.

### B. Bundle & startup
- Lazy-load the remaining secondary public pages and non-critical global widgets (ChatWidget, PWAInstaller, CookieBanner, InAppBrowserBanner) behind idle/Suspense; keep `/` (Index) eager so first paint is unchanged.
- Split the Google Fonts requests into one non-blocking request; drop the duplicated Tajawal preload/stylesheet pair.
- Refine `manualChunks` so charts/pdf/excel never land in the initial graph.

### C. Images
- Recompress the largest PNGs (>300 KB) losslessly/near-lossless and serve WebP variants; keep identical dimensions and visible quality.
- Add `loading="lazy"` + `decoding="async"` to below-the-fold images; keep the LCP hero eager with `fetchpriority="high"`.

### D. Data fetching & navigation
- Tune `QueryClient`: `refetchOnWindowFocus: false`, `refetchOnReconnect: true`, bounded exponential-backoff retry that skips permanent (4xx/RLS) errors, `networkMode: 'offlineFirst'` for reads.
- Convert the hottest repeated fetches on mobile list screens to column-scoped selects and parallel `Promise.all` where they are currently sequential.
- Keep cached data on screen while refreshing (no new loading flashes); no loading state is removed.

### E. Realtime & memory
- Audit every `supabase.channel` / listener / timer for unsubscribe on unmount; add a shared channel registry where the same channel is created by multiple mounted components so repeat navigation cannot stack subscriptions.

### F. Reliability
- Add request timeouts + abort on unmount for long-running fetches so no screen can hang on "Loading…" forever.
- Ensure user-facing errors stay generic (no raw Supabase/stack detail) while console/server logs keep the detail.

### G. Service worker safety
- Keep the existing worker path and version scheme. Enforce network-first for HTML navigations, cache-first only for hashed static assets and fonts, and never cache authenticated API/database responses.
- Verify the update flow evicts old asset caches so a new deploy reaches users without manual cache clearing.

### H. Input / chat / scroll
- Verify (and only fix where measurably needed): typing paths use local state with debounced persistence; chat send stays optimistic with no duplicates; long lists avoid per-row expensive formatting by hoisting `Intl` formatters to module scope.

## Verification
- Playwright run on a mobile viewport capturing before/after: initial load, route navigation timings, request counts, duplicate requests, bundle size per chunk, largest assets, repeated-navigation channel counts.
- Full existing test suite must stay green; screenshots compared to confirm zero visual change.
- Deliverable: a before/after table (load time, nav time, request count, bundle size, bottlenecks removed, memory issues fixed).

## Explicitly not doing
No rewrite, no framework/library swaps, no redesign, no schema-meaning changes, no removal of RLS/validation/persistence/realtime, no blanket memoization, no arbitrary delays.
