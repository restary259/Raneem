# Case pipeline rework — profile → payment → submit

## Goal

Make the team's case workflow match how the work actually happens:

1. Team completes and saves the student profile (editable until it is sent).
2. A separate **Payment** step confirms the ₪ fee was received.
3. **Submit to admin** is the final team action.
4. Finance shows a full breakdown of everything the student pays.
5. Scheduling an appointment actually creates one and unblocks the next stage.

## Current state (verified)

- Pipeline stages in the database, the `pipeline_statuses` table, the stage-transition trigger and the frontend all agree: `new → contacted → appointment_scheduled → profile_completion → payment_confirmed → submitted → enrollment_paid` (plus `forgotten` / `cancelled`). The order the user asked for is already the stored order — the problem is where the buttons live in the UI.
- `CaseStageBlock.tsx` renders the profile form **and** the "Confirm payment" button inside the same `profile_completion` block, so payment looks like part of filling the profile.
- The profile form is only mounted during `profile_completion`; there is no way to edit it during the payment step, before submitting.
- The database refuses `contacted → appointment_scheduled` unless an appointment row exists, and refuses `appointment_scheduled → profile_completion` unless every appointment has a recorded outcome. Those guards are correct and stay.
- The only case in the database is at `submitted` with **zero** appointment rows, so no successful schedule has ever been recorded. The `appointments` table does have every column the scheduler writes (`guest_name` included), so the cause of the failed schedule is **not confirmed yet** — the scheduler swallows the real error behind a generic "action failed" toast. Diagnosing it is the first step, not an assumption.

## Plan

### 1. Fix appointment scheduling (first)

- Surface the real error in `AppointmentSchedulerModal`: show the database message in the toast and log it, instead of the generic `common.actionFailed`.
- Check the result of the follow-up `cases` status update — it is currently fired and ignored, so a blocked transition passes silently. Use a returning update and report `STAGE_BLOCKED` messages in plain language.
- Only move the case to `appointment_scheduled` when the case is at `contacted`; scheduling an extra appointment later must not attempt a transition.
- Reproduce end to end in a browser run against a fresh case (contacted → schedule → verify the row and the new stage), then fix whatever the surfaced error names.
- Remove the unused duplicate scheduler (`ScheduleDialog.tsx`) if nothing routes to it, so there is one scheduling path.

### 2. Split payment into its own stage card

- `profile_completion` block shows only: the editable profile form and a single "Profile complete" action. No payment controls.
- New `payment_confirmed`-entry card, unlocked once the profile is saved complete, containing the fee, amount received, method/receipt note and the confirm action. Confirming records the payment and moves the case to `payment_confirmed`.
- `payment_confirmed` block keeps "Submit to admin" as the final team action, plus an **Edit student profile** button that reopens the profile form in place (still editable up until submission).
- Once submitted, the profile becomes read-only again (existing `CaseProfileSummary`), reopened only by an admin change request.

### 3. Editable profile before submission

- Allow the profile form to mount during `payment_confirmed`, saving to the same draft/complete flow it uses today, without changing the stage.
- Keep the completeness check: clearing a required field marks the file incomplete and blocks submission until it is refilled.

### 4. Finance summary — full student expense breakdown

- One summary the team and admin see on the case: Darb service fee and any add-on services, programme/tuition, accommodation, insurance, discounts, total paid, remaining.
- Amounts in ₪ with foreign-currency programme lines labelled in their own currency, ASCII digits, `en-US` formatting.
- Shown on the payment step, on submitted, and on the terminal stage tabs.

### 5. Change requests

- Verify the admin "request changes" path end to end after the reorder: the case returns to the profile step, the team sees the note, edits, and resends — and payment stays confirmed so the file does not have to be paid twice.

### 6. Verification run

- Browser run through a full case: new → contacted → schedule → record outcome → profile → payment → submit → admin change request → resubmit → enrollment. Screenshot each stage, confirm the database rows, report results.

## Technical notes

- Files: `src/components/cases/CaseStageBlock.tsx`, `src/pages/team/CaseDetailPage.tsx`, `src/components/team/AppointmentSchedulerModal.tsx`, `src/components/team/PaymentConfirmationForm.tsx`, `src/components/cases/CaseProfileForm.tsx`, `src/components/cases/CaseFinance.tsx`, `src/services/CaseCostingService.ts`, plus `dashboard.json` locales (ar/en).
- No stage keys are added or renamed; no change to the stage-transition trigger is expected. If step 1 or 5 turns up a genuine database-side block, that migration is raised separately for approval.
- All new copy goes through `t()` in both locales.
