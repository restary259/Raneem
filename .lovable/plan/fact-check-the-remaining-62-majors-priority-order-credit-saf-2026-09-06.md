# Fact-check the remaining 62 majors — priority order, credit-safe batches

Same treatment as Health and Engineering: research → data-only insert into `src/data/majorsData.ts` → tests/build/AI-knowledge regeneration → two screenshots. No UI, i18n, helper or test-framework changes. Every id is kept.

## Priority order (most-asked by Arab 48 students first)

Each wave is committed and verified on its own, so if credits run out the finished waves are already live.

```text
Wave 1  (highest demand)  computer-science, psychology, business-administration,
                          architecture, data-science, artificial-intelligence,
                          cybersecurity, economics, social-work
Wave 2                    business-law, international-law, criminal-law (Law family, mapped to
                          Rechtswissenschaft Staatsexamen / Wirtschaftsrecht LL.B.),
                          finance-accounting, international-business, marketing,
                          biology, chemistry, physics, mathematics
Wave 3                    software-ish IT rest: cloud-computing, game-development,
                          information-management; elementary-education, special-education;
                          media-communication, political-science, sociology
Wave 4                    environmental-science, entrepreneurship, supply-chain,
                          human-resources, philosophy, linguistics, history,
                          educational-psychology, curriculum-instruction, educational-administration
Wave 5  (lowest demand)   arts-design rest (fine-arts, graphic-design, music, theater, film-media),
                          agriculture-environment (5), tourism-hospitality (5)
```

Whole categories get switched on in the test (`VERIFIED_CATEGORIES`) only once every major in that category is done; until then the strict checks stay off for the partial category and nothing breaks.

## Per wave

1. **Research** — parallel subagent passes, 3 majors each, returning per major: real German program name, 2–3 public universities with the exact program page, admission mode, application channel, degree + semesters, language level as written on the page, verified English-taught bachelor (business/CS will have some), pre-internship / portfolio / Eignungsprüfung, Studienkolleg course (T/M/W/G/S), one nationwide source where applicable, salary source or drop the figure.
2. **URL check** — one curl batch per wave; dead/redirecting pages replaced.
3. **Data** — one scripted insert per wave: `lastVerified`, `glance`, `languageProfile`, `requirementTiers`, `sources`; corrected `duration`, `requiredBackground`, `languageRequirements`, `arab48Notes` (AR + EN). Shared constants added once: `SRC_STK_W`, `SRC_STK_G`, `SRC_STK_M`, `SRC_STK_S`, category guidance text.
4. **Verify** — `npx vitest run src/data/majorsData.test.ts`, build log, `bun run scripts/gen-ai-knowledge.mjs`, one Arabic + one English Playwright screenshot.

## Category-specific honesty rules

- Law: the three ids are not separate German bachelors — cards state the real route (Staatsexamen for the classic path; LL.B. Wirtschaftsrecht at Hochschulen) and that the German bar requires the Staatsexamen.
- Psychology: local NC at almost every university, not Hochschulstart; B.Sc. is not a psychotherapist licence (new PsychThApprO route noted).
- Architecture / arts / music / theater / film: portfolio or entrance exam goes in `admissionMode`.
- Education: Lehramt is state-regulated, reuse `BEAMTE_NON_EU_NOTE_*`; educational-administration / curriculum-instruction are master-level tracks, said openly.
- Tourism / culinary: mostly private/dual; culinary-arts is an Ausbildung, not a degree.
- Nothing without a source; Bagrut units beyond anabin only ever as Darb guidance.

## Technical details

- Edits: `src/data/majorsData.ts` only, plus the `VERIFIED_CATEGORIES` array in `src/data/majorsData.test.ts` per completed category, plus the regenerated `supabase/functions/ai-chat/knowledge.generated.ts` (edge function redeploy at the end).
- Data shape identical to bioinformatics/engineering entries; reuse `SRC_ANABIN_ISR`, `SRC_RO_DT`, `SRC_UNIASSIST_IL`, `SRC_HOCHSCHULSTART*`, `BAGRUT_TIER_OFFICIAL_*`, `ENG_CERTS`, `APPLY_NOTE_*`.
- Credit rules: no component/i18n edits, one write per wave, one test run per wave, research by parallel subagents.
