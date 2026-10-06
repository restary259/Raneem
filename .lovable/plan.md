# Visa page: let students fill the visa form themselves, with or without a study file

## Audit findings (verified)

1. **Why the form doesn't show (root cause):** the live database has **0 study files**, and Tsukuyomi's account isn't linked to one. The test reset deleted every case. The 9-step form only shows when a student has a study file, because answers are saved against that file (`visa_applications.case_id` is required and unique, and the save, submit and review actions all check for the case).
2. The page itself works: there were no failed builds, the offline cache doesn't store pages (so you aren't seeing an old version), and the Arabic, English and Hebrew text exists.
3. **Duplicate boxes:** when a student has no study file, the page still shows the old "Visa Information" box (admin-defined fields) and the old "Legal Information" box. Both ask questions the new form also covers.
4. **Team side has the same limitation:** the team review panel (student profile → Visa tab, and the admin Visa sheet) only appears when a case exists.

## What changes for users

- **Student:** the Visa page always shows the 9-step Visa Information form, from the first login. It saves after each step, resumes where they left off, can be submitted, locks after submission, and reopens with the team's note if a correction is requested. Profile details (name, phone, email, date of birth) are still pre-filled.
- The old "Visa Information" and "Legal Information" boxes are removed from the student Visa page, so no question is asked twice. Their saved data stays in the database and is not deleted.
- The status header stays as it is, and so does the post-enrollment "Submit for Administration" box.
- **Team / admin:** the review panel shows the student's answers whether or not a case exists. The team member who created the student, the assigned team member, and admins can use Mark checked / Needs correction. If the student has a case, each review is also recorded in the case timeline.

## Technical section

### Database (manual SQL, additive only, you deploy it)
File: `docs/manual-sql/20261006150000_student_visa_info.sql`
- New table `public.student_visa_info`, one row per student:
  - `student_user_id uuid PRIMARY KEY`
  - `info jsonb NOT NULL DEFAULT '{}'`
  - `info_status text NOT NULL DEFAULT 'draft'` (draft/in_progress/submitted/needs_correction/checked)
  - `info_last_step int NOT NULL DEFAULT 0`
  - the `info_updated_at`, `info_submitted_at`, `info_checked_at`, `info_checked_by` and `info_correction_note` columns, plus `created_at` and `updated_at`
- GRANT SELECT to authenticated and ALL to service_role, then enable RLS. SELECT policy: the student sees their own row; admin sees all; a team member sees a student they created or whose case is assigned to them (same rule as the documents policy). No direct client writes.
- SECURITY DEFINER RPCs with `search_path = ''` and EXECUTE granted to authenticated only:
  - `save_my_student_visa_info(p_section text, p_payload jsonb, p_last_step int)` uses `auth.uid()`. It is refused while the form is `submitted` or `checked`.
  - `submit_my_student_visa_info()` is idempotent. It logs `visa_info_submitted` on the student's newest live case, if there is one.
  - `review_student_visa_info(p_student_id uuid, p_decision text, p_note text)` checks admin, creator, or assigned team member. A note is required for needs_correction. It logs a case event when a case exists.
- Backfill: copy any existing `visa_applications.info` into the new table (the live database has 0 rows today, so this is a safety net). The old `visa_applications.info*` columns and RPCs stay in place but are unused. Nothing is dropped.

### Frontend
- `src/services/VisaInfoService.ts`: key everything by student id (`getVisaInfo(studentId)`, `saveVisaInfoSection(section, payload, step)`, `submitVisaInfo()`, `reviewVisaInfo(studentId, …)`). Errors are thrown, never turned into empty results.
- `src/components/visa/VisaInfoWizard.tsx`: drop the `caseId` prop and use `userId` only.
- `src/pages/student/StudentVisaPage.tsx`: always render the wizard. Remove the no-case empty-state card, the old dynamic visa-fields card and the Legal Information card, along with their unused state and handlers. Keep the status header and the enrolled-only submission box.
- `src/components/visa/VisaInfoReviewPanel.tsx`: take `studentId`. `StudentOverview.tsx` passes the student id without needing a case. `VisaDetailSheet.tsx` passes `row.student_user_id`.
- Locales: remove the now-unused `visaInfo.noCaseTitle/noCaseBody` from en/ar/he together so the files stay in sync. No new strings are expected.

### Tests
- Update `VisaInfoWizard`/service tests to the student-keyed calls.
- Add a StudentVisaPage test: the wizard renders with no case, and the old Legal and dynamic boxes don't render.
- Add a review panel test: it renders with a student id and no case.
- Run the i18n key parity tests, the typecheck, and the touched suites.

### Verification after you deploy the SQL
- Query: the table, policies and the three functions exist.
- Browser, signed in as Tsukuyomi: open /student/visa, fill step 1, reload, and check it resumes at step 2.
- Browser, signed in as Kheir: the student's Visa tab shows the answers and the review buttons.

### Risks / rollback
- Until the SQL is deployed, the form shows a load error on the Visa page. Deploy the SQL before (or together with) the code.
- Rollback: revert the frontend change. The new table can stay, since it is additive and nothing reads it.
