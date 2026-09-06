# Engineering & Technology: fact-check audit + card upgrade (same treatment as Health & Medical)

## What exists already (no rebuilding)

The card layout, the "Can I get in?" Bagrut block, the language fact table, the at-a-glance chips, the source list, all Arabic/English labels, the locale helpers, the tests and the AI-knowledge generator were built for Health & Medical and are **category-agnostic**. They switch on automatically for any major that carries `requirementTiers`, `sources`, `lastVerified`, `glance` and `languageProfile`. So this category needs **data only** — no UI, i18n, helper or test-framework work.

## Current state (12 majors)

Computer Engineering, Aerospace Engineering, Renewable Energy Engineering, Software Engineering, Industrial Engineering (Wirtschaftsingenieurwesen), Space Engineering, Chemical Engineering, Mechanical Engineering, Civil Engineering, Electrical Engineering & IT, Electrical Engineering, Environmental Engineering.

All 12 currently share one copy-pasted template ("usually 6-7 semesters", "C1, some applied universities accept B2", "master level IELTS 6.0-6.5", "4-5 units math/physics strongly recommended"). None of it is sourced. Space Engineering is described as a master-level specialisation, and Electrical Engineering vs Electrical Engineering & IT overlap almost entirely.

## Work

1. **Research (batched to save credits)** — four parallel research passes, three majors each, each pass returning per major: 2-3 named public universities with the exact program page, admission mode (open / local NC / aptitude test), application channel for foreign certificates (uni-assist / direct / Hochschulstart), degree + regular semesters, language level and certificates actually stated on that page, any verified English-taught bachelor, Vorpraktikum (pre-study internship) rules, Studienkolleg course (T-Kurs) confirmation, and one legal/nationwide source where one exists. Every URL is HTTP-checked once. Anabin ISR-BV01, RO-DT, uni-assist Israel, KMK grade formula, Studienkolleg sources are reused from the health constants.
2. **Data** — one scripted insert into `src/data/majorsData.ts` for the engineering category: `lastVerified`, `glance`, `languageProfile`, `requirementTiers` (official / university-specific / Darb guidance), `sources`, and corrected `duration`, `requiredBackground`, `languageRequirements`, `arab48Notes` text (AR + EN). Unverified claims (blanket B2, IELTS figures, salary ranges without a source) are removed or re-labelled as Darb guidance.
3. **Overlap decision** — proposed: keep all 12 ids (links and AI knowledge reference them) but make the cards honest: Electrical Engineering & IT points out it is the same degree family as Electrical Engineering at most universities; Space Engineering is labelled as a master-level track with the bachelor route (Aerospace / Mechanical) stated. No majors deleted.
4. **Verify** — existing tests extended by one line (engineering majors must carry the same metadata as health), `npm run build`, `npx vitest run`, regenerate `knowledge.generated.ts`, one Playwright screenshot each of an Arabic and an English engineering card.

## Credit-saving rules for the build

- No UI/component edits, no new i18n keys, no new helpers.
- One data write per group of majors (not per field); one test run at the end.
- Research via subagents in parallel, URLs checked in one curl batch.
- Reuse the health source constants and the shared Bagrut tier text verbatim.

## Technical details

- Data shape is identical to the health majors (`MajorGlance`, `LanguageProfile`, `RequirementTiers`, `MajorSource`), inserted right after each major's `nameDE`.
- Shared constants to add once: `SRC_STK_T_KURS` (Studienkolleg T-Kurs listing) and a generic `ENGINEERING_GUIDANCE_AR/EN` (math/physics units as Darb advice, not a requirement).
- `src/data/majorsData.test.ts`: the two health metadata `describe` blocks become a loop over `['health-medical', 'engineering-technology']`.
- `scripts/gen-ai-knowledge.mjs` already emits `languageProfile`/`glance`; just rerun it.
