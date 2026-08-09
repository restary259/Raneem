# DARB — Real Web Push for the PWA (iPhone Home Screen)

## Where we stand today (verified by scanning the project)

| Area | Current state |
| --- | --- |
| Manifest | `public/manifest.json` — `display: standalone`, `scope: "/"`, `start_url: "/?source=pwa"`, RTL Arabic, icons present. Valid for iOS Home Screen. |
| Service worker | One worker only: `public/service-worker.js` (210 lines), registered from `src/utils/pwaUtils.ts` via `src/App.tsx`. It already has a `push` and a `notificationclick` listener, but both are minimal: no payload contract, no window focus/reuse, `openWindow` always. |
| Push table | `push_subscriptions` exists with `id, user_id, endpoint, p256dh, auth_key, created_at`. **0 rows** — nothing has ever subscribed. No device metadata, no health columns, no unique constraint verified in code path (`upsert` targets `user_id,endpoint`). |
| Push sender | `supabase/functions/push-notify/index.ts` exists and authenticates correctly, but the `send` action is a **stub** — it counts subscriptions and replies `"Configure VAPID keys to enable actual push delivery"`. No encryption, no VAPID, no HTTP request to any push service. |
| VAPID keys | None exist. No `VAPID_*` secret is configured. |
| In-app notifications | `notifications` table is live (48 rows) with bilingual `title_ar/title_en/body_ar/body_en`, `link`, `case_id`, `source`, `read`. Produced by database triggers/RPCs (`source` values: `system`, `direct_message`, `student_profile_updated`, `payout`, `case_message`). UI is `NotificationBell.tsx`. |
| Preferences | No notification preferences, categories, or quiet hours anywhere. |
| Infrastructure | `pg_net`, `pg_cron`, `pgmq`, `supabase_vault` all installed — the same pipeline the email system already uses. |

**Bottom line:** the PWA shell is fine, the in-app notification center is real, but Web Push is not implemented — the sender is a placeholder. Nothing in the app is faking a subscription today, so there is no deception to unwind, only a real implementation to build.

## Design decisions

1. **One service worker.** Extend `public/service-worker.js`. No second worker, no `vite-plugin-pwa`.
2. **One trigger point.** Every push originates from an insert into `notifications`. Triggers already write there, so push automatically covers messages, payouts, profile updates, and case events without rewriting the producers. Server-side authorization is inherited: whoever the trigger set as `user_id` is the only recipient.
3. **Queue, don't block.** An `AFTER INSERT` trigger on `notifications` enqueues into pgmq; a cron-driven Edge Function drains it. No user-facing request ever waits on a push.
4. **Payloads carry no personal data** — title `DARB`, a generic body, and a route. Data loads after authenticated navigation.
5. **Production domain only** — `https://darb.agency` for `start_url`, notification click targets, and any absolute URL. Subscriptions created in a Lovable preview origin are a different origin and simply won't exist in production.

## Phase 1 — Keys and data model

- Generate a P-256 VAPID key pair once. Public key ships as a build-time constant; private key is stored as a secret (`VAPID_PRIVATE_KEY`, plus `VAPID_SUBJECT = mailto:...`) and never leaves the Edge Function.
- Migration on `push_subscriptions`: add `user_agent`, `platform`, `browser`, `updated_at`, `last_success_at`, `last_error_at`, `last_error_status`, `revoked_at`, `active boolean default true`; unique index on `endpoint`; keep the existing RLS (own-row only) and add an own-row UPDATE policy so a device can refresh its own record.
- New `notification_preferences` (one row per user): `push_enabled`, `email_enabled`, per-category booleans (messages, appointments, cases, payments, documents, profile, recruitment, system), `quiet_hours_start`, `quiet_hours_end`, timezone. Own-row RLS.
- New `push_delivery_log`: notification id, user id, subscription id, status code, result, error reason, attempt count, timestamps. Admin-read only; stores no notification body.
- Extend `notifications` with `category` and `priority` (`high` / `medium` / `low`) plus a nullable `dedupe_key` with a unique partial index for idempotency.

