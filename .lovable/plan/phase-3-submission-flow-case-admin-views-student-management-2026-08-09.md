# Phase 3 — Submission flow, case/admin views & student management

Audit findings per item, then the fix plan. No code changed yet.

## Findings

### 1. Confirmation step — ALREADY EXISTS (no work needed)
Submit New Student is a 5-step wizard (`stepStudentInfo`, `stepContactDetails`, `stepProgram`, `stepPayment`, `stepReview`). Step 5 is a review screen and submit is hard-gated: the case is only created when the user is on the last step AND has ticked the confirm checkbox. It summarises name/contact, school, program, duration, accommodation, insurance, service fee and the cost breakdown. Layout uses the same responsive card/grid pattern as the other steps, so mobile is fine.
Remaining gap: the review screen does not show the **total case cost** as one figure per currency (EUR school block vs ILS fee), only the individual lines.

### 2. Profile completion UI stays expanded — CONFIRMED
The form lives in `src/components/cases/CaseProfileForm.tsx`, rendered by `CaseStageBlock.tsx` (two places). It autosaves and calls `onSaved()` on completion, but nothing switches it to a read-only state — it just re-renders as an open form. A read-only summary component already exists (`CaseProfileSummary.tsx`) and is used on the case page, so the collapsed state is available to reuse.

### 3. Profile edits do NOT propagate — CONFIRMED BUG
`CaseProfileForm.persist()` writes **only** to `case_submissions` (`extra_data` blob + program/accommodation/insurance/email/phone). It never touches:
- `cases.city / education_level / passport_type / full_name / phone_number` → Admin Submissions list, Pipeline and case headers stay stale
- `profiles` → the student's own dashboard and Admin Student Management stay stale
Spreadsheet Hub reads `case_submissions`, so it *does* see the edits — the inconsistency is between the two stores.

### 4. Empty City / education level / passport type in Admin Submissions — ROOT CAUSE FOUND
Not a read bug. The view already falls back to `extra_data`. The data genuinely isn't there:
- `cases.city` is NULL on the older rows (including "gmeel najwa meoe"); city is only written to `cases` for submissions made after the Phase 1 fix. The value does exist in `case_submissions.extra_data.city` ("טמרה") for those rows.
- `cases.education_level` and `cases.passport_type` are NULL because **the wizard never collects them** — there is no education-level or passport-type field anywhere in Submit New Student. They are only ever set on partner/apply-sourced leads.

### 5. Student Management empty/missing accounts — ROOT CAUSE FOUND
`AdminStudentsPage.fetchStudents()` filters the list with:
- `.is("case_id", null)` — **every case-linked student is excluded from the list entirely**
- `.not("created_by", "is", null)` — self-registered students are excluded
Of the current student accounts, one is case-linked and one has no creator, so they are invisible in Student Management. The detail panel then reads only `profiles` columns with no join to the student's case, so an account provisioned from a case (where the real data lives on `cases`/`case_submissions`) renders as a blank profile.

### 6. Student account detail structure — partially there
Current: one flat panel — profile fields, visa fields, documents, account actions (reset password, delete). Missing vs. the target structure: Overview header, Education, Accommodation, Insurance, Finance and Summary sections, and any link to the student's case. Personal Info / Documents / Account Actions exist but are not grouped into tabs.

### 7. Onboarding status — NOT TRACKED (does not exist yet)
The raw signals exist but nothing composes or displays them: `user_invitations.status` (pending/accepted) + `accepted_at`, `profiles.must_change_password`, `case_submissions.profile_completed_at`, `cases.student_user_id`. There is no `onboarding_status` field and no UI badge anywhere.

### 8. Manual student account creation — works, but the student then disappears
`create-student-from-case` correctly: authenticates + checks role, blocks a second account for the same case (409 `already_linked`), reuses an existing auth user, assigns the `student` role, links `cases.student_user_id`, and issues a durable invitation email. It is invoked from Admin Submissions, the case page and the wizard. The end-to-end failure is item 5: because the new profile is case-linked, the Student Management filter hides it, so the student never "appears immediately".
UNVERIFIED: whether every creation path writes an `admin_audit_log` / `activity_log` entry — the function logs the case event but the audit trail wasn't traced end to end.

## Fix plan

**A. Make the case the single source of truth for intake fields (items 3 + 4)**
1. Add `education_level` and `passport_type` selects to wizard step 1, and persist them to `cases` alongside the existing `city` write.
2. Extend `CaseProfileForm.persist()` to also `UPDATE public.cases` (full_name, phone_number, city, education_level, passport_type) and, when the case has a `student_user_id`, mirror the shared personal fields into `profiles`. Single helper so all writers stay consistent.
3. One-off backfill migration: copy `extra_data.city` into `cases.city` where `cases.city IS NULL`.

**B. Collapse the profile form after save (item 2)**
Track a `justCompleted` state in `CaseStageBlock`; on successful complete-save render `CaseProfileSummary` with an "Edit" button that re-expands. Keep the form open on autosave, collapse only on explicit completion.

**C. Unhide students (items 5, 6, 8)**
1. Remove the `.is("case_id", null)` and `.not("created_by", ...)` filters; list all accounts with the `student` role and add a "Source" column (case-linked / standalone / self-registered).
2. In the detail panel, resolve the student's case via `cases.student_user_id` (and `profiles.case_id`) and load `cases` + `case_submissions`, falling back to those values when the `profiles` column is empty.
3. Restructure the panel into tabs: Overview / Personal Info / Education / Program & Accommodation / Insurance / Finance / Documents / Account Actions, with a link through to the case page.
4. Refetch the list after account creation so the new student appears without a reload.

**D. Onboarding status (item 7)**
Derive it in code (no new column): `Invitation sent` → `Account activated` → `Profile setup required` → `Profile completed` → `Active`, computed from `user_invitations.status`, `must_change_password`, `profile_completed_at`. Render as a badge in the Student Management list and on the case page.

**E. Review-step total (item 1)**
Add a per-currency total line to wizard step 5 (EUR school total, ILS agency fee) reusing the Phase 2 finance blocks — no cross-currency sum.

## Technical notes
- Files touched: `src/pages/team/SubmitNewStudentPage.tsx`, `src/components/cases/CaseProfileForm.tsx`, `src/components/cases/CaseStageBlock.tsx`, `src/pages/admin/AdminStudentsPage.tsx`, plus locale files.
- One data migration (city backfill). No schema change is required for onboarding status.
- Verification: unit test for the onboarding-status derivation and the profile-propagation helper, plus a live pass over Admin → Submissions and Student Management.
