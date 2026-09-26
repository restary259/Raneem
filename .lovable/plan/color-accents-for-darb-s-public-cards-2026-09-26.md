# Color accents for DARB's public cards

## Audit and recommendation
Your reference works because each card is easy to distinguish at a glance, while its text and image remain readable. DARB already has a multicolor brand palette (blue, teal, green, yellow, orange, red, pink and purple), but most visitor-facing cards use white or very pale backgrounds. I recommend using the reference's rhythm, not copying its exact colors or filling the whole website with bright blocks.

1. **Best fit — Study programs:** The educational-programs page shows a repeated grid of major cards with a real category ID for each subject. Give each academic category a consistent, light color background or prominent color band; retain dark readable text and clear focus/hover states. This helps a student scan fields without implying a ranking or admission guarantee.
2. **Best fit — Homepage next steps:** The six destination cards are currently uniform white tiles. Give the different paths a small set of coordinated DARB-colored surfaces or bands, with the Apply action still unmistakably primary. This is the strongest place to introduce the playful rhythm from your example.
3. **Secondary fit — Resources and blog:** The resource tools and article cards are also repeated grids. A colored icon area, category tab, or top strip would add distinction without competing with article photos or turning informational content into an event poster.
4. **Use restraint — Services and partnership:** Their steps and benefit cards could use occasional muted accents, but not a different saturated background on every step. The journey should still read in order.

**Leave neutral:** Application questions and booking calendar, contact forms, FAQ answers/citations, official university or exam logos, photo-led student stories and destination images, and signed-in dashboards. These need legibility, trust, accurate status colors or unaltered imagery more than decoration.

## Proposed first pass
Apply the palette to **study-program cards and homepage next-step cards only**, then review both on desktop and mobile in Arabic, Hebrew and English. Keep the original content, navigation and application logic intact; use the same color meaning consistently wherever a program category recurs. If this direction feels right, resources/blog accents can be a later pass.

## Technical approach
Define accessible light-surface and ink/border pairings as semantic tokens in the global design system, derived from DARB's existing brand colors. Map program `categoryId` values to stable color families rather than cycling by grid position, so filtering never changes a subject's color. Apply the same token set to the six homepage cards, preserve keyboard focus and RTL, and check text contrast and mobile wrapping before completion. No database or workflow changes.
