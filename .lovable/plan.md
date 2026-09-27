# CV Builder Arabic layout — keep side-by-side, fix the "معاينة" heading

## What you want
In Arabic the CV stays **next to** the form (side-by-side, like English). The only problem is the "معاينة" (Preview) heading: it should sit **directly above the CV sheet**, aligned with it, without pushing the CV sideways or out of place.

## Change (one file: `src/components/lebenslauf/LebenslaufBuilder.tsx`)

1. **Revert the RTL stacking** from the previous fix — Arabic goes back to the same two-column desktop grid as English (`lg:grid-cols-2`, form + preview side by side, split scrolling in the dashboard).
2. **Fix the preview heading** so it never shifts the CV:
   - Constrain the preview pane content to the CV sheet's own width (`w-fit mx-auto` wrapper around heading + sheet), so "معاينة" aligns to the sheet's edge instead of the full column width.
   - Keep the heading directly above the sheet with its existing small margin — no extra offsets in RTL.

## Verification
- `bun x tsgo` clean.
- Visual check at `/resources/lebenslauf-builder` in Arabic: form and CV side by side, "معاينة" directly above the CV sheet, sheet not pushed; English unchanged.
- CV builder tests still pass (47/47).
