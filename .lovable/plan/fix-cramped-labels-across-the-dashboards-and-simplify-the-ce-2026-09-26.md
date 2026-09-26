# Fix cramped labels across the dashboards and simplify the CEFR map

## The bug in the screenshot
In Major Intelligence, the CEFR level map squeezes six boxes into a phone-width row. Each box also carries a word under the level ("below requirement", "required", "meets or exceeds"). Those words don't fit, so they overflow and overlap.

## Fix for the CEFR map (the pattern to reuse)
- Show only the level: **A1 A2 B1 B2 C1 C2**, with no sentence under each one.
- Highlight the required level (brand color, bold, filled). Show levels that meet or exceed it as solid, and lower levels faded.
- Add one small legend line under the row: "Highlighted = required". Screen readers still get the full meaning ("C1, required").
- Keep the same data. This is a presentation change only.

## Dashboard-wide audit
1. **Automated sweep**: open every dashboard page for each role at phone width (390px) and desktop width, in Arabic and English. Admin, team, agent, partner, and student pages are all included. Flag:
   - text that spills outside its box
   - the page scrolling sideways
   - clipped buttons and badges
   Record a screenshot for every flagged spot.
2. **Code sweep** for the same risk: fixed multi-column rows without a phone fallback, and long labels inside small chips or tiles. Already found for review:
   - the appointments calendar week/month grid (7 columns)
   - Major Intelligence tabs and the grade/level tiles
3. Deliver a short audit report (page, problem, fix) and fix every item in the same pass.

## Simplification rules applied while fixing
- Replace a wordy status under a short value with a highlight plus a single legend (the CEFR approach).
- Replace long badges such as "Required before enrollment" with short badges and a tooltip where space is tight.
- Truncate long names on one line (full text on hover). Let multi-item header rows wrap cleanly on phones.
- Don't remove any information. Details move to legends or tooltips.

## Verification
Re-run the sweep after the fixes: zero sideways scrolling and zero overflowing text on the flagged pages, in both languages at both widths. Also run the build and the translation checks.

## Technical notes
- CEFR: `src/components/team/intel/MajorCard.tsx` ~l.164-185. Drop per-tile `intel.card.below/above/required` text and add an `intel.card.levelLegend` key (en/ar). Tiles use `aria-label`.
- Sweep: Playwright script under `/tmp/browser/dash-audit`, with a signed-in session per role, `scrollWidth > clientWidth` and element-overflow detection. Admin pages need the admin security step, so admin coverage may be partial. Any gaps will be listed.
- Other candidates: `TeamAppointmentsPage.tsx` l.801/835 and `CaseFinance.tsx` l.889.
