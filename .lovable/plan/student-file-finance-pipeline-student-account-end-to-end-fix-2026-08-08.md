# Student File, Finance, Pipeline & Student Account — End-to-End Fix

Confirmed by inspection before planning:

- The typing bug is real and has a single root cause: `CaseProfileForm.tsx` defines the `Field` component **inside** the render body (line 177). React sees a new component type on every keystroke and remounts the input, so focus is lost after each character.
- There is no draft persistence in the profile form. `useFormDraft.ts` exists in the codebase but the case profile form does not use it, and nothing writes partial values to the database.
- School relationships are structurally sound: `programs.school_id` and `accommodations.school_id` are real FKs to `schools`, and **0** programs and **0** accommodations have a NULL school. Data: 4 schools, 9 programs, 23 accommodations, 1 insurance. Frontend filtering exists but only by school, and clearing school shows everything.
- Course end date is currently derived from `programs.duration_in_months`, not a fixed 40 weeks.
- Validation on save is generic: `handleSave` collects missing fields but shows a single toast (`case.profile.missingFields`) with no per-field messages and no scroll-to-error.
- Service fee 4,000 ILS exists in `service_catalog` as "رسوم الخدمة الأساسية" (the only active catalog row). It is not referenced as a named constant in code.
- The manual "move to next stage" control is in `CaseDetailPage.tsx` (`manualNextStages` + `pendingStage` dialog).
- Payment confirmation is reachable regardless of profile completeness.
- `admin-mark-paid` is admin-only, `verify_jwt = true`, and calls `record_case_commission` before flipping status; the reported error needs to be reproduced against the live function before a fix is written — the cause is not yet confirmed.

## What will be built

### A. Profile form correctness
- Hoist `Field` (and the DOB block) out of the render body into stable module-level components so inputs never remount. Audit every input on the page for the same pattern.
- Per-field validation: each required field gets an inline error message, the first invalid field is scrolled into view and focused, and the section containing it is highlighted. The generic toast is replaced with a count + first missing field name.
- Required-field list stays in `src/lib/studentProfileFields.ts` as the single source of truth; backend save validation is aligned to the same list.

### B. Persistent draft (one system, database-backed)
- Debounced autosave (about 1s idle) writes the profile values into `case_submissions.extra_data` under a `draft` marker, never overwriting an existing non-empty value with an empty one.
- Reopening the case restores the last saved values; the form shows "Saved HH:MM" / "Saving…".
- Explicit states: **Draft** (autosaved, incomplete) → **Completed** (all required fields, saved) → **Submitted** (sent to admin) → **Enrolled**. Local `useFormDraft` is not used here, so there is only one draft system.

### C. Email & identity preservation
- Email is normalised (trim + lowercase) and validated on save; stored on the submission as the canonical student email.
- On invite/submit: look up an existing auth user by that exact email. If found, link the case to that user; if not, create the account with that email. No silent substitution, no duplicate accounts.
- Duplicate-phone and duplicate-email cases surface an explicit, actionable message instead of failing silently.

### D. School → program → accommodation → insurance
- School is made a required selection; program and accommodation lists are empty until a school is chosen, and only that school's rows are ever selectable.
- Changing school clears program/accommodation/insurance selections.
- A one-off data check confirms every program/accommodation still points to a live school and every submission's stored IDs are mutually compatible; mismatched historical rows are reported (and cleared) rather than silently kept.

### E. 40-week course duration
- One shared helper computes `course_end = course_start + 40 weeks`. Course end becomes read-only in the UI, clearly labelled as auto-calculated. Any other duration math in the codebase is replaced by this helper.

### F. Finance
- One config module holds `DEFAULT_SERVICE_FEE_ILS = 4000` (sourced from the catalog row, with the constant as fallback). No component hardcodes it.
- The finance panel is generated from the actual selected services — program, accommodation, insurance, catalog services — reading current prices from the database. Changing or clearing a selection recalculates immediately.
- Clear separation of three blocks: **Student monthly cost** (accommodation + insurance + course, per month, no food, no business figures), **One-time costs** (deposits, placement/registration fees), **DARB service fee** (4,000 ILS default, editable).
- Internal/company financial figures stay out of the student cost block.

