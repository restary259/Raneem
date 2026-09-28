# WhatsApp inbox: make it look and work like the real WhatsApp app

## What's wrong now (from your screenshot, phone width)
- Before you see any chats, the page shows a title, a description, a connection line, a team/supervisor switch, "New conversation" and refresh buttons, the phone number, an office badge, and Chats/Tools tabs. That takes about 60% of the screen.
- A big empty block with colored stripes (the loading placeholder) sits between the header and the search box.
- Only one chat row fits above the bottom menu, so the list feels cramped and scrolls badly.

## Target: behave like WhatsApp

```text
Chat list (phone)              Open chat (phone, full screen)
+---------------------------+  +---------------------------+
| WhatsApp        (+) (...) |  | <-  (AM) AIHAM Majde  (...)|
| [ Search name / number  ] |  |---------------------------|
| All  Unread  New  Mine    |  |  soft patterned wallpaper |
|---------------------------|  |        [ 26 Sept ]        |
| (AM) AIHAM Majde   26 Sep |  | +----------------+        |
|      hi, no problem   (2) |  | | incoming  12:04|        |
| (RD) Raneem D      12:01  |  | +----------------+        |
|      ok thanks        vv  |  |        +---------------+  |
| ...                       |  |        | sent 12:05 vv |  |
|                           |  |        +---------------+  |
|                           |  |---------------------------|
|                           |  | (+) [ Message...  ]  (mic)|
+---------------------------+  +---------------------------+
```

### Chat list
- One slim top bar: "WhatsApp" title, a green/red connection dot, a "+" button (new chat), and a "..." menu containing: Team/Supervisor view, Refresh, Tools (dashboard, templates, delivery health), phone number and office status.
- Remove the page title, description and the separate status/tabs rows from the list screen.
- Search box, then scrollable filter chips (All, Unread, New, Assigned to me).
- Rows like WhatsApp: round avatar, bold name, time at the end, one-line last message preview, green unread count or delivery ticks. Thin dividers, no cards or badges crowding the row.
- Replace the striped loading block with a few simple skeleton rows.
- The list fills all space down to the bottom menu and scrolls smoothly on its own.

### Open chat
- Takes the whole phone screen (bottom menu and dashboard bar hidden, already partly done).
- Header: back arrow, avatar, name + short subtitle (phone or "last message 12:04"), call and "..." menu (details, status, assign, tags). Tapping the name opens the details sheet.
- Soft WhatsApp-style patterned background using theme colors (works in dark mode).
- Bubbles: incoming on one side in a light bubble, outgoing on the other in a green-tinted bubble, small tail, time and ticks inside the bubble corner, centered date pills, grouped consecutive messages with tighter spacing.
- Composer pinned at the bottom: round "+" (attachments/templates/quick replies as a clean list), a rounded message field that grows, and a mic/send button that switches as you type. Respects the phone keyboard and safe area.
- Opens at the newest message; older messages load when scrolling up; "jump to latest" button when scrolled up.
- When the 24-hour window is closed, the field is replaced by one quiet line + "Choose template" button.

### Desktop
- Same styling in two panes: list on the side, chat on the right with the same header, wallpaper, bubbles and composer; details panel opens only when requested.
- RTL-correct in Arabic/Hebrew (bubble sides and back arrow flip).

## Not changing
- No change to messages, sending, templates, assignment, permissions or backend. Visual/layout only.

## Technical details
- `src/pages/messages/WhatsAppInboxPage.tsx`: collapse `PageHeader`/embedded header, status row, and inbox/tools tab switch into one compact bar + overflow `DropdownMenu`; replace list `LoadingState variant="cards"` with row skeletons; list container `flex-1 min-h-0` with native `overflow-y-auto overscroll-contain`.
- `ConversationRow.tsx`: WhatsApp row layout (avatar 48px, name/time line, preview/unread line).
- `MessageList.tsx`: bubble tails, in-bubble time/ticks, grouping, date pills, wallpaper token.
- New tokens in `src/styles.css`: `--wa-outgoing`, `--wa-incoming`, `--wa-wallpaper` (light + dark).
- Composer: `pb-[env(safe-area-inset-bottom)]`, auto-grow textarea, mic/send toggle, `+` opens a list sheet.
- Verify with Playwright at 392x733 and 1280 wide, Arabic and English, using an injected admin session; run typecheck and i18n tests.
