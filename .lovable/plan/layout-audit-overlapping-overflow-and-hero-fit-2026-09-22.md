# Layout audit — overlapping, overflow and hero fit

I measured every public page at four screen widths (1440, 1033, 768, 393) and captured screenshots. Below is what is actually broken, ordered by how visible it is.

## Confirmed problems

### 1. Top menu breaks between roughly 1024 and 1150 px wide (worst issue)
This is exactly what your screenshot shows. At 1033 px the full desktop menu is already switched on, but there is not enough room: the menu items run into the logo, "Contact us" sits underneath the blue "Student login" button, and that button is pushed against the right edge. It looks broken on small laptops and landscape tablets.

Fix: keep the compact menu (hamburger) until the window is wide enough for the full row, and give the menu row proper minimum spacing so items can never sit on top of each other.

### 2. Hero band starts too close to the menu on small laptops and tablets
On the partnership, FAQ and homepage heroes the dark band begins only 13–27 px below the menu bar, so the title reads as if it is tucked under the navigation. On phones and wide desktop the spacing is fine.

Fix: apply the same "clear the header, then breathe" spacing rule already used on phones to the 1024–1280 range.

### 3. Internal heroes are wildly different heights
Measured band heights on the same screen: Locations 151 px, Services 183 px, Resources 231 px, Destinations 283 px, Partnership 305 px, FAQ 329 px. Pages with a long title plus a long supporting sentence balloon; pages with a short title look thin. They no longer read as one system.

Fix: cap the supporting sentence length, limit the title to two lines, and give the band a shared minimum and maximum height so every internal page lands in the same range.

### 4. Partnership hero has two titles in one
The heading is "Shine with DARB: Be our digital ambassador" — two statements joined by a colon, which is why it wraps to three lines and inflates the band. It breaks the one-page-one-title rule.

Fix: shorten to a single title with the second half moved into the supporting line (all three languages).

### 5. Decorative rings hang off the left edge of the homepage
The circular brand arcs in two homepage sections start at −20 to −57 px, so they are sliced by the window edge at every width. They read as a rendering glitch rather than decoration.

Fix: contain or reposition them so they sit fully inside the section.

### 6. Application form: progress bar points the wrong way in Arabic
On the apply page the progress fill is positioned outside its track (measured far off to the left on phones and tablets). In Arabic it should fill from the right.

Also on that page: one sentence above the steps is still in English inside the Arabic layout, and its full stop lands on the wrong side.

Fix: make the progress fill direction-aware and translate the missing sentence.

### 7. Contact page hero does not match the others
Every other page now has the photo band; Contact still uses the older light two-column layout with a portrait. It is the one page that looks like a different website.

Fix: decide whether Contact adopts the standard band or stays deliberately different. My recommendation is to adopt the band and keep the portrait lower on the page.

### 8. Smaller items
- AI advisor page: its title renders at body-text size, so the page has no clear heading.
- Homepage photo strip on phones: the first photo sits outside the visible area on load in Arabic, so the row appears to start blank.

## What is healthy
No page scrolls sideways at any of the four widths. Services, Destinations, Resources, FAQ, Locations, Quiz and Blog all render the shared hero band correctly on desktop and phone.

## Technical notes
- Header breakpoint lives in `src/components/landing/Header.tsx` (`lg:` gates the desktop row and utility bar) — move to `xl:` and verify the mobile sheet still carries every link.
- Hero spacing and sizing: `src/styles.css`, the `.darb-page-hero-*` and `.darb-home-hero-*` blocks, plus the `--darb-header-height` offset which is currently only applied under the 1024 px media query.
- Title/subtitle length caps belong in `src/components/common/DarbPageHero.tsx` (line clamps), with copy changes in `public/locales/{en,ar,he}/*.json` and the runtime mirrors in `src/locales/`.
- Brand arcs: `src/components/landing/home/BrandArch.tsx`, used in `HomepageExperience.tsx` lines 182 and 243 — the parent sections need overflow containment or inset positioning.
- Apply progress bar: `src/components/apply/ApplyForm.tsx` — the fill element uses a left-anchored transform; switch to logical inline-start.

## Proposed order of work
1. Header breakpoint (items 1 and 2) — biggest visible defect.
2. Hero height and title/subtitle consistency (items 3 and 4).
3. Apply form direction fix and missing translation (item 6).
4. Brand arcs and the small items (items 5 and 8).
5. Contact hero decision (item 7) once you confirm the direction.
