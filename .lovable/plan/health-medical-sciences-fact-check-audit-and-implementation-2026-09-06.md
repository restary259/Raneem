# Health & Medical Sciences — Fact-Check Audit and Implementation Plan don't forget to add verified required bageut units and how it translates to Herman grade 

Scope: only the category `health-medical` in `src/data/majorsData.ts` (9 majors). No other category is touched. Research date: September 2026. Every finding below was checked this session against Tier-1 sources (anabin, hochschulstart, DAAD, uni-assist, federal law texts, official university pages).

## A. Majors audited (9)

Public Health, Bioinformatics, Biomedical Engineering, Pharmacy, Dentistry, Medicine, Physiotherapy, Veterinary Medicine, Nursing. No major is added or removed.

## B. Cross-cutting findings (apply to all 9)


| Claim on page                                                                                                  | Verdict                     | Evidence                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bagrut gives direct admission for all subjects if Math 3 units + English 4 units + one more subject at 4 units | VERIFIED                    | Read directly in anabin this session, record **ISR-BV01** ("Te'udat bagrut … Mathematik mit 3 Unterrichtseinheiten, Englisch mit 4 Unterrichtseinheiten und ein weiteres Fach mit 4 Unterrichtseinheiten — Direkter Zugang (für alle Fächer) zu allen Hochschulen"). |
| "No official GPA threshold for direct admission"                                                               | VERIFIED                    | Same anabin record — conditions are subject/unit-based only.                                                                                                                                                                                                         |
| Modified Bavarian formula; Bagrut 90 ≈ 1.67, better than 1.5 needs ~93                                         | PARTIALLY VERIFIED          | Formula verified (TUM, Uni Hamburg, KMK GesNot05). The Israel Nmax/Nmin (100/55) is behind anabin's login-only "Notenberechnung" — **not directly verified**. Keep the numbers but label "approximate, verify with uni-assist VPD".                                  |
| Studienkolleg course mapping M-Kurs / T-Kurs                                                                   | PARTIALLY VERIFIED          | Course types verified (Studienkolleg Bonn, Düsseldorf, Hannover, FU Berlin, Heidelberg ISZ). **FU Berlin's Studienkolleg lists Bioinformatik under M-Kurs**, so the page's blanket "T-Kurs" for bioinformatics is university-specific, not nationwide.               |
| APS not needed for Israel                                                                                      | VERIFIED (by omission)      | APS bodies/embassies list China, Vietnam, India, Mongolia; Israel absent.                                                                                                                                                                                            |
| PET not required                                                                                               | UNABLE TO VERIFY as a quote | No German source mentions PET; keep as Darb guidance, not as an "official" statement.                                                                                                                                                                                |
| DSH-2 / TestDaF 4x4 / telc C1 Hochschule / Goethe C2 / DSD II framework                                        | VERIFIED                    | KMK/HRK RO-DT (i.d.F. 27.11.2025). Individual programs may set other levels — must not be stated as universal.                                                                                                                                                       |
| "Israeli Psychometric" / Bagrut units as a formal subject requirement for a specific major                     | NO NATIONWIDE RULE FOUND    | No university checked lists Biology/Chemistry/Physics or Bagrut units as a formal prerequisite for any of the 9 majors. Only grade-based NC / aptitude tests. All "4-5 units recommended" lines must be relabeled as Darb guidance.                                  |


## C. Per-major findings

### Medicine

- VERIFIED: 6 years 3 months incl. PJ (ÄApprO §1; LMU, Goethe Frankfurt "12½ Semester"). Central NC via hochschulstart (30/10/60 quota structure via studienwahl.de/BMG; literal percentages not pulled from hochschulstart text — cite the Verfahrensdetails page). TMS voluntary (tms-info.org). DSH-2/TestDaF 4x4 at LMU, Heidelberg, Charité, Frankfurt, Münster; no B2 exception found.
- INCORRECT / MISSING: non-EU applicants with a foreign HZB (Israelis) do **not** compete in the standard hochschulstart quotas — they apply through **uni-assist / the university's international quota (Vorabquote, "zurzeit 5%" at Frankfurt; Charité: via uni-assist)**, and the route differs per university. Page currently implies the generic "check uni-assist" note only.
- INCORRECT: UMCH Hamburg is listed as an English-taught medicine option without saying it is **not the German Staatsexamen** (MBBS via Romanian UMFST). Must be qualified or removed.
- Relabel: "5 units biology/chemistry recommended", "Bagrut 90+" → Darb guidance.

### Dentistry

- VERIFIED: central NC via hochschulstart; TMS voluntary; DSH-2 class language; non-EU route via uni-assist/international quota (Charité page covers Medizin & Zahnmedizin).
- PARTIALLY VERIFIED: duration. ZApprO §2 says **five years (5,000 hours)** plus staged exams. Page says "official 5 years 6 months" — soften to "10 semesters (5 years) per ZApprO plus final examinations; many universities quote 5.5 years".
- Relabel GPA/science lines as Darb guidance.

