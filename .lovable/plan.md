# Fixed dashboard top bar, hidden in chats, no drag on swipe

## Why it moves today
The dashboard frame is set to the "screen height", which on phones (especially iPhone Safari) is taller than the visible area. That lets the whole page scroll and bounce, so swiping down drags the top bar along with it.

## What will change
1. **Top bar pinned in place on every dashboard** (Admin, Team, Partner, Agent, Student). The frame will fill exactly the visible screen and stay fixed there. Only the content area underneath scrolls. Swiping down won't pull the bar or the page with it: the rubber-band bounce is switched off on dashboard pages only, and the public site keeps its normal scrolling.
2. **Top bar hidden inside an open chat, on phone and desktop.** When you open a conversation, the top bar disappears so the chat gets the whole height. It comes back when you tap the back arrow. The bottom tab bar keeps its current behaviour: it's hidden only in phone chats.
3. The chat keeps its own header (back arrow, name, call button) visible at the top, respecting the phone's notch.

## Technical details
- `DashboardLayout.tsx`: outer wrapper `h-screen` becomes `fixed inset-0 h-[100dvh]`, and the header gets `touch-none` so dragging on it doesn't scroll. `main` keeps `overscroll-y-none`. While mounted, add a `dashboard-locked` class on `<html>`/`<body>` (`overflow:hidden; overscroll-behavior:none`, defined in `src/styles.css`), and remove it on unmount.
- Header visibility: change `chatFullscreen && "max-md:hidden"` to `chatFullscreen && "hidden"`.
- Chat pages (`CaseMessagesInboxPage`, `PartnerMessagesPage`, `StudentMessagesPage`, `WhatsAppInboxPage`): call `useChatFullscreen(!!selected)` on all screen sizes. Split the flag so `MobileBottomNav` and the main bottom padding still apply only on mobile (the nav is already `md:hidden`, so a single flag is fine).
- Verify with `bun x tsgo` and Playwright at 393px and 1280px: the header stays put after a swipe/scroll and disappears when a chat opens.
