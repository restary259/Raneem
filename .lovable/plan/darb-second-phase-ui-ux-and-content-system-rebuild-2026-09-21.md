# DARB Second-Phase UI/UX and Content System Rebuild

## Goal
Refine the homepage, Services, Contact, and AI Advisor into one mobile-first DARB system: bright, premium, educational, trustworthy, and clearly scoped to Germany. Preserve all working forms, AI behavior, authentication, permissions, and business logic.

## Resolved decisions
- Keep `/contact` and `/ai-advisor` as two distinct pages.
- `/contact` remains the structured human enquiry form; `/ai-advisor` remains the human-contact plus instant AI guidance experience.
- Treat the uploaded CEFR graphic as visual reference only. It will not be presented as an official logo without verified usage rights.
- The Council of Europe has no standalone “CEFR logo” to recreate. Use an attributed CEFR reference treatment with the official Council of Europe source link rather than inventing or mislabelling a logo.

## 1. Shared public visual system
- Preserve the transparent-to-white sticky header, but add a restrained dark top-state contrast layer so navigation remains readable over any photograph.
- Refine desktop navigation with subtle active and hover underlines; keep mobile controls at least 44px.
- Keep bright white/off-white surfaces, charcoal typography, DARB navy, orange/yellow accents, one spectrum strip per major composition, and restrained arch motifs.
- Standardize public CTA hierarchy using the existing button system: one strong primary action, one quieter secondary action, and no page-specific button styling drift.
- Extend the reusable identity stage with wide/square/compact logo ratios, stable dimensions, `object-contain`, descriptive fallbacks, keyboard focus, and no broken-image artifacts.

## 2. Homepage hero and first-minute experience
- Recompose the hero around the current verified Germany/education photograph with a dedicated mobile crop and a reliable dark text/CTA zone.
- Use the concise campaign **Your Future Without Borders** / its approved Arabic equivalent, plus a direct value proposition for Arab 48 students preparing to study in Germany.
- Keep Apply as the primary CTA and WhatsApp as the secondary CTA; visually separate navigation controls from conversion buttons.
- Keep one spectrum strip below the hero only and prevent duplicate brand stripes.
- Preserve the existing beginner-first questions and “Find Your Next Step” journey, tightening spacing and hierarchy rather than adding more sections.

## 3. Interactive CEFR A1–C1 guide
- Replace the static A1–C2 color row with an interactive A1–C1 selector.
- Desktop: editorial split layout with level selector, user category, concise “can do” summary, and source attribution.
- Mobile: horizontally scrollable snap selector with 44px targets; the selected explanation appears below without page overflow.
- Use faithful, concise Council of Europe CEFR Global Scale paraphrases in Arabic and English.
- Remove the incorrect repeated “≈200 guided hours” claim. Do not publish study-hour estimates unless separately attributed and clearly caveated.
- Label the source as **Council of Europe · CEFR Global Scale** and link to the official reference page. State that each school or institution sets its own required level and that DARB coordinates guidance/registration rather than teaching or certifying the level.
- Add smooth but restrained transitions and disable them for reduced-motion users.

## 4. Educational identities and tests
- Audit-render every homepage/public identity through the shared logo stage.
- Preserve only verified institutions already present in project data; do not add OSD or any school/test not supported by current records.
- Replace fragile TU9 Wikimedia redirect hotlinks with approved self-hosted assets sourced from official university/TU9 brand channels where lawful. Until an official asset is available, show the institution name cleanly instead of a broken or third-party logo.
- Re-source GoAcademy from its official channel; keep verified/self-hosted F+U, Alpha Aktiv, Perfekt Deutsch, KAPITO, and VICTORIA assets.
- Present telc, TestDaF, TestAS, onSET, DSH, and Goethe editorially as examination/reference bodies with concise purpose text and official outbound links—not as an interchangeable logo row.
- Keep DARB’s role explicit: exam selection, registration coordination, and preparation guidance; never claim DARB awards certificates or guarantees results.

## 5. Destination imagery
- Keep only recognizable, accurately identified German destination imagery already tied to a verified city/source.
- Apply one DARB editorial photo treatment: stable ratios, deliberate focal points, concise city context, restrained overlay, source credit when required, and graceful fallback.
- Replace unverifiable generic hero imagery or generic “German city” labels with a neutral treatment until a verified image is available.

## 6. Services rebuild
- Reorder `/services` as a connected student journey rather than nine equal cards:
  1. Explore and assess
  2. Prepare language and documents
  3. Apply to suitable institutions
  4. Prepare visa, accommodation, and arrival
  5. Start with guided follow-up
- For each stage, show the student problem, what DARB does, what the institution/authority/provider decides, and the next action.
- Move the process explanation before the detailed disclosure.
- Preserve the existing disclosure, excluded-cost, external-provider, in-person-payment, cancellation, and no-guarantee statements without weakening them.
- Correct stale Germany/Romania/Jordan copy to the verified Germany-only positioning.
- Remove or qualify unsupported claims such as teaching courses, booking official appointments, guaranteed housing, or guaranteed outcomes.
- Ensure `/services` has one immediate H1 and a nonblank loading transition.

## 7. Contact and AI Advisor
### `/contact`
- Keep the real enquiry form unchanged: validation, consent, honeypot, message limits, submission destination, and inbox visibility remain intact.
- Recompose the page around the existing advisor portrait, a concise human-support introduction, the form, office/location information, WhatsApp, email, and social links.
- Add a small “Need an instant general answer?” path to `/ai-advisor`, while positioning the form for specific cases, documents, appointments, and partnership enquiries.
- Align visible enquiry topics with the verified Services language and remove stale country/service wording from unused locale content.

### `/ai-advisor`
- Preserve the current two-column human-contact + AI structure and all AI states.
- Refine it to match the supplied reference: advisor portrait/contact panel, AI transcript/composer, and a single spectrum strip.
- Add a clear link to the structured `/contact` form for visitors who want staff follow-up.
- Preserve authentication requirements, history, streaming, quick prompts, offline/error states, RTL, mobile composer clearance, and the existing AI backend.

## 8. Bilingual content and accessibility
- Update Arabic and English together, preserving meaning and terminology parity.
- Keep one H1 per page, semantic heading order, descriptive alt text, visible focus, sufficient contrast, 44px touch targets, and correct RTL/LTR behavior.
- Keep Western numerals where the project already requires them.
- Add route-specific metadata for Homepage, Services, Contact, and AI Advisor without changing route paths.

## 9. Verification
Test at 320, 375, 390, 430, 768, 1024, 1280, 1440, and 1920px:
- zero page-level horizontal overflow;
- correct mobile hero crop and CTA hierarchy;
- interactive CEFR keyboard/touch behavior and RTL layout;
- no broken logo or photo artifacts;
- stable logo aspect ratios and fallbacks;
- Contact submission and inbox payload unchanged;
- `/contact` and `/ai-advisor` remain distinct and cross-linked;
- AI empty, signed-out, loading, streaming, history, offline, and error states remain usable;
- Services hierarchy and disclosures remain complete;
- reduced motion, keyboard navigation, metadata, typecheck, build, and focused public-flow tests pass.

## Technical scope
- Frontend presentation, public-page content, local/static assets, and route metadata only.
- No changes to the backend, database permissions, submissions, authentication gates, AI backend, payments, commissions, WhatsApp processing, dashboards, or case workflows.
