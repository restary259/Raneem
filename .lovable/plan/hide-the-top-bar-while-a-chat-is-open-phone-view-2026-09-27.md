# Hide the top bar while a chat is open (phone view)

On phones the dashboard's top bar (language, theme, messages, bell, home, sign-out) sits on top of the open conversation and covers messages under the chat header, as your screenshot shows.

## Change
- While a conversation is open on a phone, fully hide the top bar, just like the bottom tabs are already hidden. It comes back as soon as you tap the back arrow.
- The conversation then fills the whole screen: header (back arrow, name, call, bell) at the top, messages scrolling in the middle, message box at the bottom. Nothing overlaps.
- Applies to every chat screen: admin/team inbox, WhatsApp inbox, partner/agent and student messages. Desktop stays unchanged.

## Technical details
- `src/components/layout/DashboardLayout.tsx`: the header already has access to `chatFullscreen` (`useChatFullscreenActive`). Add `max-md:hidden` to the top `<header>` when `chatFullscreen` is true (same flag used for `MobileBottomNav`).
- Verify with Playwright at 390px: open a conversation, confirm the header is gone and the chat header/composer are fully visible; back arrow restores the bar.
