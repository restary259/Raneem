# DARB Major Intelligence — first slice

An internal team tool at `/team/majors`. A team member searches a major and immediately sees: what to ask the student, what the Bagrut and German requirements are, which real university programmes exist, and where every fact came from. Built around one strict rule: **no source, no fact** — "not verified" is a valid, visible answer.

This first slice builds the whole engine and proves it with **Computer Science / Informatik**, fully researched with real university programmes. All other majors appear in search with an honest "not verified yet" state.

## What the team member sees

1. **Search** — one box matching Arabic, Hebrew, English and German names (علوم الحاسوب / מדעי המחשב / Computer Science / Informatik) onto one canonical major.
2. **Header** — canonical name, degree level, verification badge and last-verified date.
3. **Student check** — a short intake form (Bagrut year and result, Maths units + grade, English units + grade, one further subject, German level + certificate + expected date). When opened from a case it pre-fills from that case; otherwise it starts blank, and the team can edit either way.
4. **Questions to ask** — a fixed checklist with a one-line reason next to each question.
5. **Bagrut requirements** — a table: official requirement / student's value / status (meets · does not meet · not determinable).
6. **German grade** — the converted grade, labelled as a calculation, never as an admission decision; the official requirement is shown separately with its own source.
7. **Language** — teaching language, required level, accepted certificates, university exceptions — each with its own source.
8. **University options** — one decision card per verified programme, each showing a per-requirement pass/fail against this student, what is missing, and the concrete next action.
9. **Sources** — every source used on the page, with authority tier and check date.

Missing information shows as "no official requirement found — do not assume one". Two official sources disagreeing shows both, marked as a conflict, with no automatic resolution.

## Where the facts live

Facts stay in versioned code files (same approach as today's majors data), so nothing can be edited into the tool without going through a change. Each fact carries its value, its type (official requirement, official procedure, official deadline, calculated value, or DARB guidance), its source, the source's authority tier, the date it was checked, and its verification status.

For Computer Science I will research and record four real Bachelor programmes from official university pages and admission regulations. The same file format is what your team can extend for the next majors — every new entry must carry a source URL and a check date or it will not render.

## Explicitly not in this slice

- No AI answering over this data yet (the engine and fact store come first).
- No database tables, no admin editing screen.
- No changes to the public majors page.

## Technical notes

- New `src/data/intel/` layer: `factTypes.ts` (fact + source schema, authority tiers, verification status), `majorIntel.ts` (canonical majors, aliases in ar/he/en/de, programme requirement records), `computerScience.ts` (the researched Computer Science entry).
- `src/lib/eligibility/` — a pure rule engine mapping student intake × programme requirements → `MEETS` / `DOES_NOT_MEET` / `NOT_DETERMINABLE`, plus missing-item and next-action derivation. Unit-tested, including the "stale", "conflicting" and "no requirement published" paths.
- Bagrut → German grade reuses `src/utils/gradeConverter.ts` unchanged; the result is tagged `CALCULATED_VALUE` and can never satisfy an official requirement in the rule engine.
- New page `src/pages/team/TeamMajorIntelPage.tsx` + components under `src/components/team/intel/`, lazy-routed in `App.tsx` behind the existing team guard, with a sidebar entry and mobile "More" entry.
- Case pre-fill reads the existing case/profile fields already used by the team student views; no new database reads beyond those.
- i18n keys added to `en` + `ar` together (parity guard), Western numerals, RTL-safe logical properties.
- Verification: `npm run build` and `npx vitest run` green, plus browser screenshots of the Computer Science page in Arabic and English.
