# Fix CV Builder layout in Arabic (RTL)

## Problem
In Arabic, the CV builder keeps the LTR two-column grid: the form sits on the right and the CV preview is pushed to the far left, looking broken and cramped. The user wants the preview stacked **above** the form in Arabic.

## Change (one file: `src/components/lebenslauf/LebenslaufBuilder.tsx`)

1. Detect the active direction with `i18n.dir()` (already available via `useTranslation`).
2. When RTL (Arabic):
   - Replace the desktop `lg:grid-cols-2` grid with a single-column stack (`grid-cols-1`, no `lg:grid-cols-2`).
   - Render the preview pane **first** (above the form) via `lg:order-first` on the preview pane.
   - Drop the embedded-mode split-scroll classes for the two panes in RTL (`lg:overflow-hidden` / per-pane `lg:overflow-y-auto`) so the whole page scrolls naturally top-to-bottom; the sticky preview offset is removed in RTL since the preview is on top.
3. LTR (English/German) layout is completely unchanged — same two-column side-by-side grid, same scrolling behavior.
4. Mobile behavior unchanged (edit/preview toggle already stacks).

## Verification
- `bun x tsgo` typecheck clean.
- Visual check in the preview at `/team/tools/cv` in Arabic: preview sheet appears above the form, full width, nothing pushed left; English view unchanged.
- `npm test` — confirm no new failures beyond the 3 known pre-existing ones (2 `PublicOfficeBooking`, 1 i18n parity).
