# DARB "Quiet" brand refresh — whole public website

Apply your DARB formula to every visitor-facing page (home, programs, services, apply, contact, blog, FAQ, resources, partnership, about). Dashboards stay unchanged.

## What visitors will see
- **Mostly white pages** (white / soft off-white), navy headlines and navigation, blue for links, icons and selected states.
- **Yellow only as a "look here" accent**: one highlighted word in headlines, the main Apply button (yellow pill, navy text), selected date in the booking calendar, key numbers.
- **Quiet cards**: white, thin light border, 16px rounded corners, very soft shadow. No card-inside-card.
- **Deep ruby 3D cards replaced**: program cards and the six homepage choices become white cards with a small blue icon, navy title, gray text and a blue arrow. Subject still shown by a small colored dot/icon tint (muted set), not a colored background.
- **Two special card types only**: highlight (pale blue with blue accent) and announcement (pale yellow with yellow accent).
- **Rainbow as a signature**: one thin muted spectrum strip under the homepage hero, the apply success screen, and the footer — nowhere else.
- **Calmer typography & spacing**: headlines big not giant (especially Arabic), more padding between sections, fewer badges/borders, one main button per section.
- Photos framed as one editorial object with white space around, instead of text piled on top.

## Order of work
1. Global colors, card, button and spacing rules (one place).
2. Header, footer, hero, spectrum strip.
3. Homepage + program cards (replace ruby).
4. Remaining public pages, apply flow and booking calendar.
5. Check Arabic RTL, Hebrew, English on phone and desktop; build.

## Technical details
- `src/styles.css` tokens: background #FFFFFF, surface #F7F9FC, primary/navy #082B66, accent-blue #0B78FF, highlight #F4C84A, border #E5EAF1, card shadow `0 8px 30px rgba(8,43,102,0.06)`, radius 16px; muted spectrum #68A982 #F4C84A #E99A52 #D97979 #C987A8 #8176C5; highlight surfaces #EFF6FF / #FFF8DE. Scoped to public (light-only) so dashboard `ThemeScope` themes are untouched.
- Remove the deep "story" surface tokens and ruby gradients from `MajorCard` and HomepageExperience; keep category mapping by `categoryId` for the small tint.
- New reusable `SpectrumStrip` and `HighlightWord` components; Button gets a `cta` (yellow pill) variant.
- Fonts: keep IBM Plex Sans Arabic / Tajawal; Inter for Latin. Reduce hero heading sizes one step.
- No logic, routes, form behavior or data changes.
