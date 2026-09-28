# Fix the blank white screen when opening a WhatsApp chat

## What is causing it (confirmed in the code)
1. On phones, the whole desktop layout block is hidden (`hidden lg:grid`), with no exception for an open chat. But the open chat lives inside that block. So tapping a conversation hides the list, hides the dashboard top bar (full-screen chat mode), and shows nothing: a white page.
2. Second, smaller risk: full-screen mode switches on as soon as a conversation is chosen, but the chat itself only shows once that conversation is found in the loaded list. In the gap (or for a deep link / wrong id) the screen shows an unrelated "choose a conversation" panel with no Back button.

## What will change
1. **Chat always renders when one is open.** The layout block shows on phones whenever a conversation is selected, and the chat fills the whole screen (header, messages, message box). The empty-space fix on the list screen stays.
2. **Never blank, always a way back.** Three clear states inside the chat screen, each with a Back arrow:
   - Loading: header placeholder, message skeleton, message box already visible.
   - Could not load: "Unable to load messages" + Try again (keeps the chat selected).
   - Not found (bad link or removed chat): "Conversation not found" + Back to inbox.
   - Empty chat: "No messages yet — start the conversation below."
3. **Back button** clears the selection and the `?conversation=` link part, restores the top bar and bottom tabs, without reloading.
4. **Deep links** `/admin/messages?tab=whatsapp&conversation=<id>` and the team equivalent open straight into the chat.
5. **Look closer to the internal chat:** same pinned message box at the bottom (safe-area aware, never scrolls away), messages take the remaining height, scroll to newest on open, don't jump if you're reading older messages, compact header (back, name, number, stage/SLA, menu). Profile/CRM on phones opens from the menu as a bottom sheet.

## Not changing
- WhatsApp rules: 24-hour window, templates, consent, assignment, snooze, SLA, media, delivery ticks, realtime.
- No Admin/Team switch comes back; team keeps its restricted actions.
- No backend or database changes.

## Technical details
- `WhatsAppInboxPage.tsx`: grid wrapper `hidden lg:grid` -> `selectedId ? "grid" : "hidden lg:grid"`; chat column show condition `active` -> `selectedId`; list column hidden on mobile when `selectedId`.
- `conversationOnlyView`: branch on `selectedId && !active` -> loading (threads still loading) or not-found (loaded, no match) with Back; add `messagesLoading` / `messagesError` state around the `Promise.all` in the load effect with retry; `MessageList` gets `loading` prop for skeleton.
- `useChatFullscreen(!!selectedId)` kept; height chain audited (`h-full min-h-0` down to `flex-1 overflow-y-auto` list, composer `shrink-0` + `pb-[env(safe-area-inset-bottom)]`).
- Invalid `?conversation=` after threads load: show not-found, Back clears param.
- Verify: typecheck, existing WhatsApp tests + guard test; Playwright at 390x844 and 1280x720 (admin needs your 2FA code, so phone screenshots from you remain the final check).
