# Homepage hero and exam-card refinement

## Main hero copy

- Replace the four current hero text lines with this exact English wording in every language mode:
  - `DARB · Study International`
  - `Same Dream`
  - `Different Destinations`
  - `Germany starts here`
- Keep the existing background photo, dark semi-transparent panel, buttons, reassurance line, and mobile-only rainbow arch.
- Adjust the text hierarchy and spacing so the four short lines remain fully below the navigation and read cleanly on narrow mobile screens without wrapping awkwardly.

## Official exam logos

- Replace the generated text wordmarks with genuine logo artwork for all five exam cards: TestDaF, telc, Goethe-Zertifikat, DSH, and TestAS.
- Source the logos from the respective official organizations, retain their original proportions and colors, and store them through the app’s hosted asset system rather than hotlinking them.
- Keep each exam name as accessible text and as a fallback if a logo cannot load.

## Exam-card layout fix

- Give every card a stable, consistent height and logo area so the grid stays aligned.
- Rework the revealed information side so its description, note, official-link button, and return control fit without clipping or pushing into neighboring cards.
- Preserve the existing tap-to-open interaction, keyboard support, official links, reduced-motion behavior, and one-card-open-at-a-time behavior.
- Ensure the grid flows cleanly at mobile, tablet, and desktop widths, including the screenshot’s two-column width.

## Verification

- Check the homepage in Arabic, English, and Hebrew to confirm the exact campaign wording appears in all three modes.
- Visually verify the hero and exam grid at 320px, 393px, tablet, and desktop widths.
- Test opening and closing every exam card by touch/click and keyboard, confirm all official links, check for clipping and horizontal overflow, and confirm the preview build is clean.