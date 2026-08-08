# Submitted-case review and student account completion

## Confirmed current state

- The requested-change record for case `DRB-2026-000014` is saved as `changes_requested`, but the case itself remains `submitted`. The two separate client updates can partially succeed, leaving Admin and Team on conflicting stages.
- The test student email already has one real auth user, a `student` role, profile, and a case linked through `cases.student_user_id`; no duplicate account is needed.
- That student profile does not contain `profile.case_id`, while the student dashboard currently depends on it. As a result, a valid signed-in student can miss case status, appointments, finance, and messages even though backend ownership is correct.
- Existing-account invitations do not issue a new credential. A previously emailed temporary password can therefore be stale, which matches the reported “incorrect credentials” behavior.
- The Team case page currently renders one long stage surface. It does not provide the requested terminal-stage tabs.

## 1. Make review actions atomic

- Add protected database functions for **Request changes** and **Resubmit** so each action updates `case_submissions` and `cases` in one transaction.
- Restrict request-changes to Admin and the selected case; restrict resubmission to the assigned Team member or Admin.
- Request changes will save the note/reviewer/time and move `submitted → profile_completion` together.
- Resubmission will require a completed profile and confirmed payment, then clear the old review decision and move `profile_completion → submitted` together.
- Replace the multi-call frontend mutations in Admin and Team with these functions, surface backend errors, and refresh the affected lists/detail after success.

## 2. Add the terminal-stage case tabs

Only when the case is `submitted` or `enrollment_paid`, show exactly:

1. **Overview** — status/review message, assignment, case identity, program/accommodation/insurance summary, and key milestones.
2. **Student profile** — the complete read-only student file assembled from the case and submission data.
3. **Finance summary** — existing real service, invoice, payment, and calculated program-cost data; editable only where current permissions allow.

Earlier stages retain the stage-driven working surface. The `submitted` tab state clearly says it is waiting for Admin; the final stage clearly says enrollment is complete. Add Arabic and English translation keys and keep the layout responsive/RTL-safe.

## 3. Replace temporary-password email with secure account activation

- Keep one auth identity per normalized email and continue provisioning the `student` role and profile server-side.
- Stop treating a plaintext temporary password as the durable invitation credential.
- Generate a single-use backend activation/password-setup link for both newly created and existing student identities, send it through the existing branded transactional email, and route it to a dedicated password setup screen.
- After a strong password is saved, clear `must_change_password`, refresh auth state, and redirect to the student dashboard.
- Keep “Forgot password” as the recovery path; improve login errors without revealing whether an email exists.
- Make resend-invite generate a fresh activation link instead of resending stale instructions.

## 4. Make student data access case-centric

- Resolve the student’s case canonically with `cases.student_user_id = auth.uid()` rather than depending on optional profile linkage fields.
- Update the student overview/next-steps flow to use that case ID for status, submission balance, appointments, shared messages, checklist, and documents.
- Backfill/synchronize `profiles.case_id` for existing linked students for compatibility, while keeping `cases.student_user_id` authoritative.
- Verify student policies only expose the signed-in student’s own case, submission, appointments, shared messages, checklist, profile, and documents; no Admin/Team-only fields or internal messages should become visible.
- Add explicit loading, empty, and permission-error states instead of silently displaying an empty dashboard.

## 5. Verification

- Test Admin request changes on a submitted case and confirm both records change together and the Team immediately sees the note and editable profile stage.
- Correct the profile, resubmit as the assigned Team member, and confirm both records return to Admin review together.
- Exercise both terminal-stage tabs on desktop and mobile/RTL and confirm only the three requested tabs appear.
- For `tsukuyomidomain00@gmail.com`, reuse the existing identity, send a fresh activation link, set a new password, sign in through `/student-auth`, and verify role routing plus real case-linked data access.
- Verify a different student cannot read that case and Team/Admin-only content remains hidden.
- Run targeted unit/integration tests, the existing E2E suite, and a Playwright browser pass for Admin → Team corrections → student activation/login.

## Technical details

- Database functions will be `SECURITY DEFINER` with a fixed `search_path`, explicit authenticated grants, server-side role/ownership checks, and no anonymous execution.
- Account creation/linking remains in `create-student-from-case`; activation tokens are generated server-side and never logged or stored in application tables.
- Existing shared components and semantic design tokens will be reused; no new dashboard architecture or unrelated workflow changes are included.