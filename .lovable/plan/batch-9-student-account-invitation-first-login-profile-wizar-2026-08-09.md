# Batch 9 — Student Account, Invitation, First Login, Profile Wizard & Dashboard

## Audit findings (verified against code + database)

What already exists and works:
- Student invitation is durable and case-linked: `create-student-from-case` creates the auth account, prefills the profile from case data (name, phone, city, education, passport type, intake, school), assigns the `student` role, links `cases.student_user_id`, and sends the bilingual `student-invite` email with a one-time activation link. Duplicate sends are rate-limited to one per 10 minutes.
- Identity safety is enforced: an email already belonging to a team/partner/admin account is rejected with `identity_conflict` instead of being converted into a student.
- Activation via `/activate` (`accept-invitation`) sets the student's own password and clears the forced-password-change flag, so a normally activated student is not asked to change their password at sign-in.
- The student dashboard exists with: Next Steps, Messages, Checklist, Profile, Documents, Visa, Refer, Contacts, My Data (data access/export/deletion requests).
- Referral for students exists (`referrals`: referrer, referred case, discount).

Gaps found:
- The first-login profile gate is a single long form, not a step-based wizard. Nothing is saved until every field on the page is valid, so a student who fills half and leaves loses the input.
- There is no progress indicator and no resume — the gate always renders the full form from the top.
- No student in the system currently has a linked case (`cases.student_user_id` is null on all 3 cases), so the student path has never been exercised end to end.
- The student has no place to see their invoice/fees; the invoice is only reachable via the emailed public link.

## What will be built

1. Step-based profile wizard (replaces the single-page gate)
   - Step 1 Personal details: full name, phone, date of birth, nationality
   - Step 2 Travel document: passport number, passport expiry
   - Step 3 Emergency contacts: at least two, add/remove more
   - Progress bar plus numbered step labels with checkmarks for completed steps
   - Each step saves to the profile when the student presses Next, so progress is never lost
   - On return, the wizard resumes at the first incomplete step
   - Fields stay prefilled from the case data the team already collected
   - Back button, Arabic/English via `t()`, RTL-correct arrows

2. Student fees & invoice visibility
   - Add a "Fees" entry to the student dashboard showing the authoritative case financials (agency fee in ILS, payments made, balance) and a link to the issued invoice when one exists
   - Read-only, sourced from the existing server-side financial summary — no new money logic

3. End-to-end verification with a demo student
   - Invite a student from an existing case, activate the account, sign in
   - Confirm: no unexpected password-change prompt, wizard resumes correctly, partial saves persist, dashboard shows the correct case, checklist, documents, contacts and fees
   - Confirm a student sees only their own case and cannot reach team/partner/admin routes

## Technical notes

- `src/components/student/StudentOnboardingGate.tsx` — rewritten as a 3-step wizard; `isProfileComplete` export kept unchanged so existing callers keep working. Per-step `update` on `profiles` (identity fields, then passport fields, then `emergency_contacts` plus the legacy `emergency_contact_name`/`_phone` mirror).
- New student fees page under `src/pages/student/`, registered in `src/App.tsx` and in the student nav group of `src/components/layout/DashboardLayout.tsx`; data from the existing `get_my_case` / case financials RPC and `case_invoices` (public token link).
- New i18n keys under `studentOnboarding.*` (`step1`–`step3`, `next`, `back`) and the fees page keys, added to both Arabic and English dashboard locales.
- No schema changes are expected; if the fees view needs a read path a student lacks, it will be added as a `security definer` RPC scoped to `auth.uid()` rather than a widened RLS policy.
