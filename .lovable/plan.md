# Cookie-banner delay fix

## Problem
`CookieBanner` currently appears with a noticeable lag on first visit because two independent timers gate it:

1. `App.tsx` mounts non-critical floating widgets only after `requestIdleCallback(..., { timeout: 2000 })` fires (fallback `setTimeout(..., 600)`).
2. `CookieBanner.tsx` then waits another `1500 ms` before calling `setVisible(true)`.

Worst-case delay is therefore ~3.5 s; even on browsers without `requestIdleCallback` it is ~2.1 s.

## Goal
Make the cookie banner appear almost immediately on first visit, without blocking the first paint or interfering with the homepage hero load.

## Proposed changes

### 1. Remove the extra internal delay in `CookieBanner.tsx`
- Delete the `setTimeout(..., 1500)` wrapper around `setVisible(true)`.
- Keep the localStorage check: if no consent is stored, show the banner on mount.
- Keep the `animate-in slide-in-from-bottom-4` entrance animation so it does not feel abrupt.

### 2. Shorten the idle-ready gate in `App.tsx`
- Change `requestIdleCallback(..., { timeout: 2000 })` to `{ timeout: 300 }`.
- Change the fallback `setTimeout(..., 600)` to `setTimeout(..., 200)`.
- Keep lazy-loading the widget chunk so the initial bundle is unaffected.
- Keep the `!isApplyPage && !isDashboardPath` exclusions.

### 3. Verify consent-gated analytics still works
- Confirm `accept('all')` still calls `initAnalytics()` and `trackPageView(window.location.pathname)`.
- Confirm `accept('necessary')` does not initialize analytics.

## Out of scope
- No visual redesign of the banner.
- No change to the consent categories (necessary vs analytics).
- No change to the PWA installer or WhatsApp button timing.

## Validation
- `npm run build` passes.
- `npx vitest run` passes (or at least existing CookieBanner-related tests, if any).
- Manual/Playwright check: on a fresh localStorage state, the banner appears within ~300 ms of the homepage paint.
