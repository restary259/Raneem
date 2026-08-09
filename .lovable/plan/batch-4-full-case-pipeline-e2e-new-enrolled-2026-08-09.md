# Batch 4 — Full Case Pipeline E2E (New → Enrolled)

Scope: verify and repair the existing single pipeline. No new pipeline architecture, no Batch 5 finance redesign.

## Pre-audit findings (verified this turn, read-only)

Pipeline definition is already single-sourced:
- `src/lib/caseStatus.ts` — `CaseStatus` enum + `CASE_STATUS_ORDER`: new → contacted → appointment_scheduled → profile_completion → payment_confirmed → submitted → enrollment_paid (plus forgotten/cancelled), with `pipeline_statuses` table as runtime labels.
- Backend enforcement exists: trigger function `enforce_case_stage_transition()` rejects every transition that is not in the allow-list, and additionally requires an appointment before `appointment_scheduled`, recorded appointment outcomes before `profile_completion`, `case_submissions.profile_completed_at` before `payment_confirmed`, `payment_confirmed = true` before `submitted`, and admin role for `submitted → enrollment_paid`. Skips (new → payment_confirmed etc.) raise `STAGE_BLOCKED`.
- History: `log_case_status_change()` writes to `activity_log`; `log_case_event` / `case_events` used for timeline.
- Profile step: `src/components/cases/CaseProfileForm.tsx` with autosaved draft into `case_submissions` (`draft_updated_at`), required-field check plus email-format check via `missingProfileFields()` in `src/lib/studentProfileFields.ts`.
- Payments: `src/components/cases/CasePayments.tsx` inserts into `case_payments` (`paid_status: 'paid'`); the "payment confirmed" flag lives separately on `case_submissions.payment_confirmed`.

Gaps to confirm/fix during execution:
1. No phone-format validation anywhere (frontend or DB) — only "non-empty".
2. No database-level format guard on `case_submissions.student_email` / `student_phone`; a crafted request can store garbage.
3. `CasePayments.record()` has no double-submit protection beyond `busy` state, and payment rows are freely deletable by anyone with manage rights — needs checking against who may set `payment_confirmed`.
4. Whether the Team member can set `case_submissions.payment_confirmed` themselves (false-paid risk) is unverified.
5. Team-side double-click on stage buttons and duplicate `case_events` need live verification.

## Execution plan (steps reported one by one)

1. Full audit report of pipeline (DB statuses, triggers, RLS, RPCs, frontend components, notifications, emails) — read-only, findings only.
2. Negative transition test through the API as the team user (new → payment_confirmed, new → submitted, team → enrollment_paid); confirm `STAGE_BLOCKED`; fix any hole found in `enforce_case_stage_transition` via a tracked migration.
3. Reuse demo case `DRB-2026-000031` (team `darbsocial27@gmail.com`). It currently sits at `appointment_scheduled` from Batch 3; either continue forward from there and create one fresh case for the new→contacted leg, or reset via the app. No manual DB status writes.
4. New → Contacted in the real UI; verify status, activity_log row, case_events, notification fan-out, actor and timestamp, admin visibility.
5. Contacted → Appointment through the booking dialog; verify persistence, appointment reminders rows, focus/typing behaviour, and that an incomplete booking is rejected.
6. Appointment notifications: recipients, case reference, date/time, deep link, no duplicates.
7. Appointment → Profile Completion (requires recorded outcome); verify the gate.
8. Fill every profile field with valid demo data; verify persistence, refresh, admin view, DB row.
9. Draft persistence: type, refresh before saving, confirm the existing autosave draft restores. No second draft system.
10. Email guardrails: reject malformed emails in UI and add a DB-level check (trigger, not CHECK constraint) on `case_submissions.student_email` if missing.
11. Phone guardrails: add shared validator (`src/lib/studentProfileFields.ts` + form error) and a matching DB-level guard; verify WhatsApp action uses the stored normalized number.
12. Profile Completion → Payments only when required data is complete and valid.
13. Confirm reaching the Payments stage does not imply money received; document the `case_payments` vs `case_submissions.payment_confirmed` split, and lock down who may flip `payment_confirmed` if the team can currently self-confirm.
14. Payments → Submitted with all preconditions; blocked path shows a clear reason.
15. Verify submission events: status, activity_log, case_events, admin notification, email, commission trigger behaviour.
16-17. Admin side: submitted case appears with reference, student, team member, school/course/accommodation/intake, payment state, submitted timestamp; case detail shows everything Team entered.
18. Admin → Enrolled; confirm team members are rejected by the trigger.
19. Full history integrity check in `activity_log` / `case_events`: order, no skips, no duplicates, correct actors.
20. Negative suite: skips, invalid email/phone, submit without payment, team enrollment, unauthorized actor, direct URL, refresh mid-transition, double-click, double submit.
21. Concurrency: two sessions on the same case, refresh convergence, save-during-navigation.
22. Mobile 390px walk-through of every stage; fix genuine breakage only.
23. Backend verification sweep for orphans, duplicates, bad FKs, stale mirrors between `cases`, `case_submissions`, `profiles`.
24. Legacy sweep for competing status names/components; remove only what is provably unused, document the rest.
25. Final clean E2E re-run on a fresh case through the real UI.
26. Batch 4 report in the exact requested format.

## Technical notes

- All DB changes go through tracked migrations: expected candidates are a validation trigger on `case_submissions` (email + phone format) and, if needed, a write guard restricting `payment_confirmed` to the roles allowed by business rules.
- Frontend changes stay inside `src/components/cases/*`, `src/lib/studentProfileFields.ts`, and the team/admin case pages.
- Testing is done with Playwright against the running app as the real demo team and admin users, plus direct SQL reads for verification.
- Deferred to Batch 5: finance/commission redesign, invoices, payout accounting.
