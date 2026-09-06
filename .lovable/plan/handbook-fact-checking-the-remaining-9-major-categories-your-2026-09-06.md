# Handbook: fact-checking the remaining 9 major categories yourself

This is the exact method used for Health & Medical (9 majors) and Engineering & Technology (12 majors). Follow it for the remaining **62 majors** in 9 categories, then ask me to verify. Nothing in the UI, translations, helpers or tests needs to change — the card switches to the "verified" layout automatically the moment a major carries the new fields.

## 1. What is left

| Category id | Majors (ids in `src/data/majorsData.ts`) |
|---|---|
| `computer-it` (7) | computer-science, artificial-intelligence, cybersecurity, data-science, cloud-computing, game-development, information-management |
| `natural-sciences` (5) | environmental-science, mathematics, physics, chemistry, biology |
| `social-sciences` (8) | psychology, sociology, political-science, philosophy, social-work, linguistics, media-communication, history |
| `business-management` (8) | business-administration, international-business, marketing, finance-accounting, entrepreneurship, supply-chain, human-resources, economics |
| `law` (3) | international-law, criminal-law, business-law |
| `arts-design` (6) | architecture, fine-arts, graphic-design, music, theater, film-media |
| `education` (5) | elementary-education, special-education, educational-psychology, curriculum-instruction, educational-administration |
| `agriculture-environment` (5) | agricultural-science, environmental-management, forestry, marine-science, sustainable-development |
| `tourism-hospitality` (5) | tourism-management, hotel-management, culinary-arts, event-management, travel-tourism |

Do one category at a time. Keep every existing `id` (links and the AI knowledge file reference them). Do not delete majors; if two overlap (like Electrical vs Electrical & IT), say so honestly in the text instead.

## 2. What was added to each major (the data shape)

Five new fields, inserted right after `nameDE:` inside the major object. All are already declared in `SubMajor` at the top of the file; you only fill them.

```text
lastVerified:     '2026-09'                          (YYYY-MM string)
glance:           { degree, admissionMode, applicationChannel }  each with an EN twin
languageProfile:  { teachingLanguage, requiredLevel, acceptedCertificates[],
                    exceptions[] (optional), englishOption }     each with an EN twin
requirementTiers: { official[], universitySpecific[], darbGuidance[] } each with an EN twin
sources:          [ { title, titleAR, url, verifies, verifiesAR, checked } ... ]  (3 or more)
```

Then the existing text fields were **corrected**, not rewritten: `duration/durationEN`, `requiredBackground/EN`, `languageRequirements/EN`, `arab48Notes/EN`. Marketing prose (`description`, `detailedDescription`, `suitableFor`, `careerProspects`) was left alone unless it contained a false fact.

### Copy-paste template (taken from the finished `bioinformatics` entry, lines 350–426)

```ts
lastVerified: HEALTH_LAST_VERIFIED,            // for a new category create e.g. COMPUTER_IT_LAST_VERIFIED = '2026-09'
glance: {
  degree: 'B.Sc.', degreeEN: 'B.Sc.',
  admissionMode: 'بلا قيود (سارلاند) / NC محلي (توبنغن) / اختبار كفاءة (LMU/TUM)',
  admissionModeEN: 'No restriction (Saarland) / local NC (Tübingen) / aptitude test (LMU/TUM)',
  applicationChannel: 'uni-assist (لحاملي الشهادات الأجنبية) أو الجامعة مباشرة',
  applicationChannelEN: 'uni-assist (foreign certificates) or the university directly',
},
languageProfile: {
  teachingLanguage: 'الألمانية', teachingLanguageEN: 'German',
  requiredLevel: 'C1 — تحدده كل جامعة', requiredLevelEN: 'C1 — set by each university',
  acceptedCertificates: ['DSH-2', 'TestDaF 4×4', 'telc C1 Hochschule', 'Goethe-Zertifikat C2', 'DSD II'],
  acceptedCertificatesEN: ['DSH-2', 'TestDaF 4×4', 'telc C1 Hochschule', 'Goethe-Zertifikat C2', 'DSD II'],
  englishOption: 'لا يوجد بكالوريوس بالإنجليزية تم التحقق منه (خيارات إنجليزية في الماجستير فقط)',
  englishOptionEN: 'No verified English-taught bachelor (English options at master level only)',
  exceptions: ['جامعة سارلاند: DSH-2 على مستوى الجامعة'],
  exceptionsEN: ['Saarland University: DSH-2 university-wide'],
},
requirementTiers: {
  official:   [BAGRUT_TIER_OFFICIAL_AR, '…one sentence: no nationwide extra rule for this major…'],
  officialEN: [BAGRUT_TIER_OFFICIAL_EN, '…same in English…'],
  universitySpecific:   ['University X (B.Sc. Name): local NC, 6 semesters, German.', '…'],
  universitySpecificEN: ['…same order, same count…'],
  darbGuidance:   ['…Darb advice, clearly marked as advice, not a condition…'],
  darbGuidanceEN: ['…'],
},
sources: [
  SRC_ANABIN_ISR,                                    // always first
  { title: 'Universität Tübingen — Bioinformatik, Bachelor', titleAR: 'جامعة توبنغن — …',
    url: 'https://uni-tuebingen.de/…/exact-program-page/', verifies: 'Local NC, 6 semesters, German-taught.',
    verifiesAR: 'NC محلي، 6 فصول، بالألمانية.', checked: CHECKED },
  SRC_RO_DT,                                         // language framework
  SRC_UNIASSIST_IL,                                  // when uni-assist is the channel
],
```

