# Fix the jumpy appointment popup animation

## What's wrong (confirmed in code)
The popup that opens when you tap a calendar box uses the shared dialog in `src/components/ui/dialog.tsx`. Its open animation still uses classes written for the old Tailwind v3 animation plugin:

`data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]` (and the matching close classes).

The project now runs Tailwind v4 + `tw-animate-css`. There, centering (`translate-x-[-50%] translate-y-[-50%]`) uses the CSS `translate` property, while the animation keyframe adds its own `transform: translate3d(-50%, -48%)`. The two stack, so the card starts about half its own width/height up and to the left and snaps to the center within ~150–200 ms. That's the fast "fly in from the corner" look instead of a smooth fade.

## Fix
1. In `src/components/ui/dialog.tsx` `DialogContent`, remove the four `slide-in-from-*` / `slide-out-to-*` classes. Keep fade + `zoom-in-95` / `zoom-out-95`.
2. Use a slightly softer timing: `duration-200 ease-out` on open, keeping the close quick.
3. Check the same old-style slide classes in `alert-dialog.tsx` (and any other centered popup) and fix them the same way.
4. Users with "reduce motion" turned on still get no animation (existing rule in `styles.css` stays).

This fixes every popup in the app, not just Appointments. No logic changes.

## Verification
- Playwright on /team/appointments: tap a box, take screenshots at 0/50/120/250 ms. The card must stay centered and only fade/scale.
- Spot-check one other popup (reschedule, a confirm dialog).
- Typecheck clean.
