# Major lookup — simple search, one card, five tabs

Replace the three-pane Major Intelligence workspace with a plain lookup: a search box, a list of subjects, and one card per subject with tabs. No student data panel, no case saving on this page.

## Screen 1 — search

- One centred search box (same look as the public majors page search).
- Below it, the full subject list grouped by category, filtered as you type.
- Search still matches Arabic, Hebrew, English and German names.
- Recently opened subjects stay as a small row above the list.

## Screen 2 — the major card

Clicking a subject opens one card. Header: subject name (AR/EN/DE) and category. Back returns to the search.

Tabs:

1. **Language** — German level required, accepted certificates (Telc / TestDaF / DSH), and the language-timing note: roughly 10 months of language school, about 12 months including sitting Telc / TestDaF / DSH.
2. **Bagrut** — required units and subjects, plus the Bagrut average and its German grade equivalent.
3. **Our schools & cities** — the language schools and cities we actually work with (from the existing catalog).
4. **Deadlines** — when applications open and close, and the recommended month to start the language course counting back from that deadline.
5. **Universities** — up to four recommended universities for that subject.

## Empty by design

Every subject gets the same card shell so all of them look finished. Where a subject has no confirmed content yet, each tab shows a short "not filled in yet" line instead of invented text. Content gets added manually later, subject by subject. Computer Science keeps the content it already has.

## What goes away

- The three-pane workspace, the student intake panel, the journey step rail, autosave and case saving on this page.
- The programme-by-programme requirement checker moves out of this page; the card shows subject-level facts only.
- The case-level student intake data already stored is left untouched — nothing is deleted.

## Technical notes

- Rework `src/pages/team/TeamMajorIntelPage.tsx` into two states (list, detail); drop `IntakeForm`, `useIntakeAutosave`, journey rail and `ProgramCard` usage from it.
- New `src/components/team/intel/MajorCard.tsx` with the five tabs; reads from a per-major content shape extending `src/data/intel/types.ts` with optional `language`, `bagrut`, `schools`, `deadlines`, `universities` blocks.
- Subject list comes from `majorsData`; verified content stays in `src/data/intel/*` so nothing invented appears.
- Schools/cities read the existing active `schools` catalog rows.
- Keep `recentMajors.ts`. Retire `journey.ts`, `intakeFields.ts`, `useIntakeAutosave.ts` and the intake tests along with their imports.
- Bilingual RTL-aware labels added to both `dashboard.json` locales together.
