# Fix: blank screen when opening a WhatsApp chat + centered section tabs

## 1. Chat opens to a white screen (phones)
**Cause:** the last fix hid the whole desktop layout on phones. But the open-chat screen on phones lives inside that same layout (the phone layout only shows the list). So tapping a conversation hides the list and shows nothing.

**Fix:** hide the desktop layout on phones only while no chat is open. When a chat is open, show it full-screen as before. The empty-space fix stays in place (the list screen still has no gap).

## 2. Section tabs always centered
Right now the admin switches between Inbox / Dashboard / Delivery health / Templates through the "more" menu, and the team view has a left-aligned tab row.

**Fix:** show one centered tab row (Inbox, Dashboard, Delivery health, and Templates for admins) under the Inbox header, matching the centered Messages / WhatsApp tabs at the top. It scrolls sideways on narrow phones instead of wrapping. The "more" menu keeps only refresh and number/status info. Hidden while a chat is open so the chat stays full-screen.

## Technical details
- `src/pages/messages/WhatsAppInboxPage.tsx` ~line 820: grid class `hidden lg:grid` → `active ? "grid" : "hidden lg:grid"`.
- ~line 1097 (team mode TabsList): `justify-start` → `justify-center`, add `mx-auto`.
- Admin header (~1114–1135): add a centered `TabsList` (`mx-auto flex w-fit max-w-full justify-center overflow-x-auto`) bound to `view`; remove the Dashboard/Health/Templates items from the dropdown and the "back to inbox" button; hide the row when `active` on mobile.
- Verify: typecheck; 392px viewport — list has no gap, tapping a chat opens it, tabs centered.
