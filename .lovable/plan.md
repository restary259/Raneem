# Website review against the Design Engineering and Animate skills

## Overall verdict
The public site is in good shape. Buttons give a small press response, popups fade and scale in quickly, hover effects already only run on devices with a mouse, nothing animates in from zero size, and most moving parts respect "reduce motion". The fixes below are small polish items, ordered by how much a visitor will feel them.

## Findings

| Where | Now | Change | Why |
| --- | --- | --- | --- |
| Homepage headline (rotating words) | Changes every 2.6s and is announced aloud to screen readers each time; keeps rotating even with "reduce motion" on | Stop announcing each change; show one fixed phrase when "reduce motion" is on | Blind visitors hear constant interruptions; motion-sensitive visitors still see text swapping |
| Homepage destination photos and Heidelberg photos | Zoom on hover over 700ms | 300ms with a stronger ease-out | UI hover effects should stay under 300ms; 700ms feels sluggish |
| Homepage card hover | 300ms lift | 200ms | Hovered tens of times per visit, should be near-instant |
| Shared card style | Animates every property on every card, including dashboards | Animate only shadow and position | "Animate everything" causes needless work and odd flickers |
| Resources page tool icons | Animates every property, grows 10% on hover | Animate only size and colour, grow 5% | Subtler, cheaper |
| Popup close button | Animates every property | Colour and opacity only | Same rule |
| Button press | Shrinks to 98% | Shrinks to 97% with 160ms timing | Matches the skill's press-feedback values |
| Site-wide animation timing | Uses the browser's default, weak "ease" curves | Add three shared timing curves (enter, move, drawer) and use them for the items above | Gives motion a consistent, intentional feel |
| Unused old animation code | Old flight animation, scroll-reveal styles and three unused landing sections still in the code | Remove the unused styles and sections | Less dead code to maintain; no visible change |

## Not changing
- Layout, colours, copy, pages, forms, dashboards logic, data.
- Hover gating is already correct (no change needed).

## Verification
- Homepage, Heidelberg and Resources at phone (390px) and desktop, Arabic and English.
- Check with "reduce motion" turned on: headline stays still, photos do not zoom.
- Clean build.

## Technical details
- `src/styles.css`: add `--ease-out: cubic-bezier(0.23,1,0.32,1)`, `--ease-in-out: cubic-bezier(0.77,0,0.175,1)`, `--ease-drawer: cubic-bezier(0.32,0.72,0,1)`; remove `darb-flight-*` and unused scroll-reveal rules; reduced-motion rule hides `.darb-rotating-word` animation.
- `RotatingHeadline.tsx`: drop `aria-live`, expose full phrase list once via visually-hidden text; skip interval when `matchMedia('(prefers-reduced-motion: reduce)')`.
- `HomepageExperience.tsx` lines 64/149/230, `HeidelbergPage.tsx` 187/228/261/322, `EducationalDestinationsPage.tsx` 177: `duration-700/500` to `duration-300 ease-[var(--ease-out)]`; card `duration-200`.
- `ui/card.tsx`: `transition-all` to `transition-[box-shadow,transform]`. `ui/dialog.tsx` close: `transition-[background-color,opacity]`. `ResourcesPage.tsx`: `transition-[transform,background-color]`, `scale-105`.
- `ui/button.tsx`: `active:scale-[0.97]`, `duration-150`.
- Delete unreferenced `WhyChooseUs.tsx`, `StudentGallery.tsx`, `StudentJourney.tsx` after confirming no imports.
