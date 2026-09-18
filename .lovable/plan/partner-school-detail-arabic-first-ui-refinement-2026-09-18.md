# Partner School Detail — Arabic-first UI refinement

## Goal
Make the KAPITO knowledge page feel cleaner, tighter, and faster to scan during a call, with Arabic/RTL as the primary layout direction while preserving the same verified school data.

## Page refinement
- Rework spacing, hierarchy, borders, and text density so the page reads as one compact reference sheet rather than many disconnected cards.
- Make the school header, search, highlighted course summary, and tabs align naturally from the right in Arabic; mirror icons, labels, price rows, and controls correctly in English.
- Keep numbers Western (`0–9`) while displaying dates in natural Arabic wording.
- Make the tab row compact, sticky, horizontally scrollable on smaller screens, and ordered from the RTL starting edge.
- Preserve the current dashboard design tokens and components; no gradients, oversized visuals, or decorative effects.

## Highlighted course quick answer
- Refine the highlighted **الدورة المكثفة — 20 حصة أسبوعياً** summary into a clearer call-ready strip.
- Add the verified full A1→C1 answer:
  - A1: 8 weeks
  - A2: 8 weeks
  - B1: 8 weeks
  - B2: 12 weeks
  - C1: 8 weeks
  - Total: **44 weeks**
  - Official 24+ week rate: **€160/week**
  - Total course fees: **€7,040**
- Label this explicitly as school tuition only; accommodation, summer supplement, deposits, and مكتب درب fees remain separate.
- Derive the answer from the stored level durations and price band rather than hardcoding the amount in the page.

## Accommodation tab
- Replace static cards with accessible expandable rows/cards.
- Clicking an accommodation reveals its complete stored details in place: price periods, weekly/total prices, meal plan, minimum age, arrangement fee, security-deposit status, availability warning, and source/verification line.
- Add a clear **View in catalog** action for matching catalog accommodation records.
- Deep-link the catalog with the KAPITO school and accommodation selected. When one knowledge type maps to several catalog units, open the KAPITO accommodation list filtered to that type rather than choosing an arbitrary unit.
- Keep the general **Open DARB Catalog** action as a secondary option.

## Start dates
- Separate the rule into two explicit answers:
  - Students who already have German knowledge may start on any Monday after placement/level confirmation.
  - Complete A1 beginners may start only on the published beginner dates.
- Group beginner dates by month in a compact Arabic-first layout.
- Render dates with Arabic month names and Western digits, for example `5 يناير 2026`; retain the stored ISO date as the factual source.
- Use precise wording such as **موعد بدء الدورة** and **تواريخ بدء المبتدئين** instead of ambiguous labels.
- Keep the official source and last-verification line directly beneath the dates.

## Calculator and consistency
- Tighten the calculator spacing and make all result rows RTL-safe.
- Localize copied answers according to the active language instead of always producing English text.
- Reuse one date formatter and one localized duration/price-label path across search answers, cards, dates, and calculator output.
- Preserve the official flat-band pricing rule and all existing no-assumption / unconfirmed-data warnings.

## Verification
- Add tests for the A1→C1 result (44 weeks, €7,040), Arabic date formatting with Western digits, catalog matching/deep-link behavior, and localized accommodation labels.
- Verify the page in Arabic and English at desktop and mobile widths, including tab scrolling, expanded accommodation content, catalog navigation, and no clipped or reversed text.
- Run translation parity, targeted tests, full tests, and the application build.

## Technical notes
- Frontend-only presentation and navigation work; no pricing or source records will be changed.
- The current database links KAPITO to its catalog school, but individual knowledge accommodations do not have direct catalog IDs. Matching will therefore use the linked school plus normalized room type/meal plan, with a filtered list for one-to-many studio matches.
