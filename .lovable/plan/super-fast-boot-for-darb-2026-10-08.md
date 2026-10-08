# Super-fast boot for DARB

Goal: make the app show useful content in under a second on mobile, instead of a blank white screen while React and translations load.

## Current state (confirmed)
- SPA mode (`defaultSsr: false`): the server returns an empty HTML shell; nothing is visible until JavaScript downloads, runs, and translations load over HTTP.
- Google Fonts stylesheet is render-blocking in `index.html`.
- No preconnect to the backend API, so the first data request pays full connection setup cost.
- i18n namespaces load over HTTP after boot (already trimmed to a minimal boot set in an earlier pass).

## Changes

### 1. Instant branded splash in the HTML shell
- Inline a small, layout-matched branded placeholder (DARB logo + background color) directly into `index.html` so visitors see something immediately, before any JavaScript runs.
- It must render identically on server and client to avoid a hydration mismatch, and disappear on first React paint (same mechanism as the current `#pwa-loading` handling).
- Respects RTL and reduced motion; no spinner animation that could get stuck.

### 2. Kill the render-blocking font stylesheet
- Add `preconnect` + `dns-prefetch` for fonts.googleapis.com / fonts.gstatic.com.
- Load the Google Fonts CSS non-blocking (`media="print"` swap trick or `preload` + onload), keeping `font-display: swap` so text paints immediately in a fallback font.
- Keep the exact same font families/weights — no visual change.

### 3. Preconnect to the backend
- Add `<link rel="preconnect">` for the Lovable Cloud API origin so the first auth/data request starts ~100–300 ms sooner.

### 4. Bundle the boot translations
- Inline the small boot translation namespaces (common + landing, ar/en/he) into the JS bundle instead of fetching them over HTTP after boot; dashboard and other namespaces stay lazy-loaded as today.
- Keeps the i18n key-parity guard green; no `t()` usage changes.

### 5. Route-level code splitting check
- Confirm the production build emits per-route chunks (not one eager graph) and add intent-based link preloading with a short cache window so repeat navigation feels instant.

## Out of scope
- No business logic, data flow, RLS, commissions, or routing behavior changes.
- No new dependencies.

## Verification
1. `npm run build` and the i18n parity guard + focused tests pass.
2. Playwright on 390×844 (DPR 3, Slow-4G, cold cache): Homepage, Contact, Apply show the branded shell instantly and primary content within ~1 s; no hydration mismatch or console errors.
3. Arabic and English render correctly; no missing-key placeholders; language switch works.
4. No horizontal overflow at 390 / 1024 / 1280 px; CLS stays 0.000.
5. Warm navigation between routes shows the destination shell immediately.

## Technical notes
- Touch points: `index.html`, `src/i18n.ts`, `src/router.tsx`, possibly `src/main.tsx` splash-hide timing. The top-level `Suspense` in `main.tsx` stays (deployment invariant).
- Splash markup is plain HTML/CSS in `index.html` — zero JS cost, works even if scripts fail.
