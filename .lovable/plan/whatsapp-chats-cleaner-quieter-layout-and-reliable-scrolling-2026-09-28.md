# WhatsApp chats: cleaner, quieter layout and reliable scrolling

This is a visual and layout pass on the Admin and Team WhatsApp inbox. Sending, templates, stages, assignment, snooze, live updates and permissions all keep working exactly as they do now.

## 1. Less clutter in the open chat

**Chat header: one clean row**
- Shows the back arrow, the name (tap to edit), the number underneath, and one small stage chip.
- The conversation state dropdown ("Open / Waiting / Closed…") moves out of the header and into a single "⋯" menu, together with consent, priority, snooze and the lead-details button.
- Only badges that need action stay in the header: "SLA overdue" and "Snoozed". The consent and priority badges leave the header and appear in the lead panel.

**Identity and CRM strips**
- On phones, the identity panel and the CRM summary strip no longer sit between the header and the messages, where they take up space. Both move into the lead-details sheet, which opens from "⋯".
- On desktop, the right-hand lead panel stays. The identity panel is shown there instead of above the messages.

**Message box**
- The 24h window indicator becomes a quiet line inside the message box footer. It turns red only when the window has expired.
- The `+` menu keeps assign, priority, snooze, follow-up and quick replies, laid out as a tidy list instead of a row of wrapped buttons.
- When the window is closed, the template picker replaces the text box. Right now it stacks underneath the text box.

**Messages and list**
- Message spacing, bubble sizes and day labels get tighter, with smaller timestamps.
- In the conversation list, each row shows avatar, name, one-line preview, time and unread count. Nothing else.

## 2. Scrolling fixes

**Diagnosis first (not confirmed yet)**
The layout nests several full-height containers: the page, the tabs, the grid, the chat column and the message log. Before changing anything, I will measure the live message log on desktop and at phone width. That shows which container fails to stay height-limited and cuts off the messages instead of scrolling them.

**Goal once fixed**
- **Desktop:** the conversation list, the message history and the lead panel each scroll on their own. The page itself never scrolls, and the header and message box stay put.
- **Phone:** the open chat fills the screen. Only the messages scroll. The message box sits directly above the keyboard, and pulling down does not drag the page.
- **Opening a chat:** it lands on the newest message, and loading older messages keeps your place in the history.

## Technical details
- Files: `src/pages/messages/WhatsAppInboxPage.tsx` (the header, composer and `conversationOnlyView` shell) and `src/components/messages/whatsapp/{MessageList,ConversationRow}.tsx`.
- Every flex ancestor down to the ai-elements `Conversation` gets `min-h-0` / `flex` / `overflow-hidden`, so the `Conversation` element is the only vertical scroller. Nested `h-full` wrappers without flex get removed.
- Only existing semantic tokens are used. Any new labels are added to en, ar and he.
- **Verification:**
  - Playwright at 1280px and 390px: the message log should report `scrollHeight > clientHeight`, and `scrollTop` should change when scrolled.
  - Header and composer stay fixed while the log scrolls.
  - Focused WhatsApp tests and the i18n parity test pass.
