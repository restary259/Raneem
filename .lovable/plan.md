# WhatsApp rebuild: audit, then phone chat, scrolling, and Direct Send

The work happens in four steps, in order. Each step keeps everything that already works: templates, assignment, consent, delivery health, notes, tags, notifications, and appointment automation.

## Step 1 — Written audit (no changes)

A report saved to your Files that covers the screens, data, live updates, sending, security and permissions, plus a capability table (works / partial / missing) for each of the ~40 areas in your brief. It also ranks the remaining gaps so later steps can be chosen from it.

## Step 2 — Chat screen on phones

- On a phone you see only the conversation list. Tapping a conversation opens it full screen, and a back arrow returns to the list.
- The message box stays pinned above the keyboard and never slides off screen. Safe spacing is kept on iPhones.
- Each list row shows the name (or "No name yet" plus the number), the last message, the time, and an unread count. There's only a small marker for owner and status, so rows don't fill up with badges.
- A compact chat header shows the name, the number, the owner, the consent badge and the 24-hour window. Less-used actions move into a menu.
- Desktop keeps the side-by-side layout, but uses the same pieces.
- Everything works in English and Arabic (right to left), with readable contrast and screen-reader labels.

## Step 3 — Scrolling and older messages

- A chat opens on the newest message instantly, with no visible scroll animation.
- Only the most recent 50 messages load first. Scrolling to the top loads older ones, and your reading position stays put.
- New messages follow you down only if you're already at the bottom. Otherwise a "New messages" button with a count appears.
- Live updates add the single new or changed message, instead of reloading the whole conversation.
- A sent message shows up immediately as "sending". It then updates to sent, delivered or read, or shows a failed state with a Retry button, and never appears twice.

## Step 4 — Automatic sending rules (Direct Send)

Direct Send lets DARB send service messages (like appointment confirmations) without pre-approving each template first. Every check runs on the server before anything is sent. Nothing the browser sends can skip these checks.

- **Inside the 24-hour window:** free replies work as they do today.
- **Outside the window, service messages** (appointment confirmed, reminder, rescheduled, missing documents, payment confirmed, application update) go out by Direct Send. Each one carries a fixed message name so it can be tracked.
- **Marketing never uses Direct Send.** It stays approved-template only, and only to contacts who agreed to receive it.
- **If Meta says Direct Send isn't enabled**, the app falls back to the matching approved template when one exists. Otherwise the message is marked failed with a clear reason in Delivery Health. It is never sent silently another way.
- An admin setting turns Direct Send on or off, so it can be switched off right away if Meta changes anything.

## Not in scope this round

Search across all messages, a second WhatsApp number, linking chats to case records, Hebrew, and a redesign of the marketing campaigns screen. The audit will list these for a later round.

## Technical notes

- Split the 1,257-line `WhatsAppInboxPage.tsx` into `ConversationList`, `ConversationView`, `MessageList`, `Composer` and `ChatHeader` under `src/components/messages/whatsapp/`. The existing tab shell and routes stay the same.
- `WhatsAppService.listMessages` gets cursor pagination (`created_at` + `id`, `limit 50`). Realtime handlers merge only the changed row by id; optimistic rows are matched by client id and `provider_message_id`.
- Scrolling uses the proven one-shot "land on newest" pattern from `MessageList.tsx` (runs after layout, instant), keeps the reading position when older messages load, and checks whether the user is near the bottom.
- Mobile layout uses `100dvh`, `env(safe-area-inset-bottom)`, and the `visualViewport` API for the keyboard.
- `whatsapp-connector` gets a new `direct_send` path: it sends `category: "utility"` plus a named-template parameter to the existing `/messages` endpoint through the gateway. A server-side list of allowed purposes decides which messages qualify, and marketing is rejected outright. Meta error 100 "requires Direct Send" triggers the approved-template fallback, or a recorded failure when no template exists.
- New `platform_settings.whatsapp_direct_send_enabled` (admin-only); the automation queue functions read it. Changes are made through a manual-deploy migration.
- Tests cover pagination merging, optimistic reconciliation, the Direct Send allow list and fallback, marketing rejection, and English/Arabic parity for all new text.
