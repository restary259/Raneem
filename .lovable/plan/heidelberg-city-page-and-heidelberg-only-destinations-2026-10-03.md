# Heidelberg city page and Heidelberg-only destinations

## What visitors will see
1. **New page "/heidelberg"**: a scrolling story for a student and their parents. Arabic is the default, with English and Hebrew too. It has 10 sections in this order: Why Heidelberg, Landmarks, Universities, Hospital and health insurance, Library, Housing and cost of living, Getting around, Sports and football, Student life, and a final button: "ابدأ تقييم ملفك للدراسة في هايدلبرغ". The button opens the existing /apply evaluation form.
2. Each section has a short heading, 2–4 practical sentences, 2–4 real photos and a small "facts" strip. For a cleaner look, the page shows no source links or photo credits. Sources and photo authors are kept in the app's data only.
3. A sticky section menu with smooth scrolling and a gold reading-progress bar. Animations stay subtle and phones come first.
4. "Distance from the Old Town" chips for Neuenheimer Feld, the hospital and the main station. These appear only if I can verify the distances.
5. No credits section on the page. Some free photo licences (CC BY / CC BY-SA) require the author to be named, so I'll prefer CC0 and public-domain photos.
6. **Heidelberg becomes the only featured city.** The Educational Destinations page and the home page show only Heidelberg. Berlin, Dortmund, Düsseldorf and Münster are hidden behind a switch, not deleted, so they can come back later.
7. Heidelberg gets a link in the main menu (desktop and phone) and a button on the home page.

## How facts and photos are handled
- I'll use only facts I can confirm on official pages: uni-heidelberg.de, heidelberg.de, klinikum, the Studierendenwerk, VRN and the tourism site. Each fact records its source link and a "last verified" date.
- Prices, fees, opening hours and phone numbers appear only after I open the official page. Numbers are shown as a range or with their year.
- Anything I can't verify is left out and added to a list for your team to check. I won't guess.
- No Semesterticket claims unless I can verify the current student ticket. Hoffenheim is labelled as a day trip to Sinsheim.
- An Arab student group is mentioned only if a real one is found. Only public institutions are recommended.
- Photos come only from Wikimedia Commons and must have a clear reuse licence (CC0, CC BY, CC BY-SA or public domain). I'll record the author and licence for each photo. Photos are stored in the app, not loaded from Wikimedia. No AI images.

## Technical details
- Data: `src/data/heidelberg.ts` holds the sections, facts, `sourceUrl`, `verifiedAt`, photo metadata (file, author, licence, sourceUrl) and a `TODO_VERIFY` list. Copy goes in a new `heidelberg` i18n namespace in en, ar and he, in both `public/locales` and `src/locales`, with matching content.
- Photos: download them in the sandbox, convert to WebP with ffmpeg at about 1200px wide, upload with lovable-assets and store `.asset.json` pointers. Images use `loading="lazy"` and Arabic alt text.
- Route: `src/routes/heidelberg.tsx` with `head()`: title "الدراسة في هايدلبرغ | درب", description, og:title/description, og:type and twitter:card. Use og:image only if the asset URL is absolute https.
- Page: `src/pages/HeidelbergPage.tsx` reuses Header, Footer, DarbPageHero, Card, Button, existing tokens and `useDirection`. The sticky mini-nav uses IntersectionObserver. No new libraries.
- City flag: add `ACTIVE_DESTINATION_CITIES = ['heidelberg']` in `src/data/educationalDestinations.ts`. EducationalDestinationsPage and the home page filter by it, and the other cities' data stays in place.
- Nav: add an entry to DesktopNav and MobileNav, plus a home page link. Nav keys go in all 3 languages.
- Brand: keep the existing navy and gold tokens. No hardcoded colours.
- Verification: tsgo typecheck and the i18n tests. Playwright at 375px (Arabic RTL) and 1280px: no sideways scrolling, no console errors, and all source and credit links return 200.
- Closing report: what was verified, what's in `TODO_VERIFY`, and which photos were used.
