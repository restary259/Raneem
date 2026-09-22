# Contact hero four-viewport correction

## Audit findings
Tested the Contact hero at four representative screen shapes:

- **Phone — 393×844:** full viewport width, 16px side clearance, no horizontal overflow; content fits vertically.
- **Tablet — 768×1024:** full viewport width and no overflow, but the text panel ends only about 12px above the hero edge, leaving the rainbow strip visually cramped.
- **Laptop — 1375×735:** the hero is 300px tall while the inner panel extends to about 340px, so the description and panel are visibly cut off at the bottom.
- **Wide desktop — 1920×1080:** the hero is 360px tall while the inner panel extends to about 404px, producing the same bottom clipping.

The image and outer hero already span the exact viewport width at all four sizes. The defect is the vertical fit of the Contact panel, not horizontal width.

## Fix
- Keep the Contact hero full-bleed from left edge to right edge.
- Apply a **Contact-only compact layout adjustment** rather than changing every shared public hero.
- Reduce and rebalance the inner panel’s vertical spacing so the eyebrow, title, and supporting sentence stay fully inside the image.
- Give the rainbow strip consistent breathing room below the panel at phone, tablet, laptop, and wide desktop sizes.
- Preserve the current image, translucent dark panel, centered title, DARB styling, navigation, and all Contact content below the hero.
- Keep safe side margins on small screens and the existing maximum panel width on larger screens.

## Verification
- Recheck **393×844, 768×1024, 1375×735, and 1920×1080**.
- Verify English, Arabic, and Hebrew for title/description wrapping and RTL alignment.
- Confirm the hero and image exactly match viewport width, the panel remains within the hero on all four edges, the rainbow strip is unobstructed, and horizontal overflow remains zero.
- Confirm the Contact form and support section below the hero are unchanged.
