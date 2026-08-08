# Darb — Case Detail Rebuild (Overhaul, next step)

The catalog work is done (schools, tiered pricing, courses and accommodations in the admin Programs page). Next is the Case Detail page, which the earlier audit rated 5.5/10: repetitive sections, documents and timeline with no natural home, a passport blocker that duplicates the profile step, and no way to manually move a case forward.

## What changes

### 1. Three tabs instead of five

```text
Now:  Overview | Student | Program | Financial | Activity
New:  Case     | Program & Finance | History
```

- **Case** — the single working surface: attention tasks, key facts (contact, source, assignee, education), student profile fields, and appointments with their outcomes.
- **Program & Finance** — chosen school, course, accommodation, insurance and dates, directly above the financial summary (services, discounts, paid, balance in ₪).
- **History** — the event timeline plus documents list, out of the way but reachable.

The standalone "Overview" facts card and the duplicated Documents card on the first tab are removed; their content is folded into the two surfaces above.

### 2. Manual stage advancement

The header rail gets a "Move to next stage" control. It offers only the transitions already allowed by the existing forward-only rules (for example Contacted → Appointment scheduled), asks for confirmation, writes the new status, and logs the move to the case timeline. Stages that are driven by other flows (payment confirmation, admin approval, enrollment paid) stay automatic and are shown as disabled with an explanation.

### 3. Remove the passport blocker

The passport document requirement is dropped from the derived task list and from the "Submit to admin" gate — that information is already collected during the profile completion step. Submitting to admin will require: profile complete and payment confirmed.

### 4. Polish pass

- Every new label goes through `t()` with matching Arabic and English entries; no raw keys on screen.
- Dates and money keep the `en-US` digits and ₪ formatting rules.
- RTL check on the new tab layout and the stage-advance menu.

## Technical notes

- `src/pages/team/CaseDetailPage.tsx` — restructure to three `TabsContent` blocks, move documents into History, remove the overview facts card.
- `src/components/cases/CaseProgressRail.tsx` — add an optional next-stage action rendered beside the rail; keeps the pure dot rail when no handler is passed.
- `src/components/cases/caseTasks.ts` — drop `REQUIRED_DOCUMENT_CATEGORIES` passport rule; update the unit tests that cover it.
- `src/lib/caseTransitions.ts` — reused as-is for the allowed next steps; no rule changes.
- New: a small `advanceCaseStage` service call in `src/services/` that updates status and writes a `case_events` note, so the page holds no direct write logic.
- `public/locales/[ar|en]/dashboard.json` — new keys under `case.tabs`, `case.stage.*`.
- No database or RLS changes.

## Verification

- Unit tests for `deriveCaseTasks` updated and passing.
- Playwright run over the case route: tabs render, stage advance appears only for legal transitions, timeline records the move.
- Manual check in Arabic for layout and translated labels.
