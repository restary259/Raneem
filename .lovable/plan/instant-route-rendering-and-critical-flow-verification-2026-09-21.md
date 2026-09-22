# Instant route rendering and critical-flow verification

## Goal
Make public pages and authenticated dashboards show useful content immediately on mobile and desktop, then verify Homepage, Contact, and Apply behavior through automated code-based checks without creating fake production leads.

## Confirmed current issues
- The app is globally client-rendered (`defaultSsr: false`), so the initial document contains only the splash and no page content.
- The root app is wrapped in a `Suspense` boundary with a `null` fallback while translations load over HTTP. In preview measurements, Homepage and Contact H1 content appeared about 2.5–3.0 seconds after DOM load.
- The development request graph imports all 103 route modules before critical page content settles; only eight page areas currently use explicit lazy loading.
- The splash currently causes a React hydration mismatch, forcing a client re-render. This is visible in runtime telemetry and adds avoidable startup work.
- Route preloading has no explicit user-intent strategy, and its stale window is zero.
- Existing public-flow tests only confirm basic rendering. They do not exercise Contact submission states or the full four-step Apply flow.

## Implementation

### 1. Repair the first render
- Make the server and browser render the same stable root shell so hydration succeeds without discarding the page tree.
- Remove the global `null` loading boundary from the critical path. Keep a visible, layout-matched fallback only around content that genuinely waits.
- Make the essential public translation namespaces available before first render instead of blocking Homepage, Contact, and Apply on sequential browser requests.
- Keep non-critical PWA, cookie, WhatsApp, and offline widgets deferred.

### 2. Reduce route startup cost
- Enable the framework-supported route code splitting path and confirm the production manifest contains independent route chunks rather than one eager graph.
- Keep route definitions and metadata lightweight; load each page implementation only when matched.
- Add intent-based preloading for links and a useful preload cache window so touch, hover, and repeat navigation feel immediate.
- Preserve the existing dashboard hub-level lazy tabs, but prevent nested loading boundaries from producing blank frames.

### 3. Improve dashboard arrival
- Keep authentication and role enforcement unchanged.
- Replace the full-screen spinner during session restoration with the existing dashboard-shaped loading shell.
- Avoid waiting on unrelated public translation namespaces or widgets before dashboard chrome appears.
- Preload the signed-in role’s default destination and primary mobile navigation destinations after authentication settles.
- Preserve React Query caching, RLS, security gates, and all case/payment/commission logic.

### 4. Verify Homepage, Contact, and Apply through code
- **Homepage:** assert one visible H1, primary Apply navigation, WhatsApp link, marquee stability, no overflow, and no console/hydration errors.
- **Contact:** test required fields, email-or-phone rule, topic/message/consent validation, pending state, successful submission UI, and failure recovery. Intercept the write in browser tests so no fake live contact is created; separately verify the submitted payload contract and backend boundary.
- **Apply:** exercise all four steps on mobile and desktop, phone and Bagrut validation, consent gate, referral valid/invalid/transient behavior, payload shape, loading lock, server error recovery, duplicate response handling, and success screen. Intercept writes so no fake live case is created.
- Add timing instrumentation to record DOM-ready-to-visible-content and navigation-settle durations for the three public routes and representative Admin, Team, Partner, Agent, and Student routes.

### 5. Acceptance checks
- No hydration mismatch or React script warning on the checked routes.
- A meaningful shell is visible immediately; no blank or splash-only interval after DOM load.
- Homepage, Contact, and Apply primary content becomes visible within 1 second in local throttled mobile/desktop checks, with a stretch target below 500 ms for warm navigation.
- Warm route changes show the destination shell within 100 ms and settled content within 500 ms when no backend request is required.
- No horizontal overflow at 390, 1024, 1280, 1440, and 1920 px.
- Arabic and English render correctly, reduced-motion behavior remains intact, build passes, focused tests pass, and preview screenshots confirm mobile and desktop results.

## Technical scope
Likely touch points are the root shell, translation bootstrap, router preload/code-splitting configuration, lightweight route modules, authentication loading UI, and focused Playwright/Vitest coverage. No database schema, RLS, WhatsApp architecture, or business workflow changes are planned.
