# Fix: empty white space above WhatsApp search (mobile)

## Cause
On phones, the WhatsApp inbox draws two stacked areas that each claim half the screen:
1. The desktop layout grid (conversations / chat / details). All its columns are hidden on phones, but the grid itself is still shown and still takes up space.
2. The phone layout (search + chat list).

Both are set to "fill remaining space", so the screen is split roughly in half. The empty top half is the invisible desktop grid, which pushes search and the list to the bottom.

## Fix
Hide the desktop grid container itself on phones (show it only from the large breakpoint up). The phone layout then fills the full height, search sits directly under the Admin / Team view toggle, and the list gets the rest of the screen.

No change to desktop, chat behavior, or data.

## Technical details
- `src/pages/messages/WhatsAppInboxPage.tsx` line ~820: add `hidden lg:grid` to the grid wrapper's class list (it currently uses `grid ... flex-1` with no mobile hide, while the sibling mobile wrapper at ~1021 is `flex flex-1 lg:hidden`).
- Verify: typecheck, then mobile viewport (392px) check that search sits right under the toggle and the list scrolls.