### G. Pipeline enforcement
- The manual stage picker in the case header is removed. Stages advance only via completing the stage's task.
- Prerequisites, enforced in the UI **and** in the database (a trigger on `cases.status` plus checks inside the transition RPC):
  - contacted → appointment_scheduled: an appointment row exists
  - appointment_scheduled → profile_completion: every appointment has an outcome
  - profile_completion → payment_confirmed: profile is complete (all required fields)
  - payment_confirmed → submitted: a payment is recorded
  - submitted → enrollment_paid: admin action only
  - No skipping, no backwards jumps except the existing forgotten → contacted re-engage path.
- "Confirm payment" is blocked while the file is incomplete, listing exactly what is missing with a link back to the field.
- Appointment actions disappear from the case once payment is confirmed.

### H. Submit to admin + student invitation
- "Send to admin" opens a confirmation dialog (Cancel / Confirm & send) explaining that the case moves to admin review and the student is invited.
- On confirm: status → submitted, student account created or linked by canonical email, invitation email sent.
- A production-quality Arabic-first, mobile-friendly invitation email: application received, account ready, single clear activation CTA, DARB branding, no internal terminology. Expired/invalid links show a proper message and allow re-request.

### I. Student dashboard
- The student's dashboard reads the same case records (no duplicated data): status/progress, school, program, course dates, accommodation, insurance, services, and the student-facing finance summary only.
- RLS restricts every one of those reads to the case whose `student_user_id` is the signed-in user, so changing an ID in the URL returns nothing.

### J. Admin side & cleanup
- The redundant admin "Approve" button is removed; admin reviews submitted cases directly.
- "Mark as enrolled and paid" is reproduced live, the real failure identified end-to-end (handler → edge function → RPC → constraints → RLS), fixed at the root, and the resulting database state verified.
- The WhatsApp button is tested; if it does not reliably open a chat it is replaced by a clearly displayed, copyable, click-to-call phone number. Mobile keeps native dialling.
- The case screen is de-duplicated: Overview (collapsible, gains the finance summary after payment) → current task → relevant info → actions. No new tabs.

### K. Security audit
- Review of RLS on cases, submissions, payments, services, documents, profiles and the invite path; team sees only assigned cases, students only their own, admin full access; RPC/edge-function authorization re-checked; duplicate account/case creation prevented at the database level.

## Verification

Three realistic demo cases are driven through the full journey in the live preview with a real browser session: continuous typing, refresh mid-form and confirm draft restore, school→program→accommodation compatibility, 40-week end date, deliberate missing field showing the exact field, blocked payment confirmation, payment, finance moved into Overview, confirmation dialog on send, account creation and real invitation email, student login showing the right case and finance, cross-case access denied, admin enrolment with no error. Every claim is backed by a database read or a screenshot.

## Technical notes

- Touched files: `src/components/cases/CaseProfileForm.tsx`, `CaseStageBlock.tsx`, `CaseFinance.tsx`, `CaseOverviewPanel.tsx`, `CaseInviteStudent.tsx`, `src/pages/team/CaseDetailPage.tsx`, `src/lib/studentProfileFields.ts`, `src/lib/caseTransitions.ts`, `src/services/CaseCostingService.ts`, `CaseStageService.ts`, student dashboard pages, plus edge functions `create-student-from-case`, `admin-mark-paid` and the transactional email template.
- Database work: a stage-prerequisite trigger/RPC on `cases`, draft/canonical-email fields on `case_submissions`, and RLS review. Each is a separate reviewed migration.
- Assumptions unless you say otherwise: monthly student cost = accommodation monthly + insurance monthly + course fee spread over the 40 weeks (≈9.2 months); registration/placement fees and deposits are one-time, not monthly.

## Remaining unknowns

- The exact cause of the "Mark as enrolled and paid" error is not yet confirmed; reproducing it live is the first step of that item, and the fix follows the reproduction rather than a guess.