### Pharmacy

- VERIFIED: 8 semesters + 8-week Famulatur + 12-month practical year (AAppO §1; Tübingen). Central NC via hochschulstart. German-taught only. Saarland: chemistry/maths "von Vorteil", not required.
- MISSING: **PhaST** (voluntary pharmacy aptitude test used in ZEQ/AdH — Uni Saarland).
- Relabel "4-5 units chemistry/biology recommended" as Darb guidance.

### Veterinary Medicine

- VERIFIED: exactly 5 locations (FU Berlin, LMU, TiHo, Leipzig, Gießen); 11 semesters / 5.5 years (TAppV §1 via TiHo); central hochschulstart; M-Kurs explicitly names Veterinärmedizin (FU Berlin Studienkolleg).
- INCORRECT: page says apply "via uni-assist / Studienkolleg". LMU: "Direktbewerbungen an der Fakultät sind nicht möglich"; TiHo: non-EU applicants go through hochschulstart's ~5% Ausländerquote. Fix the application-channel text.
- PARTIALLY VERIFIED: "C1 German" — LMU requires DSH-2, but **JLU Gießen accepts DSH-1/TestDaF 14/B2 at application**. Present as university-specific.

### Nursing

- VERIFIED: Ausbildung entry = mittlerer Schulabschluss or recognized equivalent (PflBG §11); recognition by the Land authority (e.g. Regierungspräsidium); primärqualifizierender Bachelor exists (PflBG Teil 3; Freiburg, Köln, HSBI).
- INCORRECT: page says "6-semester university BSc". Köln Klinische Pflege = **8 semesters**; typical 7–8. Fix.
- INCORRECT (precision): training pay "≈1,200–1,400". TVAöD-Pflege: **1,293.26 / 1,343.20 / 1,389.02 EUR** (from 1 Apr 2025), rising to 1,368.26 / 1,418.20 / 1,464.02 (from 1 May 2026). Use exact tariff figures + source.
- UNABLE TO VERIFY from Tier-1: "B2 German" for Ausbildung — keep but label as typical/school-specific, not official.

### Physiotherapy

- VERIFIED: Ausbildung entry = Realschulabschluss or equivalent 10-year schooling (MPhG **§10**, not §9); 3-year duration (MPhG §9); reform (PhyThBRefG) **not enacted** as of Bundestag Drs. 20/14431 — old law still applies; ausbildungsintegrierender BSc exists (HS Fulda SPO 2025; HAW Hamburg; MSH private).
- CORRECT WORDING: "university BSc programs are rare" → "limited and mostly ausbildungsintegrierend at Hochschulen (e.g. HS Fulda, HAW Hamburg)".
- UNABLE TO VERIFY: "B2 for Ausbildung" — label as typical/school-specific.

### Public Health

- VERIFIED: Uni Bremen B.A. (zulassungsfrei, 6 sem.), Uni Bielefeld B.Sc. Public Health (ohne NC, 6 sem.), HS Fulda B.Sc. Gesundheitsförderung (foreign HZB via uni-assist), Bayreuth Gesundheitsökonomie (aptitude test + 6-week pre-internship).
- INCORRECT: "a small number of English-taught bachelor programs exist (IELTS 6.0–6.5)" — **no English-taught bachelor was verified**; English-taught options are master-level. Remove IELTS claim from bachelor context.
- MISSING: admission type per university (mostly open / local NC / aptitude), Bremen/Bayreuth internship components.

### Bioinformatics

- VERIFIED: Tübingen (local NC, 6 sem., German), Saarland (no restriction, 6 sem., DSH-2 university-wide), **LMU/TUM joint B.Sc. requires an Eignungsfeststellungsverfahren**, FU Berlin/Charité joint degree with its own Zugangssatzung.
- INCORRECT: "T-Kurs" stated as the Studienkolleg path — FU Berlin puts Bioinformatik in the **M-Kurs**; varies by Studienkolleg. Also "IELTS 6.5" has no verified bachelor basis — move to master-level note only.
- MISSING: aptitude-test admission at LMU/TUM; no formal maths prerequisite beyond HZB found (Tübingen "Grundverständnis" only).

### Biomedical Engineering

- VERIFIED: FAU Medizintechnik (zulassungsfrei, no minimum grade, 6 sem.), TU Ilmenau Biomedizinische Technik (open, 7 sem.), Uni Lübeck MIW (6 sem.; "Leistungskurse Mathematik/Physik keinesfalls Voraussetzung"), HS Anhalt B.Eng. 7 sem.; RWTH **M.Sc.** Biomedical Engineering English-taught (4 sem.).
- UNABLE TO VERIFY: "TUM Biomedical Engineering and Medical Physics" — remove or keep only if re-checked on tum.de.
- Relabel "4-5 units maths/physics recommended" as Darb guidance (Lübeck explicitly says not required).