### Reusable constants that already exist (do not redefine them)

- `CHECKED = '2026-09-06'` — change to the real date you check on, or add `const CHECKED_2 = '…'`.
- Sources: `SRC_ANABIN_ISR`, `SRC_KMK_GESNOT`, `SRC_TUM_FORMULA`, `SRC_RO_DT`, `SRC_UNIASSIST_IL`, `SRC_HOCHSCHULSTART`, `SRC_HOCHSCHULSTART_INTL`, `SRC_HOCHSCHULSTART_STATS`, `SRC_STK_FU`, `SRC_STK_BONN`, `SRC_STK_T` (T-Kurs).
- Text: `BAGRUT_TIER_OFFICIAL_AR/EN` (the anabin rule sentence, always the first `official` item), `APPLY_NOTE_AR/EN`, `BAGRUT_ANABIN_NOTE_AR/EN` (for `arab48Notes`), `ENG_CERTS` (the standard certificate list).
- Per-category constants used for engineering (copy the pattern): `ENG_OFFICIAL2_*`, `ENG_GUIDE_MATH_*`, `ENG_GUIDE_C1_*`, `ENG_LANG_*`, `ENG_NO_EN_*`. For the new categories add the Studienkolleg course source that applies: **W-Kurs** (business/economics/social sciences), **G-Kurs** (humanities, languages, arts, law in some Kollegs), **S-Kurs** (languages), **M-Kurs** (biology/chemistry side of natural sciences), **T-Kurs** (maths/physics/computer science). Add one `SRC_STK_W`, `SRC_STK_G`, … pointing at `https://studienkollegs.de/Studienkollegsarten.html`-style pages or a specific Kolleg listing.

## 3. Hard rules that made the data trustworthy

1. **Three tiers, never mixed.** `official` = law or nationwide bodies only (anabin, KMK, Hochschulstart, RO-DT, state licensing law). `universitySpecific` = one named university + one named program per bullet, taken from that program's own page. `darbGuidance` = our advice, and the sentence itself must say it is advice ("نصيحة من درب — ليست شرط قبول").
2. **Never invent Bagrut units.** The only official Bagrut rule is anabin ISR-BV01 (Maths 3 / English 4 / one more subject at 4 units). Anything like "5 units maths required" goes in `darbGuidance`, never in `official`.
3. **Language level comes from the program page**, not from habit. If the page says DSH-2 / TestDaF 4×4, write C1. If a university (like JLU Giessen) accepts less at application time, put it in `exceptions`. If nothing is stated, write "set by each university (RO-DT framework)".
4. **English-taught bachelor**: only write "exists" if you opened the program page of a **public** university and it says the bachelor is taught in English. Otherwise write "no verified English-taught bachelor". (Business and computer science will actually have some — cite them.)
5. **Numbers** (semesters, salaries, unit counts) must be identical in AR and EN, written with Western digits. The test suite compares them automatically.
6. **Shared terms** (`anabin`, `uni-assist`, `DSH-2`, `TestDaF`, `IELTS`, `C1`, `NC`) must appear in both AR and EN text of the same field, in Latin letters. University names may be Arabised.
7. **Salary ranges** stay only if a source backs them (e.g. gehalt.de, Stepstone, Bundesagentur Entgeltatlas); otherwise soften to "varies by sector" or drop.
8. **Every source URL**: `https`, points at a specific page (never a homepage — the test rejects a path of `/`), and was opened by you on the `checked` date. `verifies` must be a real sentence (more than 10 characters) saying what claim that page proves.
9. **Special routes per category** — check and state them:
   - Law: the German Staatsexamen route vs. LL.B.; foreign students and the bar; `international-law` / `criminal-law` / `business-law` are not separate German bachelor degrees — say which real program family they map to (Rechtswissenschaft Staatsexamen, Wirtschaftsrecht LL.B.).
   - Education: teacher training (Lehramt) is state-regulated; civil-service note `BEAMTE_NON_EU_NOTE_AR/EN` already exists — reuse it.
   - Psychology, architecture, medicine-like NC subjects: Hochschulstart vs. local NC; architecture / arts / music / theater / film need **portfolio or entrance exam (Eignungsprüfung)** — that goes in `admissionMode`.
   - Social work: many are at Hochschulen für angewandte Wissenschaften with pre-internship (Vorpraktikum).
   - Tourism / hospitality / culinary: often private or dual; note that public options are limited and that `culinary-arts` is an Ausbildung, not a degree.

