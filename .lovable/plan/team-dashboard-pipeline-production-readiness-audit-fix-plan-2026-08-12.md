# Team Dashboard Pipeline — Production Readiness Audit & Fix Plan

Read-only audit completed: live browser walkthrough as `team@gmail.com` (12 screenshots), live database queries, and three deep-dive code audits (frontend, database/RLS, edge functions & email).

## What is solid

- Money is server-authoritative everywhere. `get_case_financials`, `set_case_services`, `confirm_agency_service_payment`, `confirm_case_payment` are all SECURITY DEFINER with in-body role checks; the client never sends prices or amounts.
- The stage machine IS enforced in the database (`enforce_case_stage_transition` trigger on `cases`), not only in JS. Direct `cases.update({status})` from the console cannot skip stages.
- Case isolation works. Opening a case assigned to another team member renders no data (verified in the browser).
- Service lines are frozen per case with catalog version + unit price snapshots; writes are blocked after `submitted` by `guard_case_services_write`.

## Critical (data integrity — fix first)

1. **A case sits at `payment_confirmed` with zero services, zero payments, zero invoice** — `DRB-2026-000033`. Its submission row still carries a legacy `service_fee = 4000` while `case_services` is empty, so the Finance tab shows ₪0 / "غير مدفوع" yet the "send to admin" button is enabled. Submitting it will fail server-side (`submit_case_for_review` requires a positive service total).
  - Repair the row (re-select services, or roll it back to `profile_completion`).
  - Add a guard so the `profile_completion → payment_confirmed` edge requires a positive `case_services` total, closing the path that produced it.
  - Files: migration on `enforce_case_stage_transition`; `src/components/cases/CaseFinance.tsx` (disable submit when `service_total = 0`).
2. **No invoice rows exist at all** (`case_invoices` is empty) even though two cases are `submitted` and one is fully paid. Either those cases were submitted before `issue_case_invoice` existed, or issuance failed silently.
  - Backfill invoices for the two submitted cases via `issue_case_invoice`, and surface issuance failure in the UI instead of swallowing it.
  - Files: `src/pages/team/CaseDetailPage.tsx` (`handleSubmitToAdmin`), `src/services/CaseInvoiceService.ts`.
3. **School is never persisted.** `case_submissions.school_id` is NULL on most rows, including cases already at `payment_confirmed`, while the profile screen displays a school name derived from the chosen program. The readiness checklist consequently shows "المدرسة" as pending forever — and it shows pending even on the one case where `school_id` IS set, so the checklist condition is also wrong.
  - Persist `school_id` alongside `program_id`; fix the checklist predicate; backfill `school_id` from `programs.school_id`.
  - Files: `src/components/cases/CaseProfileForm.tsx`, `src/components/cases/CaseFinance.tsx` (readiness list), one backfill migration.
4. **Germany cost snapshots are partly empty**: `accommodation_price = 0` and `insurance_price = 0` on live submissions whose UI shows an accommodation and MAWISTA selected, and `accommodation_weeks` (48) diverges from `program_weeks` (40) on another. Estimates silently fall back to live catalog recompute when the snapshot is missing, so quoted numbers can drift from what was agreed.
  - Write the priced snapshot on every profile save; make the estimator refuse to invent a value when the snapshot is absent.
  - Files: `src/components/cases/CaseProfileForm.tsx`, `src/services/CaseCostingService.ts`.

## High (workflow correctness)

5. **Double-booking is possible.** The appointments page creates and drag-reschedules appointments with raw writes and no conflict check, while the case-detail scheduler does check. Same product, two code paths, one unsafe.
  - Route both paths through the conflict-aware picker.
  - Files: `src/pages/team/TeamAppointmentsPage.tsx`, `src/components/team/AppointmentPicker.tsx`, `src/components/team/RescheduleDialog.tsx`.
6. **Deleting the last appointment strands the case** in `appointment_scheduled` with nothing to act on.
  - Revert the case to `contacted` when its last appointment is removed.
7. **Enrollment sends nothing.** `admin-mark-paid` writes the enrollment and the commission but emails no one and raises no notification — no student payment confirmation, no alert to the assigned team member. This is the last milestone in the pipeline and it is silent.
  - Add a transactional email plus `emit_notification` fan-out.
  - Files: `supabase/functions/admin-mark-paid/index.ts`, new `enrollment-confirmed` template.
    &nbsp;
  **Tab labels and layout change between stages** ("الملف المالي" at one stage, "الملخص المالي" at another; Finance itself contains a second nested tab strip). Stage-dependent chrome makes the page feel like three different screens.
  - One tab set, one label per tab, flatten the nested Finance tabs into sections.

## Low (cleanup, no user impact today)

- Duplicate profile forms: `src/components/team/ProfileCompletionForm.tsx` vs the live `src/components/cases/CaseProfileForm.tsx` — divergent validation, one unreachable. Delete the dead one after confirming call sites.
- Dead code: `send-branded-email` and `send-event-email` have zero callers; `/team/appointments/today` redirects to `/team`.
- `review_status` stays `'draft'` on submitted cases — the admin review field is written nowhere.
- No timezone handling in the appointment stack (all browser-local).
- `case_payments.case_id` and `case_service_snapshots.case_id` have no foreign key to `cases`.
- Duplicate RLS policies on `case_payments` (5, two pairs identical) and `case_finance_confirmations`.
- `master_services` has a read policy but no write policy for admins — writes only work via migrations.
- `CaseServices` formats every total with `formatILS` regardless of the line's own currency; `CaseServices` locks on a status string `"enrolled"` that does not exist in the enum.
- Invite emails from `create-student-from-case` pass no idempotency key, so a client retry can double-send.

## Technical notes

- Current live data: 13 active cases — 8 `profile_completion`, 2 `submitted`, 1 `payment_confirmed`, 1 `contacted`, 1 `new`. No case has ever reached `enrollment_paid`, so the enrollment half of the pipeline has never run end to end in this environment.
- 0 invoices, 3 payments, 20 finance confirmations, 159 case events, 7 appointments (0 stale), 10 active catalog services.
- Suggested execution order: items 1–4 (one migration + form fixes, verified with re-queries), then 5–8 (workflow + notifications), then 9–10 (UI restructure), then the cleanup list.                         important i made money changes via git hub re scan these changes before commiting the plan and cheak if migration sql are set up correctly and cheak the rtl arabic i rendering correctly and ui is in pair with th theme od fdashboard and the wording is professional and up to date also confirm the confirm and save button works 