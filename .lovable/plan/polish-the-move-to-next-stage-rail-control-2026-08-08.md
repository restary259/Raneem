# Polish the "Move to next stage" rail control

Goal: make it obvious *why* the button is disabled and exactly *what* confirming will do, with clean Arabic and English copy.

## What's wrong today

- The disabled button shows one generic hint for every situation ("The next stage happens automatically once payment or admin review completes"). That sentence is wrong for a finished case (`enrollment_paid`) and for a cancelled/forgotten case — both also produce zero manual next stages.
- The hint lives only in a native `title` tooltip: invisible on touch, unreliable for screen readers.
- The confirmation dialog names the destination stage but not the stage the case is leaving, and doesn't say the move is visible on the student-facing timeline.
- The dropdown (multiple next stages) has no header, so the list of stage names appears with no context.

## Changes

### 1. Reason-aware disabled hint (`CaseProgressRail.tsx`)

Derive one of three reasons instead of assuming "automated":


| Situation                                                                | Hint                                                                                                                                                                                       |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current stage is terminal (`enrollment_paid`)                            | "This case has reached the final stage."                                                                                                                                                   |
| Current stage is `cancelled` or `forgotten`                              | "Reopen the case before moving it forward."                                                                                                                                                |
| Next stage exists but is automated (payment / admin review / enrollment) | "Next stage is &nbsp; — it happens automatically once <payment confirmed / admin review / enrollment payment> is recorded." Name the actual blocked stage rather than listing all of them. |


Render the hint as a `Tooltip` wrapping the disabled button (the button gets a wrapper span so the tooltip still fires while disabled) and mirror the same text into `aria-describedby`, so it works on touch and with a screen reader.

### 2. Clearer confirmation dialog (`CaseDetailPage.tsx`)

- Title: "Move to &nbsp;" instead of the generic "Move to next stage".
- Body: names both ends of the move and the visibility consequence — "This case moves from &nbsp; to &nbsp;. The change is recorded on the case timeline and is visible to the student."
- Confirm button shows a pending label while writing ("Moving…") rather than only going grey.

### 3. Dropdown label

Add a `DropdownMenuLabel` ("Choose the next stage") above the options.

### 4. Translations

Add the new keys to both `public/locales/en/dashboard.json` and `public/locales/ar/dashboard.json` under `case.stage`:
`reasonTerminal`, `reasonInactive`, `reasonAutomated`, `automatedTrigger.payment_confirmed`, `automatedTrigger.submitted`, `automatedTrigger.enrollment_paid`, `confirmTitle`, `confirmBody`, `confirmPending`, `chooseNext`.
Remove the now-unused `automatedHint` and `confirm` keys from both files. Arabic copy stays natural (not literal), reuses the existing `case.status.*` stage names so interpolation matches the rail labels, and all inline `defaultValue` fallbacks in the components are kept in sync with the English file.

## Technical notes

- Reason detection reads the existing `getNextSteps` output plus `AUTOMATED_STAGES` from `src/services/CaseStageService.ts`; a small exported helper `stageBlockReason(current)` returns `{ kind, stage }` so the rail stays presentational and the rule is unit-testable.
- Add unit tests for `stageBlockReason` in the existing `src/components/cases/caseTasks.test.ts` neighbourhood (new `CaseStageService.test.ts`) covering terminal, cancelled and automated cases.
- No database, RLS, or transition-rule changes — `advanceCaseStage` and `canTransition` behaviour is untouched.
- Verify by loading a case in Arabic and in English and checking that no raw `case.stage.*` key renders.      
- &nbsp;