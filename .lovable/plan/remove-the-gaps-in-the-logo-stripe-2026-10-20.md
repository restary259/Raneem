# Remove the gaps in the logo stripe

## What changes
The stripe under page banners and in the footer keeps the same logo colours and order (long navy, then gold, red, purple, teal), but the small gaps between the colour pieces are removed so every colour touches the next one.

## Not changing
Colours, order, proportions, thickness, where the stripe appears, and right-to-left mirroring in Arabic/Hebrew.

## Verification
Screenshot the stripe on the homepage and confirm the colours meet with no gaps.

## Technical details
- `src/styles.css` `.darb-spectrum`: drop the four `transparent` stops so segments run edge to edge (navy 0–60%, gold 60–70%, red 70–80%, purple 80–90%, teal 90–100%).
