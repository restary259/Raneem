# Notification targeting audit + chat UX (WhatsApp-style)

## What the audit already confirmed (read-only)

Current architecture is already per-recipient, not a global broadcast:

- `notifications` rows always carry `user_id`; `emit_notification(...)` is the single writer and refuses to notify the actor themselves, with a `dedupe_key` unique index for retry/double-click protection.
- `notify_case_event()` resolves recipients from the case row itself (`assigned_to`, `partner_id`/`referred_by`, `student_user_id`) plus an explicit loop over `user_roles WHERE role='admin'` — no "all team" or "all partners" fan-out.
- Push: `push-dispatch` reads one notification, looks up `push_subscriptions WHERE user_id = notification.user_id AND active = true`, honours `notification_preferences` (per-category + quiet hours), retires 404/410 endpoints, and logs to `push_delivery_log`. VAPID keys stay server-side.
- `push-notify` derives identity from the JWT and rejects `subscribe`/`unsubscribe` for another `user_id`.

So the system is not leaking by design. The remaining work is verification plus the specific gaps below.

## Gaps to fix

1. **Message notifications don't name the sender.** `send_case_message` / `send_direct_message` write titles like "New case message" / "رسالة جديدة في الملف" and put the raw message text in the body. Requested behaviour is WhatsApp-style: title = sender display name (partners still see "Administration" via the existing chat-identity rule), body = short preview.
2. **Lock-screen privacy.** Message notifications currently embed up to 140 chars of raw body. Keep the preview for messages (that is the product expectation) but strip it for finance/document/case categories, and never include passport/IBAN/amount detail.
3. **Chat mobile layout is desktop-derived.** The inbox is a two-column grid collapsed with `md:hidden` toggles. Requested: a task-focused, WhatsApp-like mobile experience.
4. **Composer `+` menu is a small dropdown.** Requested: a WhatsApp-style action sheet grid (see the reference screenshot) containing Document, @Mention, #Case mention, Request payout, Internal note.

## Plan

### A. Notification content (backend, targeting unchanged)
- Update `send_case_message` and `send_direct_message` so the notification title is the sender's display name and the body is the trimmed preview. Partner/student recipients receive the "Administration" label for admin senders, matching `chatDisplayName`.
- Keep both `title_en`/`title_ar` populated so the push payload stays bilingual.
- Sweep non-message notification templates for sensitive values (amounts, passport, IBAN) and replace with generic wording plus a deep link.

### B. Verification pass (no schema change expected)
Run the negative tests as SQL/edge probes and record results in a matrix:
- cross-account: notification for user A never lands on user B's subscriptions;
- token ownership: `push-notify` rejects a spoofed `user_id`; `push_subscriptions` RLS blocks reads/updates of another user's rows;
- notifications RLS: read / mark-read / delete restricted to owner;
- case reassignment: after `assigned_to` changes, new events go to the new owner only;
- account switch / logout on one device re-owns or deactivates that endpoint;
- deep link does not bypass RLS (open a case link as an unauthorized role).
Anything failing gets fixed in the same pass; anything passing is reported as PASS with the evidence.

### C. Mobile chat layout (frontend only)
- On mobile, thread list and conversation become two full-screen views: list → tap → conversation with a sticky header (back arrow, avatar, name, presence/subtitle) and a sticky composer above the safe area. Desktop keeps the current split view.
- Message rows tightened WhatsApp-style: bubbles with tail, time and read state inside the bubble, day separators, sender name only in group/case threads.

### D. Composer action sheet
- Replace the `+` dropdown with a bottom sheet on mobile (dropdown retained on desktop) rendering a rounded-icon grid: Document, Mention, Case, Request payout, Internal note — each gated by the existing `allowInternal` / `allowRequests` / `allowCaseMentions` / `onRequestPayout` props, so no permission behaviour changes.
- Payout request keeps opening `PayoutRequestDialog`; case/mention entries insert the `#`/`@` token into the textarea as today.

### E. i18n + tests
- New keys added to both `public/locales/en/dashboard.json` and `ar`.
- Existing vitest suite must stay green; add a unit test for the sender-name notification title helper.

## Technical notes
- Backend changes are confined to two RPC bodies (`send_case_message`, `send_direct_message`) via migration; recipient resolution logic is untouched.
- No changes to `push-dispatch`, VAPID handling, or `push_subscriptions` schema unless a verification test fails.
- Frontend touches: `src/components/messages/{MessageComposer,MessageList,ThreadList}.tsx`, `src/pages/messages/*`, `src/components/cases/CaseMessages.tsx`.

## Deliverable
A final report with the architecture flow (event → recipient → device → push), the recipient rules per category, the security matrix with PASS/FAIL, remaining risks, and a single SAFE TO PROCEED / BLOCKED verdict.
