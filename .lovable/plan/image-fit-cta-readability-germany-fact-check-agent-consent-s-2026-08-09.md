# Image Fit, CTA Readability, Germany Fact-Check, Agent Consent & Slider Polish

## 1. Fact-check the Germany destinations content (biggest item)

`src/data/educationalDestinations.ts` holds 20 universities, 3 language schools and 2 services. Every card currently states a ranking (`"#26 عالمياً (THE 2025)"`) and a student count (`"45,000+ طالب"`), and there are no official website links anywhere in the data.

Work:
- Research each institution against its official site plus the current THE/QS edition (via web research), recording: official name, city, official URL, current ranking + edition, enrolment figure + source year, main subject areas, language of instruction where stated.
- Rewrite each entry with verified values; add `officialUrl` and `sourceNote` fields.
- Any figure that cannot be confirmed from an official/primary source is removed rather than guessed, and listed back to you as "unverified — removed".
- Replace marketing superlatives ("الرائدة", "الأفضل") with neutral factual wording unless a cited ranking supports them.
- Language schools and the two service cards (Techniker Krankenkasse, Deutsche Bahn) get the same treatment; nothing is described as a Darb partner unless you confirm the partnership.
- Cards gain a "الموقع الرسمي" outbound link (`rel="noopener noreferrer"`), and each ranking line shows its source/edition inline.

## 2. Card visuals — generic campus imagery

`UniversityCard` currently renders an empty white logo box, and several `logoUrl` values point at student photos. Replace with a neutral campus image per card category (generated, reused across cards, not fake logos), rendered in a fixed-height wrapper with `object-cover` and a sensible `object-position`, plus `loading="lazy"` and explicit dimensions to avoid layout shift. `LanguageSchoolCard` and `ServiceCard` get the same treatment; the misused student photos are removed from this data file.

## 3. Sitewide image-fit audit

Audit every `<img>` and background image in public-facing components (Hero, PageHero, StudentGallery, blog, educational cards, Header logo, broadcast cards) and fix:
- containers without a fixed aspect ratio (add `aspect-*` or fixed heights so nothing jumps),
- `object-contain` where `cover` is right and vice-versa,
- `object-position` where faces sit near an edge,
- overflow / stretched images,
- missing `loading="lazy"` and `decoding="async"` below the fold.
Checked at 390px and 1280px with screenshots.

## 4. Orange CTA readability (`src/components/educational/CTASection.tsx`)

Current: `bg-orange-500` with a white button and a white-outline ghost button — the ghost button's white-on-orange fails contrast and the section hardcodes colours instead of using the Darb tokens.

Fix:
- Move the section onto design-system tokens (brand gradient/deep surface) rather than raw `orange-500`, so the orange reads as an accent instead of a full-bleed wash.
- Primary button: solid high-contrast surface with dark text (AA+ at Arabic body sizes).
- Secondary button: solid bordered variant with a readable fill, not transparent-on-orange.
- Define hover / active / focus-visible states for both; keep touch targets ≥44px and Arabic line-height comfortable on mobile.
- Fix the link mismatch: the second button is labelled "اختبار التخصص" but points at `/contact`; it should go to `/quiz` (the specialization quiz route). First button keeps `/apply`.
- Also review `EducationalDestinationsPage`'s bottom CTA, which uses the same hardcoded-colour pattern.

## 5. Agent application consent (`src/components/partnership/RegistrationForm.tsx`)

The form inserts into `contact_submissions` with no consent capture at all. Add, using the existing `ConsentBlock` + `recordConsent` pattern already used on the apply/contact forms:
- One required, unchecked-by-default consent checkbox (no marketing consent on this form, per your answer).
- Arabic copy covering: what is collected, that it is processed to review and respond to the agent application, and links to the existing `/privacy` and `/terms` pages (both routes exist).
- Zod: `consent: z.literal(true)` with an Arabic validation message; submit is blocked until checked, and the message renders under the checkbox.
- On submit, store `consent: true`, `consent_at` (ISO) and `policy_version` (from `POLICY_VERSION` in `src/lib/consent.ts`) inside the submission payload, and write an append-only row via `recordConsent({ sourceForm: 'partnership_form', serviceContact: true, marketing: false })`.
- No new personal fields are collected.

Backend check (read + verify, no schema change unless a gap is found): confirm the `contact_submissions` insert policy and the `consent_records` insert policy still allow anonymous submission while keeping reads admin-only, confirm the admin Inbox surfaces the consent fields, and confirm no duplicate row is created on double-submit (disable the button while pending).

Honest limitation stated in the summary: a checkbox plus a consent record is good practice, not a compliance certification.

## 6. Arabic / RTL pass

On the CTA and the agent form: RTL alignment of checkbox and label, clickable label, readable link colour, consent paragraph at a legible size (not 11px on mobile), long-text wrapping, and error-message placement.

## 7. Photo slider smoothness (`StudentGallery`)

- Keep the scroll-snap track (native momentum swipe) but tune it: consistent slide width, fixed aspect-ratio slide box so no layout shift, `scroll-behavior` handled per-interaction so auto-advance and user swipe never fight.
- Preload only the next slide's image; the rest stay lazy — no gallery-wide eager load.
- Add prev/next controls on desktop with drag-to-scroll, without swallowing clicks on links inside slides.
- Pause auto-advance on interaction, on hover, and when the tab is hidden; respect `prefers-reduced-motion`.
- No blank frame between images: the outgoing image stays until the next is decoded.

## 8. End-to-end verification

Driven with a real browser at 390px and 1280px:
- Destinations page: every card inspected, every external link opened and confirmed to resolve to the official domain.
- CTA: both buttons clicked, destinations confirmed, contrast measured.
- Agent form: submit blocked while unchecked, error message shown, then a full submission with the row and its consent fields read back from the database.
- Slider: repeated swipes and control clicks, screenshots checked for flicker/jump.

## Technical notes

- Files: `src/data/educationalDestinations.ts`, `src/components/educational/{UniversityCard,LanguageSchoolCard,ServiceCard,CTASection}.tsx`, `src/pages/EducationalDestinationsPage.tsx`, `src/components/partnership/RegistrationForm.tsx`, `src/components/landing/StudentGallery.tsx`, `public/locales/{ar,en}/{common,partnership}.json`, plus any image components flagged in the audit.
- No schema migration is planned; consent is stored in the existing `contact_submissions.data` payload and `consent_records`. If the audit shows an RLS or column gap, that will be raised before changing anything.
- Anything unverifiable is reported to you as an open item, not published as fact.