## Phase 2 — Client subscription flow

- `src/lib/webPush.ts`: capability detection (SW + `PushManager` + `Notification`), permission read, `subscribe()` / `unsubscribe()`, and subscription reuse (`pushManager.getSubscription()` before creating a new one).
- `src/pages/settings/NotificationSettingsPage.tsx` (linked from every dashboard sidebar): explicit **"تفعيل الإشعارات"** button — permission is requested only from that tap, never on load. Renders the four states: not-requested, granted, denied (with device-settings guidance, no re-prompt loop), unsupported (with an iOS hint to add to Home Screen first). Below it: push/email master toggles, category toggles, quiet hours.
- Badge sync: `navigator.setAppBadge()` / `clearAppBadge()` driven by the existing unread count, guarded by feature detection.

## Phase 3 — Service worker upgrade

Extend the existing worker only:
- `push`: parse JSON payload, always call `showNotification` (Safari requires a visible notification), set `tag` for coalescing and `data.route`.
- `notificationclick`: `clients.matchAll({ includeUncontrolled: true })` → focus an existing DARB window and `postMessage` the route so the SPA navigates in place; only `openWindow` when no window exists. Never spawn duplicates.
- App-side listener routes the message through React Router, so an unauthenticated user lands on login and continues to the intended route afterwards.

## Phase 4 — Delivery server

- `supabase/functions/push-dispatch`: cron-driven queue drainer. For each queued notification it loads the recipient's preferences (skips when the category is off; defers non-`high` notifications during quiet hours while keeping them in the notification center), loads the user's active subscriptions, and sends one encrypted request per device.
- Encryption and VAPID via a Deno-native Web Push library (`jsr:@negrel/webpush`) implementing RFC 8291 `aes128gcm` + RFC 8292 VAPID — the same path Apple's push service requires. `TTL` and `Urgency` set from priority.
- Response handling: 201 success → `last_success_at`; 400/403 → log and alert; 404/410 → mark the subscription `revoked_at` + `active = false` so it is never retried. Every outcome written to `push_delivery_log`; no keys or tokens logged.
- Chat suppression: skip push when the recipient's presence shows them viewing that exact thread.
- `push-notify` keeps subscribe/unsubscribe and gains an authenticated **"send test to myself"** action; arbitrary user-to-user sending stays impossible from the client.

## Phase 5 — Verification

- Unit tests: preference gating, quiet-hours logic, dedupe, 410 cleanup, payload sanitiser (asserts no passport/финance fields ever enter a payload).
- Automated E2E in Chromium: grant permission, create a real subscription against the production VAPID key, assert the row lands in `push_subscriptions`, dispatch a notification, assert a 201 from the push service and a `push_delivery_log` row.
- Role matrix test: insert a notification for each role and assert only the intended recipient's subscriptions are selected.
- **iPhone test is yours to run** — I cannot drive a physical device. I will hand you an exact checklist (open `https://darb.agency` in Safari → Share → Add to Home Screen → open from the icon → log in → Settings → Notifications → enable → "send test") and I will read the delivery log to confirm what the push service returned for your device.

## Known limitations (stated up front)

- iOS only delivers Web Push to a Home Screen web app on iOS 16.4+; Safari in a normal tab will report unsupported. The UI says so explicitly instead of failing silently.
- Subscriptions are per-origin: anything registered on a preview URL will not receive production pushes.
- Delivery to a powered-off device depends on APNs queueing and the TTL we set; there is no delivery receipt beyond the push service's HTTP status.

## Technical notes

- No new PWA plumbing: `vite-plugin-pwa`, Workbox, and any second worker file are explicitly out of scope.
- The public VAPID key is safe in the bundle; the private key exists only as an Edge Function secret and is never returned by any endpoint.
- Existing email flows are untouched — push is added as a parallel channel gated by the same preference row.
