# Show every WhatsApp conversation and message in the Admin Inbox

## What is already true

- Admin Inbox already has a WhatsApp tab, and it is the default tab.
- The conversation list already shows every WhatsApp conversation, not just the admin's own.
- Opening a conversation already loads its full message history with no cut-off, and new messages appear live without a refresh.
- The backend entry point that stores incoming WhatsApp messages, delivery states and send errors is in place and tested.

So the reason the admin sees nothing is not the dashboard: no incoming WhatsApp traffic is being delivered to this app yet, and nothing has ever been sent.

## Decisions taken

- Chats that happened before incoming delivery is switched on are not imported. WhatsApp offers no way to pull them.
- Admins see every conversation.

## The one step only you can do

In Connectors, open the WhatsApp Business connection and set **Incoming messages** to the receiver project. Until that is selected, no message can reach the dashboard. This redirects WhatsApp callbacks away from whatever is selected today, so confirm nothing else depends on them.

The receiver project also still needs its two Darb connection secrets added there before it can pass messages on.

Separately, the Arabic test message template is still awaiting WhatsApp's review. That only blocks us starting a chat, not receiving one.

## What I will change in the dashboard

1. **Honest connection banner.** The current empty text says incoming messages are not supported. Replace it with a short status line in the WhatsApp tab: connected number, whether incoming delivery is switched on, and what is missing when it is not. No invented data.
2. **Non-text messages.** A photo, voice note, document or location currently renders as a blank bubble because only text is shown. Show a clear labelled placeholder for each type instead, with the sender and time.
3. **Unrecognised events.** Anything the gateway sends that we do not yet recognise is already stored rather than dropped. Surface a small admin-only counter so we notice them instead of losing them silently.
4. **Unread handling.** Opening a conversation marks it read, so the unread badges stay meaningful.
5. **Full-history check.** Confirm long conversations load entirely and scroll to the newest message on open, with day separators between dates.

## Technical notes

- Frontend work sits in `src/pages/messages/WhatsAppInboxPage.tsx` and `src/services/WhatsAppService.ts`; the admin tab wrapper in `AdminInboxPage.tsx` stays as is.
- Message-type placeholders read `message_type` / `media_provider_id` on `whatsapp_messages`; media itself is never fetched or copied into this app.
- Mark-as-read updates `whatsapp_conversations.unread_count` only; no change to assignment, stage, consent or advisor.
- The unrecognised-event counter reads `whatsapp_ingest_log`, admin-only.
- New strings go into `public/locales/{en,ar}/whatsapp.json` together, Arabic RTL included.
- No change to sending rules, the 24-hour window, template approval, AI drafting, or row-level security.

## How we verify

Once incoming delivery is selected, send one WhatsApp message from a real phone to the business number and confirm it appears in the Admin Inbox WhatsApp tab within seconds, attached to the correct contact, with the right time and text — and that a second message lands in the same conversation rather than creating a duplicate.