## 4. How the sources were found (the research routine per major)

For each major, in this order (about 15–25 minutes each):

1. **Find the real German program name.** Search `"<German name>" Bachelor Universität` (e.g. `Psychologie B.Sc. Universität`) and confirm the `nameDE` in the file is the name universities actually use. Fix it if not.
2. **Pick 2–3 public universities** using Hochschulkompass (`hochschulkompass.de/studium/studiengangsuche`) filtered to Bachelor + public. Prefer a mix: one big university, one TU/Hochschule, one that is open-admission if such exists.
3. **Open the program page of each** and record: degree, regular semesters, admission mode (zulassungsfrei / örtlicher NC / Hochschulstart / Eignungsprüfung), language requirement wording, application channel (uni-assist vs. direct portal), pre-internship, and whether an English track exists. Copy the URL of *that* page.
4. **Open the university's international-applicants language page** if the program page does not state the level (e.g. `…/international/…/deutschkenntnisse`). That page becomes a second source.
5. **Studienkolleg course**: open one Kolleg's Kursarten page and confirm which course (T/M/W/G/S) lists this major.
6. **Nationwide layer**: reuse `SRC_ANABIN_ISR`; add `SRC_HOCHSCHULSTART` if the subject is centrally allocated (Psychology is not nationwide NC any more — check); add `SRC_RO_DT` for language.
7. **Check every URL once** with a plain browser reload (200, not a redirect to the homepage). Dead or redirected pages were replaced, not kept.
8. **Write the tiers** from your notes, AR and EN in the same order with the same count.

Google operators that helped: `site:uni-xyz.de <program> Bachelor Zulassung`, `site:uni-xyz.de Sprachnachweis DSH TestDaF`, `site:studienkollegs.de <Fach>`, `site:hochschulkompass.de <Fach> Bachelor`.

## 5. Files you touch and files you must NOT touch

- **Edit only** `src/data/majorsData.ts`.
- Do **not** edit `MajorModal.tsx`, `majorLocale.ts`, `common.json`, or the tests — they already handle any category.
- One line of test wiring is needed per category: in `src/data/majorsData.test.ts` line 72, add the category id to `VERIFIED_CATEGORIES`, e.g. `['health-medical', 'engineering-technology', 'computer-it']`. That turns the strict checks on for your new data.
- After each category run (in order):
  1. `npx vitest run src/data/majorsData.test.ts` — parity, numbers, https, source paths, AR/EN array lengths.
  2. `npm run build` — TypeScript catches a missing EN twin or a typo in a key name.
  3. `bun run scripts/gen-ai-knowledge.mjs` — regenerates `supabase/functions/ai-chat/knowledge.generated.ts` so the assistant answers from the same facts (commit that file too; the edge function needs a redeploy afterwards — I can do that at verification time).
  4. Open `/educational-programs`, click the category, open one card in Arabic and one in English; you should see the fact chips, "Last verified: September 2026", the Bagrut block, the language table and the source list.

## 6. What I will check when you come back

- Every major in the category has all five fields and appears in `VERIFIED_CATEGORIES`.
- Tiers are correctly classified (nothing university-specific in `official`, no Bagrut-unit invention).
- I will HTTP-check every new URL and spot-open ~20% of them to confirm the `verifies` sentence matches the page.
- AR/EN parity, Western digits, shared terms — via the test suite.
- Build, full vitest, regenerated knowledge file, and two Playwright screenshots per category.

## Technical details

- Type definitions: `src/data/majorsData.ts` lines 6–49 (`MajorSource`, `RequirementTiers`, `MajorGlance`, `LanguageProfile`); `SubMajor` optional fields lines 76–86.
- Finished reference entries: any health major (lines 278–1000) or engineering (lines 1002–1020, single-line objects).
- Card rendering order (already built): glance chips + verified badge → Bagrut / tiers → language table → application info → about → careers → Arab 48 notes → sources (`MajorModal.tsx` lines 93–244). The plain `requirements` paragraph is hidden automatically once `requirementTiers` exists.
- Tests: `src/data/majorsData.test.ts` — AR/EN numeric parity and shared-term parity for all majors (always on); metadata strictness only for ids in `VERIFIED_CATEGORIES`.