## D. Unsupported / stale items to remove or qualify

- English-taught bachelor + IELTS figures in Public Health and Bioinformatics.
- UMCH presented as equivalent to German Staatsexamen medicine.
- "T-Kurs" as the sole Studienkolleg path for bioinformatics.
- Veterinary "apply via uni-assist".
- Nursing BSc "6 semesters".
- Any line that reads as if Bagrut units in Biology/Chemistry/Physics are required.
- Current NC cut-off values: not quoted on the page today and will not be added (they change each semester) — link hochschulstart's Grenzwerte/statistics page instead.

## E. Implementation (only after approval)

### Data model (`src/data/majorsData.ts`)

- Add optional typed fields to `SubMajor`:
  - `sources?: { title: string; titleAR?: string; url: string; verifies: string; verifiesAR?: string; checked: string }[]`
  - `requirementTiers?: { official: string[]; officialEN: string[]; universitySpecific: string[]; universitySpecificEN: string[]; darbGuidance: string[]; darbGuidanceEN: string[] }`
  - `lastVerified?: string` (e.g. `"2026-09"`)
- Populate these for the 9 health majors only; rewrite the affected `requiredBackground*`, `languageRequirements*`, `duration*`, `arab48Notes*` strings per sections C/D (AR + EN together; keep numbers identical so `majorsData.test.ts` parity passes).
- Keep `BAGRUT_ANABIN_NOTE_*` unchanged (now verified) but add the anabin ISR-BV01 source entry.

### UI (`src/components/educational/MajorModal.tsx`, `src/utils/majorLocale.ts`)

- New "Admission requirements" block rendering the three tiers with distinct badges: Official requirement / University-specific / Darb guidance (semantic tokens, existing card style, RTL-safe).
- New "المصادر / Sources" section at the bottom: list of direct links (target `_blank`, `rel="noopener noreferrer"`), each with "verifies: …" and "Last verified: September 2026" footer, plus a short disclaimer that requirements change per intake.
- Only renders when data exists, so other categories are visually unchanged.
- i18n keys added to `public/locales/{en,ar}/common.json` under `educational.*`: `modalAdmissionTiers`, `tierOfficial`, `tierUniversity`, `tierDarb`, `modalSources`, `sourceVerifies`, `lastVerified`, `sourcesDisclaimer`.

### Tests / generated artifacts

- Extend `src/data/majorsData.test.ts`: every `sources[].url` is https and non-homepage (path length > 1); tier arrays AR/EN have equal length; `lastVerified` present for all health majors.
- Re-run `bun run scripts/gen-ai-knowledge.mjs` so the AI assistant's knowledge file picks up the corrected text (script unchanged; it already reads the summary fields). Redeploy `ai-chat` afterwards.
- `npm run build` + `npx vitest run` green.

### Source list to embed (per major, direct pages)

Medicine: ÄApprO §1 (gesetze-im-internet.de), hochschulstart Verfahrensdetails, Charité "Medizin & Zahnmedizin (außereuropäisch)", Goethe Frankfurt "Internationale Studienbewerber" (5% Vorabquote), tms-info.org, LMU Deutschkenntnisse. Dentistry: ZApprO §2, hochschulstart, Charité, tms-info.org. Pharmacy: AAppO §1, hochschulstart, Uni Saarland PhaST + FAQ, Tübingen program page. Veterinary: TAppV §1 (TiHo), LMU Vetmed Zulassung, TiHo non-EU page, FU Berlin Studienkolleg M-Kurs, JLU Sprachkenntnisse. Nursing: PflBG §11 and Teil 3, oeffentlicher-dienst.info TVAöD table, Uni Köln Klinische Pflege, Uni Freiburg, RP BW recognition FAQ. Physiotherapy: MPhG §9/§10, PhysTh-APrV, Bundestag Drs. 20/14431, HS Fulda SPO, HAW Hamburg. Public Health: Uni Bremen, Uni Bielefeld ekVV, HS Fulda intl. application, Uni Bayreuth Bewerbung. Bioinformatics: Tübingen, Saarland CBI + Deutschkenntnisse, LMU EFV page, FU Berlin Zugangssatzung, FU Studienkolleg. Biomedical Eng.: FAU Zugang, TU Ilmenau, Uni Lübeck MIW, HS Anhalt, RWTH M.Sc. Cross-cutting: anabin ISR-BV01, KMK GesNot05 + TUM Bayerische Formel, RO-DT, uni-assist Israel page, Studienkolleg Bonn/Düsseldorf.

## F. Second-pass checklist (done before finishing)

Math/English units (anabin only, never per-major) · no Biology/Chemistry/Physics unit "requirements" · German level per university, not "Germany requires C1" · Studienkolleg course stated per Studienkolleg · NC stated as "restricted, see hochschulstart" without stale numbers · anabin/APS/PET qualified correctly · nothing presented as permanent (date stamp visible).