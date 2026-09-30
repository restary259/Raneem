# DARB Student Dashboard — Heidelberg City Guide
## Implementation + verification plan (2026-09-30)

### Goal
Add a student-facing City Guide to the existing Student Dashboard so a completed student sees useful places around their German residential city. Heidelberg is the first configured city, centered on the student's saved `profiles.residential_city`.

### Important data rule
- `profiles.residential_city` = German residential city.
- `profiles.city` = city of birth.
- City Guide MUST use `profiles.residential_city`.

### Current implementation
The first production pass has been implemented directly in the repository.

#### New files
- `src/data/studentCityGuides.ts`
  - Heidelberg city configuration.
  - City matching / normalization.
  - Google Maps deep-link helper.
  - Curated F+U school + accommodation anchors.
  - Student-life / essential-place categories.
- `src/components/student/StudentCityGuide.tsx`
  - Reusable `preview` and `full` variants.
  - Hero image.
  - Search.
  - Horizontal category chips.
  - Responsive location cards.
  - Google Maps actions.
  - Arabic / English / Hebrew rendering.
- `src/pages/student/StudentCityGuidePage.tsx`
- `src/routes/student.city-guide.tsx`
- `src/lib/studentCityGuide.test.ts`

#### Existing files changed
- `src/pages/student/StudentNextStepsPage.tsx`
  - Loads `residential_city`.
  - Renders City Guide preview on the Student home.
- `src/components/layout/DashboardLayout.tsx`
  - Adds desktop City Guide navigation for students.
- `src/components/layout/MobileBottomNav.tsx`
  - Student mobile primary tabs now include Next, Map, Communication, Account.
  - Remaining study-file/tool pages remain available through More.
- `public/locales/{en,ar,he}/dashboard.json`
  - City Guide translation keys added.
- `src/routeTree.gen.ts`
  - New route registered for the current generated route tree.

### UX target
Match the generated DARB reference visual closely:
- Existing DARB student dashboard shell remains unchanged.
- Spacious dashboard content area.
- Heidelberg photographic hero with dark readable overlay.
- City label + short practical description.
- Strong primary "View full map" action.
- Search field directly below hero.
- Horizontally scrollable pill filters on mobile.
- "Popular near you" section.
- Image-led location cards on desktop.
- Compact list/card treatment on mobile.
- Minimal copy; utility first.
- Use the existing dashboard shadcn Card/Button/Input components and existing primary/border tokens.
- No new visual framework, no new gradients/glows, no global redesign.

### Pictures / assets
Use existing DARB/F+U assets where already present:
- Heidelberg hero: `@/assets/destinations/heidelberg.jpg`
- F+U school campus: `/lovable-uploads/schools/fu-academy/school/campus.jpg`
- F+U accommodation images from the existing school catalog assets.
- Generic locations currently fall back to the Heidelberg hero until a Google Places photo layer is added.
- Do not invent business photos or fake official imagery.

### Heidelberg curated anchors
- F+U Academy of Languages — Hauptstraße 1, 69117 Heidelberg
- F+U Campus Residence — Kurfürsten-Anlage 64–68, 69115 Heidelberg
- F+U Residence — Märzgasse / Heidelberg Old Town
- F+U Residence — Concordia — Rohrbacher Straße 126, 69126 Heidelberg
- Kaufland Heidelberg-Weststadt — Kurfürsten-Anlage 61, 69115 Heidelberg
- Lidl Heidelberg — Google Maps search
- REWE Heidelberg — Google Maps search
- VeniceBeach Heidelberg Bahnstadt — Speyerer Straße 4+6, 69115 Heidelberg
- FitBase Heidelberg — Kurpfalzring 120, 69123 Heidelberg
- Heidelberg Hauptbahnhof
- Sportzentrum Mitte — Rohrbacher Str. 102, 69126 Heidelberg
- Heidelberg Hunters Training Field — Carl-Bosch-Straße, 69126 Heidelberg
- Gloria Kino Heidelberg — Hauptstraße 146, 69117 Heidelberg
- University Hospital Heidelberg — Im Neuenheimer Feld 672, 69120 Heidelberg
- Hof Apotheke Heidelberg — Sofienstraße 11, 69115 Heidelberg
- Heidelberg Old Town

### Google Maps strategy
The current implementation uses Google Maps search/deep links. It does NOT expose a Google Places API key in the browser.

This keeps the first implementation secure and useful:
- clicking a place opens Google Maps;
- generic branches such as Lidl / REWE can be kept current by Maps search;
- F+U accommodation remains curated by DARB.

Future enrichment can replace generic curated rows with server-side Google Places results without changing the UI contract:
`name`, `category`, `distance`, `address`, `imageUrl`, `mapsUrl`.

### Responsive requirements
Verify at:
- 320px
- 360px
- 375px
- 390px
- 430px
- 768px
- 1024px
- 1280px

For every supported locale:
- English
- Arabic (RTL)
- Hebrew (RTL)

Acceptance:
- no horizontal page overflow;
- `document.documentElement.scrollWidth <= clientWidth`;
- search never exceeds parent width;
- category chips scroll horizontally only within their row;
- cards shrink to viewport width;
- long translated names wrap/clamp without widening grid tracks;
- mobile bottom navigation does not overlap the last content;
- desktop sidebar/header remain stable;
- desktop layout remains visually close to the existing Student Dashboard.

### Functional verification
1. Student completes onboarding with `residential_city = Heidelberg`.
2. Student lands on `/student`.
3. City Guide preview is visible below the welcome heading and above Tasks.
4. "View all" opens `/student/city-guide`.
5. City Guide loads the student profile city when the page is opened directly.
6. Non-Heidelberg residential cities do not show Heidelberg-specific content.
7. Search filters cards.
8. Category chips filter cards.
9. Every location opens a valid Google Maps destination.
10. F+U school and accommodation cards use the existing local image assets where available.
11. Arabic / Hebrew layout is usable and directionally correct.
12. Desktop sidebar City Guide item works.
13. Mobile Map tab works.
14. Remaining student routes remain accessible through More.

### Security / data constraints
- No public client-side Google Places server key.
- No broad database scan.
- Only read the signed-in student's `profiles.residential_city` when the full page needs it.
- Do not change RLS or case-security logic for this UI-only feature.
- Do not use `profiles.city` as the German residence.

### OpenHands verification
Run:
- typecheck / build
- unit tests
- targeted responsive guard checks if added
- browser verification for 390px + 1280px at minimum, then the full width matrix above
- English + Arabic + Hebrew
- confirm no route-tree or navigation regressions

### Lovable final verification
Compare the rendered result against the DARB Heidelberg reference screenshot:
- hero proportions
- card density
- search placement
- category chip behavior
- image quality / object fit
- typography hierarchy
- mobile spacing
- bottom navigation
- sidebar City Guide entry
- no overflow

Do not redesign the existing Student Dashboard outside this feature unless a verification step identifies a concrete regression.
