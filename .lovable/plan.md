# Agent Dashboard — Mobile Bottom Nav Verification

Read-only verification run (no product changes expected unless a defect is found).

## What is already confirmed from the code
- `MobileBottomNav` renders 4 primary agent tabs (Overview, Network, Earnings, Messages) plus a "More" sheet with Students, Apply, Account.
- Every agent nav target resolves to a real route in `App.tsx` (`/agent`, `/agent/network`, `/agent/earnings`, `/agent/messages`, `/agent/students`, `/agent/apply`, `/agent/profile`).
- The bar is `fixed bottom-0 z-50 min-h-16 pb-safe`; `DashboardLayout` adds matching bottom padding and hides the bar while a chat is fullscreen.

## Verification steps
1. Sign a preview session in as an agent account and load the dashboard at a 390x844 mobile viewport.
2. For each of the 4 primary tabs and the 3 "More" items: tap, confirm the correct route loads, the active tab highlights, and the "More" sheet closes after navigation.
3. Scroll each page to the bottom and confirm the last content row, buttons, and any sticky footers are not hidden behind the bar (checking real safe-area padding, not just the class).
4. Confirm the AI chat bubble does not overlap the bar on any agent route, and that opening a chat thread hides the bar as intended.
5. Repeat the overlap and contrast checks in light, dark, and aurora themes via the theme picker, capturing one screenshot per theme.

## Deliverable
A short report per route/theme: pass or fail, with screenshots for anything that overlaps, mis-highlights, or renders with wrong theme tokens. If defects appear, list them with the file to change; fixes come in a follow-up once you approve.
