# Cross-device Web Push verification (iPhone + Samsung + desktop)

Goal: keep the existing standards-based push stack exactly as it is (Push API, Notifications API, service worker, VAPID, existing backend fan-out) and prove it works on Samsung and desktop, fixing only real Android/Samsung defects found.

## What I can and cannot test

I can run a real end-to-end push test inside the sandbox against desktop Chromium (permission grant, real subscription creation, row stored per device, real encrypted push delivered by the backend, notification click deep link). I cannot hold a Samsung Galaxy or an iPhone, so for those the plan produces a scripted device checklist plus a built-in diagnostics screen that reports the exact failure reason from the phone itself, instead of guessing.

Two things to confirm before device testing:

- The project currently has no custom domain attached — push subscriptions are origin-locked, so devices must be tested on the published address the users actually use. If a custom domain is planned, subscriptions created on the old origin will not carry over.
- Test accounts: I need one real Team-role test login usable on the phones.

## Findings from the code audit (already confirmed)

The architecture is correct and needs no replacement:

- Subscriptions are stored per endpoint (`push_subscriptions`, unique on endpoint), so one user can hold iPhone + Samsung + desktop rows at once.
- The dispatcher fans out to every active subscription of the user and deactivates only the individual endpoint that returns 404/410 — it never disables the user.
- Subscribe/unsubscribe are authorization-checked against the caller's own user id; only admins can target another user.
- Payload carries title/body/url/category only — no student PII fields.

Three real Android/Samsung-facing defects were found:

1. **Notification badge icon is the full-colour logo.** Android and Samsung Internet render `badge` as a monochrome mask, so the status-bar badge will show a grey/white blob. iOS ignores `badge`, which is why this never surfaced.
2. **Manifest icon size mismatch.** Every icon entry points at one 500x500 PNG but declares 72 through 512. Samsung Internet's Add-to-Home-Screen and maskable icon handling are stricter than iOS here; the 512 entry is a lie about the real file.
3. **Sign-out leaves the device subscription attached to the previous user.** Caches are cleared on logout but the push subscription is not released, so a phone can keep receiving the previous account's notifications until someone signs in again on that device.

## Plan

### 1. Automated real-push E2E (desktop Chromium)

Add a Playwright spec that runs against the real backend:

- grants the Notifications permission, registers the service worker, subscribes
- asserts a real Push API subscription with the VAPID key is created
- asserts a `push_subscriptions` row exists for the signed-in test user and no other
- triggers a real backend send and asserts delivery, then asserts the click target URL

This is the regression net; it covers desktop Chrome and Edge (same Chromium push path).

### 2. Fix the three defects (no architecture change)

- Add a dedicated monochrome badge asset and use it for `badge` only; keep the colour logo for `icon`.
- Correct the manifest icon entries to the real asset sizes, adding properly sized 192 and 512 icons and separating `maskable` from `any`.
- On sign-out, unsubscribe this device's endpoint through the existing `push-notify` unsubscribe action before clearing the session, so subscriptions stay bound to the right account.

### 3. On-device diagnostics screen

Extend the existing push settings panel with a small read-only diagnostics block: capability, permission, service-worker scope, subscription endpoint host, and the last delivery result for this device. This turns "it didn't work on my Samsung" into an exact cause without a debugger attached to the phone.

### 4. Routing verification

Verify each notification category resolves to a route that exists for the recipient's role: message → that thread, case update → that case, appointment, payment → finance, document request → documents, profile action → profile, partner/recruit → the recruitment page. Any category producing a link that 404s for its role gets its link corrected at the producer.

### 5. Device test script (manual, run by you)

A short checklist per platform — Samsung Internet, Samsung Chrome, Android Chrome, iPhone standalone — covering permission, subscription creation, subscription storage, background delivery with the app closed, notification tap, deep link, and multi-device fan-out with iPhone + Samsung enabled on the same account. Each step records PASS/FAIL and the diagnostics readout, so any failure comes back with the real browser/service-worker cause.

### 6. Final report

A PASS/FAIL table per platform: iPhone, Samsung Internet, Samsung Chrome, Android Chrome, Desktop Chrome, Desktop Edge — filled in automatically for the desktop rows and from the device runs for the mobile rows.

## Technical notes

- Files touched: `public/service-worker.js` (badge asset only), `public/manifest.json`, a new monochrome badge under `public/`, `src/lib/webPush.ts` and the sign-out path for the logout unsubscribe, `src/components/notifications/PushNotificationSettings.tsx` for diagnostics, plus a new `e2e/push.spec.ts`.
- No change to `supabase/functions/push-notify`, `push-dispatch`, `_shared/webpush.ts`, the queue, or the subscription schema.
- No Samsung-specific code path is introduced; every fix is a standards-conformance correction that benefits all browsers.
