# Partner Schools — data, calculation and QA audit

Audit-first. No redesign. Four schools in scope: KAPITO (Münster), F+U Academy (Heidelberg), GoAcademy! (Düsseldorf), Alpha Aktiv (Heidelberg). Perfekt Deutsch Dortmund is not in the system and stays out of scope.

Delivered in two stages: **Stage 1 = audit report** (no changes to data or code), then, after you approve it, **Stage 2 = fixes**.

## Confirmed starting state

Read from the live database before writing this plan:

| School | Courses | Housing | Levels | Start dates | Policies | Sources | Last verified |
|---|---|---|---|---|---|---|---|
| KAPITO | 4 | 10 | 5 | 24 | 6 | 4 | 18 Sep 2026 |
| F+U Academy | 9 | 22 | 6 | 12 | 11 | 1 | 18 Sep 2026 |
| GoAcademy! | 7 | 7 | 5 | **0** | 16 | 5 | **never** |
| Alpha Aktiv | 11 | 14 | 5 | 12 | 5 | 2 | 18 Sep 2026 |

Price versions: KAPITO has 2026 (archived) and 2027 (current); the other three have a single 2026 current version. No duplicate current versions.

Issues already visible without further digging, to be confirmed and quantified in Stage 1:

- GoAcademy! has no start dates at all and no verification date on the school record.
- F+U Academy has no website URL stored and only one source document.
- Seven courses across GoAcademy! and Alpha Aktiv have **no price rows** (evening, doctors, nursing, private lessons, telc prep). They still appear in the calculator's course dropdown.
- Alpha Aktiv stamps the €50 registration fee on every course including private and evening classes; the brochure needs re-checking on whether it applies to all of them.
- A zero-week accommodation stay currently returns €0 rather than "not applicable", which risks reading as free housing.

## Stage 1 — the audit report

For every school, every course, every housing option, every start date, every policy and every source, each field gets one status: **verified / unverified / missing / conflicting / outdated**, checked against the official uploaded 2026–2027 brochures and price lists plus the schools' current official pages. Anything the source does not print stays unverified — no inference, no borrowing a value from a sibling school.

Then the calculation trace: inputs → course band lookup → accommodation tier → fees → total, checked by hand against each school's own printed example, plus every tier boundary (week before, week at, week after each band edge) and the empty/missing cases.

Output is a table of numbered findings: ID, school, category, field, current value, verified value, status, source, recommended fix, severity. No data or code changes in this stage.

## Stage 2 — the fixes (after you approve the report)

Applied strictly in this order, and only where an official source backs the change:

1. **Data corrections** — wrong prices, wrong durations, wrong fees, duplicates, orphan rows, ordering. Each as a proper migration, never a one-off hand edit.
2. **Removals** — any value the sources do not support becomes null, so the page shows "not recorded — verify with the school" instead of a plausible wrong number.
3. **Filling gaps from official sources** — GoAcademy! start dates and verification date, F+U website and missing source documents, any missing course/housing facts the uploaded documents actually print.
4. **Calculator corrections** — only where the trace shows a real error: tier boundary handling, fee inclusion, and making a missing price or missing duration read as "not recorded" rather than zero. Courses with no published price will not offer a total.
5. **Text and Arabic** — any new label added gets both English and Arabic, right-to-left checked. Existing wording untouched unless it states something the source does not.
6. **Tests and QA** — tier-boundary tests per school, missing-price and missing-duration tests, plus a pass through every tab of all four school pages in English and Arabic, including the catalog links.

## Technical notes

- Reuses the existing tables (`partner_schools`, `school_price_versions`, `school_courses`, `school_course_price_tiers`, `school_level_durations`, `school_accommodations`, `school_accommodation_price_tiers`, `school_start_dates`, `school_policies`, `school_notes`, `school_sources`). No new tables, no parallel architecture, no schema redesign unless a finding proves a column is genuinely missing.
- Pricing logic stays in `src/lib/partnerSchools.ts`; the UI keeps reading it. `quoteCourse`/`quoteAccommodation` already return `null` for an unpriced band — the gap is the zero-week accommodation path and the presence of unpriced courses in the picker.
- Catalog JSON under `src/data/schoolCatalog/` versus the partner-school tables: the report states which is authoritative per field and flags any place a stale JSON value can override verified database data.
- Access rules are not touched.
- Database changes ship as migrations; on this setup they are applied through the migration tool, not by hand.

## Final report sections

Executive summary; data issues; calculation issues; database issues; source/verification issues; fixes implemented; still missing; must be confirmed with the school; calculation test results; regression results; files changed; migrations created; remaining risks; next actions.
