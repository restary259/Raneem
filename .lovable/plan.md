# Fix: case-picker dropdown in "New appointment" dialog can't be scrolled with mouse wheel or touch drag

## Reproduced and root-caused

Reproduced live in the Team › Appointments page (open "New appointment" dialog, open the case dropdown):

- The dropdown renders 16 cases with a genuinely scrollable viewport (scrollHeight 520 vs visible 358), but `scrollTop` stays at 0 no matter how much the wheel is turned.
- Instrumentation shows the wheel event reaches the dropdown and ends with `defaultPrevented: true`.
- Cause: the appointment dialog is a **modal** Radix Dialog, which uses `react-remove-scroll` to lock scrolling of everything outside the dialog (body had `data-scroll-locked`). The Select dropdown is **portaled to `document.body`**, so it sits *outside* the dialog's allowed shard and every wheel/touch-scroll gesture over it is cancelled by the scroll lock.
- This is not specific to the appointments page: **any `Select` (or `Popover`) opened inside any modal Dialog/Drawer in the app has the same defect** — the fix must be at the shared component layer, not in the appointments page.

## Fix (shared component layer, one attribute each)

1. `src/components/ui/select.tsx` — add `data-remove-scroll-container` to `SelectPrimitive.Content`. This is react-remove-scroll's documented escape hatch: it registers the portaled dropdown as an allowed scroll container inside modal dialogs, restoring native wheel scrolling on desktop and touch-drag scrolling on mobile. No visual or API change.
2. `src/components/ui/popover.tsx` — same attribute on `PopoverPrimitive.Content`, since portaled popovers (e.g. comboboxes) inside modals have the identical latent bug.

No changes to `TeamAppointmentsPage`, the dialog, or any business logic. Desktop wheel and mobile touch are both covered by the same mechanism (the scroll lock intercepts both wheel and touchmove).

## Verification

- Re-run the Playwright reproduction script: open the dialog, open the case dropdown, wheel-scroll, assert `scrollTop > 0` and `defaultPrevented === false`.
- Also verify a second Select-in-Dialog surface elsewhere in the dashboard now scrolls (category check).
- `npm run build` and `npx vitest run` must pass.

## Out of scope

No redesign of the picker, no change to which cases are listed, no change to dialog modality.
