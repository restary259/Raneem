# Homepage hero restyled to match the reference

Rebuild the homepage hero so it reads like the reference screenshot: one wide, flat, dark translucent band sitting over the photo, a single large light title, a small supporting line centered under it, and the rainbow strip along the bottom edge. Wording, photo and the two buttons stay.

## What changes visually

- The panel becomes a **wide band** instead of a narrow centered card: square corners, no visible border, a flat dark translucent fill (a touch stronger than today so the white text reads cleanly), and generous inner padding.
- The band is horizontally centered in the page but noticeably wider than the text inside it, exactly like the reference.
- **Title**: one large light headline, centered, with the two lines "Same Dream." / "Different Destinations." stacked as they are now. Lighter weight and wider tracking than today, to match the airy look in the reference.
- **Supporting line**: "Germany starts here." set small and centered directly under the title, in a quieter tone — no longer a bold subtitle.
- The small uppercase "DARB · Study International" label and the short rule above the title are removed; the reference has nothing above the headline.
- **Buttons** (Apply + WhatsApp) stay, centered under the supporting line, with the "free of charge" reassurance line kept beneath them.
- The band is vertically positioned in the upper-middle of the photo (not dead center) so more of the image is visible below it, as in the reference.
- The rainbow spectrum strip stays pinned to the bottom of the hero.

## Mobile

The band fills the available width with comfortable side margins, the title scales down but stays dominant, buttons stack, and the existing clearance from the navigation bar is preserved.

## Languages

No new copy. Arabic and Hebrew keep their existing hero strings and centering; the band mirrors correctly for right-to-left.

## Technical notes

- Edit only `src/components/landing/HomepageExperience.tsx` (hero block, lines ~98–120) and the hero rules in `src/styles.css` (`.darb-home-hero*` classes and the hero height/padding variables).
- Panel fill moves from `bg-hero-panel/20` + `backdrop-blur-md` + rounded/bordered card to a flat wider band; opacity nudged up to keep AA contrast on the title.
- Widen `--darb-hero-panel-width` for the homepage only (internal `DarbPageHero` pages are untouched).
- Verify with Playwright at 1440px, 1024px and 393px, plus an Arabic pass for RTL mirroring.
