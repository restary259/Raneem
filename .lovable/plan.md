# Fix: Team dashboard freezes after closing the appointment popup without picking a case

## What I confirmed (reproduced, not assumed)

Signed in as the team account in a test browser, opened Appointments, clicked a calendar box, opened the "Existing case" dropdown, then clicked outside without choosing. Result:

- Both the dropdown and the popup closed.
- The page `<body>` was left with `pointer-events: none`.
- Nothing on the page could be clicked afterwards (Playwright click timed out) — exactly the "frozen until refresh" you see.

## Root cause

Two different copies of the same Radix internal package (`react-dismissable-layer`) are installed:

- `@radix-ui/react-dialog` 1.1.2 (the popup) bundles copy **1.1.1**
- `@radix-ui/react-select`, `react-popover`, `react-menu` (dropdowns) bundle copy **1.1.19**

Each copy keeps its own private list of open layers and its own "original body pointer-events" memory. When the popup and the dropdown close in the same click, the dropdown's copy restores the body to the value it saw when it opened — which was already `none` (set by the popup) — and nobody ever clears it. This is a package-version mismatch, not a bug in the appointments page code.

## Where else this can happen (scan result)

Any dropdown/popover/menu opened *inside* a popup shares the same defect. In the team dashboard that is:

- `src/pages/team/TeamAppointmentsPage.tsx` — new/edit appointment popup (case dropdown, duration dropdown, date popover)
- `src/components/team/ProfileCompletionModal.tsx`
- `src/pages/team/CaseDetailPage.tsx`

Two earlier band-aids in the catalog (`PhotoLightbox.tsx`, `AccommodationDetail.tsx` force `pointer-events: auto`) are symptoms of this same root cause.

## The fix

1. **Align the Radix packages so only one `react-dismissable-layer` copy exists.** Update the outdated ones in `package.json` to their current 1.x/2.x releases: `react-dialog`, `react-alert-dialog`, `react-dropdown-menu`, `react-tooltip`, `react-context-menu`, `react-hover-card`, `react-menubar`, `react-navigation-menu`, `react-toast`, `react-popover`, `react-select` (same major versions — no API changes for the shadcn wrappers). Reinstall and verify with a filesystem check that exactly one `react-dismissable-layer` remains.
2. **Add a safety net** in `src/components/ui/dialog.tsx` / `sheet.tsx` / `alert-dialog.tsx`: on close, after the exit animation, if no other modal layer is open, clear a leftover `body.style.pointerEvents`. This guards against any future dependency drift causing the same freeze.
3. **No changes** to appointment logic, forms, saving, or any other behaviour.

## Verification

- Re-run the same Playwright reproduction: after the outside click, `body.style.pointerEvents` must be empty and the page must be clickable.
- Repeat the check on the Profile Completion modal and Case Detail page dropdowns.
- `npm run build` and the existing test suite must stay green.
