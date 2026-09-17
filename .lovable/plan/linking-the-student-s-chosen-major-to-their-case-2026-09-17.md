# Linking the student's chosen major to their case

## Short answer

Yes — but as a **suggestion the team confirms**, not an automatic hard link.

The major a student types on the application form is free text, and the real data shows why an automatic link would be wrong. Actual entries currently stored include "Machnical  engineering" (typo), "هايتك IT", "مهندسة سيارات", "دكتوراه" (a degree level, not a major) and "بدي اسال عن موضوع السكن" (a housing question typed into the major box). Silently binding those to a verified major would attach official admission requirements to the wrong field of study — exactly the failure the Major Intelligence rules exist to prevent.

So: match automatically, display the match as a proposal, and only store a real link once a team member confirms it.

## How it works

1. A case is created from the apply form as it is today. The typed text is kept unchanged.
2. On the case, the team sees a "Field of study" line with a proposed match resolved from the typed text through the existing multilingual alias search (Arabic / Hebrew / English / German).
3. Three possible outcomes, shown plainly:
   - Confident match to a major → "Suggested: Computer Science — Confirm / Choose another".
   - Several possible matches → a short picker.
   - No match (or the text is not a major at all) → "No match — pick a major" with search.
4. Once confirmed, the case is linked to that major. The case page then shows a direct link into Major Intelligence for that major, pre-filled with this student.
5. The team can change or clear the link at any time. The original typed text is never overwritten.

## Notes

- A link to a major that is not yet verified is allowed; it simply opens as "not verified" in Major Intelligence, same as today.
- Nothing about eligibility is decided by this link. It only says "this case is about this field of study".

## Technical details

- New nullable column `cases.intel_major_id` (text, the `MajorIntel.id`) plus `intel_major_confirmed_by` / `intel_major_confirmed_at` for audit. Migration is manual (`supabase db push` or the SQL editor), with a `GRANT`-consistent RLS review: writeable by admin and the assigned team member only, via the existing case update policies.
- Matching runs client-side in the team UI using `searchMajors()` from `src/data/intel/majorIntel.ts` — no edge-function change, no server inference, no new data source. `degree_interest` stays the raw text of record.
- New small component `src/components/cases/CaseMajorLink.tsx`, rendered in `CaseOverviewTab.tsx` next to the existing `degree_interest` row; same pattern for `AdminPipelinePage` detail panel.
- `TeamMajorIntelPage` accepts `?major=<id>&case=<caseId>` so "Open in Major Intelligence" lands directly on the major with the student's case context.
- i18n keys added to `en` + `ar` together under `case.overview.*` / `intel.*` (parity guard).
- No change to the apply form, the lead insert, commission, or attribution paths.
