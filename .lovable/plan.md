# Appointments dialog: fix X close-button spacing + hover effect

## Problem (from annotated screenshot, /team/appointments → "New appointment" dialog)

- The dialog's close X (shared shadcn close button in `src/components/ui/dialog.tsx`, pinned `absolute right-4 top-4`) sits flush against the title row (calendar icon + "موعد جديد"), which also starts at the right edge in RTL — they visually collide.
- The X has only a subtle opacity change on hover (`opacity-70 hover:opacity-100`) — no visible hover affordance.

## Changes

1. **`src/pages/team/TeamAppointmentsPage.tsx`** (new/edit appointment dialog, ~line 904)
   - Reserve space for the close button: add physical right padding (`pr-8`) to the `DialogHeader`/`DialogTitle` row so the icon + title no longer touch the X (physical padding is correct for both RTL and LTR, since the X is pinned to the physical right in both).

2. **`src/components/ui/dialog.tsx`** (shared close button)
   - Give the X a proper hover affordance: keep it compact, add `rounded-md`, a hover background (`hover:bg-accent`), full opacity on hover, and a short transition — so it reads as a button, not a bare glyph. This applies consistently to every dialog in the app (same shared X everywhere).

## Verification

- `tsc`/build clean.
- Playwright: open /team/appointments, open the new-appointment dialog in Arabic, screenshot the header — X clearly separated from the title, visible hover state on the X.
- Spot-check one other dialog (e.g. reschedule) to confirm the shared close-button change looks right in both.
