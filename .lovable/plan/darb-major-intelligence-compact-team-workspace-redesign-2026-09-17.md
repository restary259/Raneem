# DARB Major Intelligence — compact team workspace redesign

## Goal

Rebuild Major Intelligence as a fast, minimal three-pane working desk that matches the existing dashboard. A team member can search a major, review or complete **بيانات الطالب**, compare all four university programmes, and reach every source or action without scrolling down a long page.

Locked direction:
- **Palette:** crisp light surfaces, cool borders, deep ink, restrained blue emphasis.
- **Typography:** keep the dashboard’s established Arabic/Latin typography.
- **Layout:** three-pane workspace.
- **بيانات الطالب:** load from the selected case and save confirmed edits back to that case.

## Workspace structure

Use the available dashboard height as one fixed workspace; the document itself does not become a long article.

```text
┌ Search + major ──────────── toolbar / case identity / verification ┐
├ Major & journey ┬ بيانات الطالب ┬ Programme decision workspace ───┤
│ Major search    │ completion     │ 4 university switcher           │
│ Journey steps   │ grouped fields │ verdict + missing + next action │
│ Sources/status  │ save state     │ requirements / route / sources  │
└─────────────────┴────────────────┴──────────────────────────────────┘
```

- **Left pane:** multilingual major search, canonical result, verification date, and an eight-step journey navigator. It provides instant access to Bagrut, German, universities, application route, documents, deadlines, and after-admission information.
- **Middle pane:** persistent **بيانات الطالب** with completion count and compact grouped sections. The case name/reference remain visible. Fields are prefilled from the case, edits are explicit, and Save confirms them to the case.
- **Right pane:** four university programmes as a compact switcher. Selecting one updates a single decision surface rather than adding another long card below it.
- Keep each pane independently scrollable only when its content exceeds its height. Sticky pane headers and action areas preserve context; no page-length stack of cards.
- On smaller screens, the same three areas become a full-height segmented workspace (Major / Student / Programmes), with one area visible at a time and direct switching.

## Direct decision experience

For the selected programme, the first visible block answers:
- **Meets / Does not meet / Not determinable**
- verified date and source state
- missing student information
- the single next team action

Below that, compact tabs expose **Requirements, Application, Documents, Sources** without leaving the workspace. Requirement rows keep official requirement, student value, status, and source visibly separate. The calculated German grade remains labelled **Calculated — not an admission decision** and can never create a positive admission result.

All four programmes remain directly accessible through the switcher, with their current result and missing-item count visible before opening one. Conflicts, stale facts, and unverified facts stay prominent and cannot be collapsed into a confident answer.

## Remembering بيانات الطالب

The current case record already carries the linked major plus a limited set of study fields, including Bagrut score, Math units, English units, and the student’s original preferred-major text. It does not currently contain every intake value needed by the eligibility engine.

Add a validated case-level Major Intelligence intake snapshot for the remaining fields while keeping the existing canonical case fields synchronized where they already exist.

- Load the linked case from `?case=<id>` and prefill the intake.
- Save through one protected backend function that accepts only the known intake keys, validates numeric ranges and German levels, verifies the caller is an admin or the assigned team member, updates the case, and records a case event.
- Preserve the original `degree_interest` exactly as entered by the student.
- Show explicit states: unchanged, unsaved, saving, saved, and failed. Never silently overwrite case data.
- Leaving with unsaved edits triggers a clear warning.
- Opening Major Intelligence without a case remains available as a temporary manual assessment; only a linked case can persist بيانات الطالب.

## UI implementation

- Replace the current stacked page composition in `TeamMajorIntelPage` with a focused workspace shell and small pane components.
- Convert `IntakeForm` into compact grouped controls with missing-field indicators and case-save status.
- Replace repeated full programme cards with one reusable programme decision panel and a four-programme switcher.
- Reuse the existing fact badges, source links, eligibility engine, semantic dashboard tokens, buttons, inputs, and bilingual behavior.
- Use blue only for selection and primary actions; keep eligibility colors semantic (verified/success, warning, destructive) rather than making the page one-note blue.
- Add only restrained transitions between selected journey steps and programmes, respecting reduced motion.
- Update English and Arabic text together; preserve RTL order and Western numerals.

## Technical details

- Add a nullable case-level JSON intake snapshot plus audit timestamp/editor fields through a migration; do not create a parallel student profile or duplicate major fact store.
- Add a guarded save function and explicit grants without weakening existing case access rules.
- Introduce a small case-intake service/hook for loading, mapping existing case values, dirty-state tracking, and saving.
- Keep the fact store and rule engine authoritative. The redesign changes navigation and persistence, not admission logic.
- Preserve deep links from the case’s Field of Study block and make the linked case identity visible in the workspace.
- Add focused tests for case-to-intake mapping, validation, dirty/save states, programme switching, conflict visibility, and the rule that calculated grades never produce a positive admission decision.

## Verification

- Check Arabic and English at desktop and mobile widths.
- Confirm the outer page does not vertically scroll at dashboard desktop height; only pane bodies may scroll.
- Verify every major, journey step, programme, requirement group, source, and save action is reachable directly.
- Verify linked-case data reloads after save and the original preferred-major text remains untouched.
- Run the relevant tests and inspect the current build diagnostics before completion.
