# Mobile chat: fixed composer, scroll-locked messages, LTR controls

Fix the mobile conversation screen so the message box stays put, only the message history scrolls, and the action buttons sit on fixed sides regardless of Arabic/English.

## What changes

### 1. Conversation is a locked full-screen surface on mobile

When a thread is open on a phone, the conversation takes over the screen:

```text
┌───────────────────────────┐
│ ← name / case ref  [bell] │  fixed header
├───────────────────────────┤
│                           │
│   messages (only part     │  scrolls
│   that scrolls)           │
│                           │
├───────────────────────────┤
│ [+]  write a message  [>] │  fixed composer
└───────────────────────────┘
```

- Header and composer never move; the page itself cannot scroll.
- The bottom tab bar is hidden while a conversation is open (the back arrow returns to the list).
- When the keyboard opens, the composer sits directly on top of it and the message list shrinks — no more empty gap or half-hidden input as in the screenshots.

### 2. Composer becomes one row with fixed sides

- `+` button always on the left, send button always on the right, in Arabic and English alike.
- Text field between them, growing up to a few lines.
- The helper line ("محادثة مباشرة بين الطاقم فقط") stops eating vertical space on mobile — it moves out of the composer (kept on desktop).
- Shared/internal toggle moves into the `+` sheet on mobile so the bar stays a single clean row.

### 3. Notification line "from درب"

This line is added by iOS itself for web-push notifications from an installed web app; it is not part of the message we send (our payload is only the sender name plus the preview). It cannot be removed from app code. The only thing we control is the app name shown there. Options: leave as is, or shorten/change the installed app name in the manifest — say the word and I will change it.

## Technical notes

- `src/components/messages/MessageComposer.tsx`: merge the textarea row and the action row into one flex row wrapped in a `dir="ltr"` container (the textarea keeps `dir="auto"` so Arabic text still reads right-to-left); move the hint and the visibility toggle out of the mobile bar.
- `src/pages/messages/CaseMessagesInboxPage.tsx`, `src/pages/messages/PartnerMessagesPage.tsx`, `src/pages/messages/StudentMessagesPage.tsx`: on mobile with a thread selected, render the conversation card as `fixed inset-0 z-50` with `h-[100dvh]`, header `shrink-0`, body `min-h-0 flex-1`, and add `overscroll-contain` to the scroller.
- `src/components/layout/DashboardLayout.tsx`: hide `MobileBottomNav` while a full-screen conversation is mounted (context flag or body-level data attribute set by the chat pages).
- `src/components/messages/DirectMessages.tsx` / `CaseMessages.tsx`: keep the message region as the only `overflow-y-auto` node; composer stays outside it.
- `index.html` already sets `interactive-widget=resizes-content`, so `100dvh` + fixed positioning is enough for the keyboard behaviour; no JS visualViewport hack needed.
- No backend, RLS, or notification-payload changes.          also while your at it make sure all side bar tab in dashboard render correctly 