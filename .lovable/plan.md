# Major Intelligence — workflow and usability fixes

Six changes to the team's major search desk. No change to the eligibility rules, the verified facts, or how student data is saved to a case.

## 1. A useful first screen

Today the page opens on an empty list until someone types. Instead, before any typing the left pane shows:

- **Ready to use** — the majors that have been fully checked against official sources (currently Computer Science).
- **Recently opened** — the last five majors this team member looked at, remembered on their own device.

Typing replaces both lists with results as it does now.

## 2. Honest dead ends

A major that has not been checked yet currently opens an apologetic panel and stops. It will instead show what is known, state plainly that the programme details are not confirmed, and offer a **Request verification** button that records the request so the content team can see which majors are being asked for most.

## 3. Working journey steps

The eight steps on the left (Major, Bagrut, German, Universities, Application, Documents, Deadlines, After admission) currently do almost nothing. Each step will scroll the right pane to its matching part of the programme details and highlight it. Steps with nothing recorded for the selected programme appear dimmed and cannot be clicked, so nobody hunts for content that does not exist.

## 4. Tell the team what is missing

The student panel shows a completion percentage with no explanation. It will list the exact fields still blank, each as a button that jumps to and focuses that field. Any verdict affected by a blank field is marked so the team knows the answer is provisional, not final.

## 5. Phone layout that keeps the comparison together

On a phone the Student and Programmes tabs merge into one scrolling view: student fields on top, the verdict directly underneath, so the answer is visible while editing. The Major tab stays separate for search. The programme switcher becomes a horizontal row of chips.

## 6. Safer saving

Changes to a real case save on their own a few seconds after typing stops. A single line under the fields reads Saving, Saved with the time, or Failed with a Retry button. The manual Save button stays for anyone who wants it. Outside a case nothing is saved and the existing temporary-assessment notice stays.

## Technical notes

- Recently-opened majors: `localStorage`, per user, capped at five, ids only.
- Verification requests: a new `intel_verification_requests` table (major id, requester, timestamp, one row per user per major) with row-level security — insert by team members and admins, read by admins.
- Journey steps: section ids inside `ProgramCard`, with an availability map derived from the programme record; scrolling via `scrollIntoView` inside the existing pane scroll container.
- Missing fields: reuse `missingIntakeFields` from the eligibility engine; map each field id to its input id for focus.
- Autosave: debounced 1.5s wrapper around the existing `MajorIntelligenceService.saveCaseIntake`, in-flight guard, no save when nothing changed, unload warning retained until the last save settles.
- All new text added to both English and Arabic dashboard locale files; layout uses logical properties so Arabic mirrors correctly.
- Tests: recent-majors store, journey availability map, missing-field mapping, autosave debounce and failure path. Build and full test suite run before delivery.
