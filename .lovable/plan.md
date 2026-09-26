# Homepage & public-site polish: remove legacy numbers, hero cleanup, round cards

## What changes

1. **Delete the legacy "16+ students / 6+ partners" numbers for good.**
   These live only in dead, unused components (no imports anywhere):
   - `src/components/landing/Hero.tsx` (16 / 6 / 2 stats)
   - `src/components/landing/AboutCustom.tsx` (16+ / 6+ / 2+ / 98%)
   - `src/components/landing/AnimatedCounter.tsx` + `src/hooks/useAnimatedCounter.ts` (only used by the two above)
   - Remove the now-orphaned locale keys `hero.stats.*` and `aboutStats.*` from all landing.json files (`src/locales` + `public/locales`, ar/en/he). Keep the rest of `hero.*` (FaqPage still uses `hero.title` etc.).

2. **Homepage hero: remove the subtitle, drop the WhatsApp button, relabel the main button.**
   - Delete the `homepage.hero.subtitle` line ("أخبرنا بما تطمح لدراسته…") and its key from all landing.json files. Hero keeps title, buttons, reassurance line.
   - Remove the hero's WhatsApp button; the main button stays and keeps linking to `/apply`, with label changed:
     - `homepage.actions.apply`: ar "تواصل معنا", en "Contact us", he "צור קשר".
   - Keep `homepage.actions.whatsapp` — the final CTA section still uses it.

3. **Round edges on all public-page cards (site-wide consistency).**
   Standardize every card-like surface on visitor-facing pages to one radius (`rounded-2xl`, 16px — matches the existing design token):
   - Homepage: destination city tiles, trust/"included" cards, pricing-step cards, student gallery photo cards, university tiles (`IdentityStage`), exam flip cards, CEFR guide blocks, network pillars (border-left tiles become quiet rounded cards if it fits the layout).
   - Programs/education: `MajorCard`, `MajorModal`, `LanguageSchoolCard`, `ServiceCard`, search/filter panels.
   - Services, partnership (`NewHowItWorks`, `SuccessStories`), resources (`ResourceCard`), contact section cards, office-location cards, broadcast video modal.
   - Keep `rounded-full` for pills, buttons, avatars, icon circles; keep `rounded-none` only for full-bleed sections, hero scrims and the spectrum strip. Border-separated row layouts that aren't cards stay as they are.

## Guardrails

- Public pages only — dashboards untouched.
- No logic, routes, form, or data changes; i18n changes are text/key edits in both `src/locales` and `public/locales` together (parity guard).
- All three languages updated together: Arabic, English, Hebrew (public locales).

## Verification

- i18n parity guard + unit tests (`npx vitest run`), typecheck/build.
- Playwright screenshots of the homepage (desktop + 390px, Arabic) confirming: no subtitle, one hero button labeled "تواصل معنا", rounded cards; spot-check programs and services pages for the radius.
