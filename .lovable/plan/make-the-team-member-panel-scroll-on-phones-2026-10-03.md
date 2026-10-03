# Make the team member panel scroll on phones

## Problem
On a phone, the team member panel (the one opened from Members) is frozen: you can't scroll up or down, so everything below Account Info is out of reach. This happens on both tabs, Overview & Financials and Permissions & Access.

## Cause
The panel already has a scrolling area, but it sits inside a box with no height limit, so it never actually scrolls. When nothing inside scrolls, the phone treats every swipe as a drag on the bottom sheet itself, so the page doesn't move.

## Fix (only `src/components/admin/MemberDetailDrawer.tsx`)
- [ ] On phones, make each tab's content area the scrolling part: give it a height limit with `flex-1 min-h-0 overflow-y-auto overscroll-contain`.
- [ ] Mark both tab areas with `data-vaul-no-drag`, so swiping inside them scrolls the content instead of dragging the sheet. The sheet can still be closed with the X button or the top handle.
- [ ] Give the phone sheet a fixed height of `h-[92dvh]` instead of `h-full max-h-screen`, so its bottom isn't pushed off the screen by the phone's toolbar.
- [ ] Leave the desktop side panel and the tabs strip as they are.

## Checks
- [ ] Typecheck and the related drawer tests.
- [ ] Use a 390px phone test page that renders this panel on its own (the admin login can't be used from here). Confirm both tabs scroll right to the bottom and the page never scrolls sideways.
