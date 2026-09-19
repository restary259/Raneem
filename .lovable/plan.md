# Combine Admin Inbox and WhatsApp

## Goal
Create one admin Inbox destination with a dedicated WhatsApp tab, then verify the native WhatsApp connection by sending the approved Arabic test message to `0529402168` and checking the saved lead and message data.

## Current verified state
- Admin currently has two separate pages: Applications Inbox at `/admin/inbox` and WhatsApp Inbox at `/admin/whatsapp`.
- The native WhatsApp Business connection “Darb's WhatsApp Business” is linked and accessible.
- The WhatsApp tables already store the requested consulting lead fields, conversation state, messages, notes, assignment, consent, stage, and tags.
- No lead or conversation currently exists for `0529402168`.
- No approved WhatsApp templates currently exist. Because this number has no recorded inbound message and therefore no open 24-hour service window, WhatsApp requires an approved template before the first outbound test can be sent.

## Implementation

### 1. One admin Inbox
- Add **WhatsApp** as a top-level tab inside the existing admin Inbox alongside submissions, recruits, and data requests.
- Make the WhatsApp workspace render cleanly inside that tab without a duplicate page heading or nested page-level navigation.
- Keep all existing application, recruit, data-request, export, search, and WhatsApp functionality intact.
- Remove the separate admin WhatsApp sidebar/mobile item to avoid duplicate destinations.
- Redirect old `/admin/whatsapp` bookmarks to `/admin/inbox?tab=whatsapp`.
- Keep `/team/whatsapp` unchanged because the existing Applications Inbox is admin-only.
- Preserve the selected Inbox tab in the URL so refreshes and shared links reopen WhatsApp directly.

### 2. Safe outbound-test workflow
- Add a staff-only “start WhatsApp conversation” action that normalizes the Israeli number to WhatsApp format, creates or reuses exactly one lead and one conversation, and never duplicates an existing number.
- Seed only known values for this test: WhatsApp number, source=`whatsapp`, stage=`new`, consent=`unknown`, and default conversation state. Leave unknown student fields blank rather than inventing them.
- Use the approved Arabic message:
  > مرحباً، هذه رسالة تجريبية من مكتب درب للتأكد من ربط صندوق واتساب بنجاح.
- Submit/sync a compliant WhatsApp template for this first business-initiated message. Do not bypass the 24-hour rule or falsely mark an unapproved template as approved.
- Send only after the provider reports the template as `APPROVED`. If review remains pending, show that exact blocker and leave the test ready to send after approval.

### 3. Verification
- Confirm the provider accepts the message and returns a message ID.
- Confirm the lead record contains the normalized number and correct known/default fields.
- Confirm the conversation references that lead, records the outbound timestamp and preview, and remains staff-only.
- Confirm the outbound message is stored once with direction `outbound`, the provider message ID, template name, and delivery state.
- Sync/read delivery updates when available; do not claim phone delivery from provider acceptance alone.
- Verify desktop, mobile, Arabic RTL, old-route redirect, admin access, and team WhatsApp access.

## Acceptance criteria
- Admin sees one **Inbox** navigation item and a visible **WhatsApp** tab inside it.
- Existing Inbox sections and exports still work.
- The number `0529402168` maps to one lead/conversation with no fabricated profile details.
- The test message is sent only through the native connector and only under WhatsApp’s template/service-window rules.
- The final report distinguishes template approval, provider acceptance, database persistence, and confirmed delivery.
