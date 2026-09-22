# Stable hero width across the public website

## Goal
Make every active public hero visually consistent from its top edge to its bottom edge: full-width photography, one straight rectangular translucent content band, equal side margins, reliable navigation clearance, and no clipping or horizontal overflow.

## Scope
- Homepage hero: keep it the strongest hero and preserve its two actions.
- Shared internal heroes on Services, About, Programs, Destinations, Locations, Resources, resource tools, FAQ, Broadcast, Partnership, Contact, Quiz, Apply, Blog, blog articles, Privacy, Terms, and Accessibility.
- Do not change dashboard pages, authenticated tools, page copy, imagery, brand colors, or the content below each hero.
- Pages without a photographic hero, such as AI Advisor and exam detail pages, remain unchanged.

## Implementation
1. Consolidate panel geometry into shared hero sizing tokens:
   - one desktop maximum width for homepage and internal hero bands;
   - one small-screen gutter formula with equal left/right margins;
   - `box-sizing: border-box`, stable rectangular edges, and safe `max-width: 100%` behavior;
   - logical inline spacing so English LTR and Arabic/Hebrew RTL match exactly.
2. Normalize vertical geometry:
   - keep the existing compact and standard hero heights;
   - use a shared top clearance based on the fixed navigation height;
   - reserve consistent space above the bottom spectrum line;
   - vertically center the band within the usable area between navigation and spectrum, instead of relying on competing top/bottom padding.
3. Remove the Contact-only width/spacing divergence where the shared rules can safely handle its longer text. Keep only a narrowly scoped text-size exception if screenshot testing proves it is required.
4. Preserve the homepage hierarchy and actions while aligning its band edges and gutters with the internal hero system.
5. Keep titles and supporting text responsive so long Arabic, Hebrew, and blog titles wrap inside the band without changing its width or touching the navigation/spectrum.

## Verification and screenshots
Create before/after verification evidence for every hero-bearing public route at:
- Phone: 393×844
- Tablet: 768×1024
- Short laptop: 1375×735
- Wide desktop: 1920×1080

For English, Arabic, and Hebrew, verify and record:
- hero left/right edges equal the viewport edges;
- band left/right gutters are symmetric and consistent across routes;
- band width does not change between its top and bottom;
- no horizontal page overflow;
- no title, eyebrow, subtitle, or action clipping;
- band clears the navigation and bottom spectrum line;
- the next section begins cleanly after the hero.

Save route-labelled screenshots and produce compact contact sheets by viewport/language so the final comparison is reviewable without opening hundreds of files individually. Recheck the final build and browser console after the visual pass.

## Technical notes
- Primary files: `src/styles.css`, `src/components/common/DarbPageHero.tsx`, and the homepage hero in `src/components/landing/HomepageExperience.tsx`.
- Page-specific hero files will only change if a shared correction cannot safely cover them.
- The current source confirms active internal photo heroes already converge on `DarbPageHero`; the homepage is the intentional custom exception. The existing CSS currently mixes desktop `min(92vw, 1060px)`, mobile viewport subtraction, and a Contact-specific override, which will be consolidated.
