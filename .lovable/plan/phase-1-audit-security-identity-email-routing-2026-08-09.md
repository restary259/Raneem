# Phase 1 Audit — Security, Identity & Email Routing

Read-only investigation. Every claim below is backed by a live database query or a file read; anything I could not confirm is marked UNVERIFIED.

---

## 1. Duplicate email safety — PARTIAL RISK (confirmed)

**Findings**
- No duplicate auth accounts are possible: `create-student-from-case` and `accept-invitation` both look up the existing auth user by email and reuse it. Confirmed no duplicate rows in `profiles` by email.
- But **duplicate cases and duplicate invitation emails are possible**. Live data for `tsukuyomidomain00@gmail.com`:
  - 2 student invitations (one `accepted` for case DRB-2026-000027, one still `pending` for DRB-2026-000028) plus 1 pending partner invitation — 3 invitation rows, 2 student-invite emails actually sent (`email_send_log`).
  - The same person exists as cases 000026 (manual), 000027 (submit_new_student) and 000028 (submit_new_student), all with the same phone.
- `Submit New Student` (`src/pages/team/SubmitNewStudentPage.tsx`) does no existing-email / existing-case lookup before inserting a new case.
- `createInvitation` (`supabase/functions/_shared/invitations.ts`) only de-duplicates within the same `invitation_type` **and** the same `case_id`, so a second case for the same person always mints a second live invitation.

**Fix plan**
- Pre-submit check in Submit New Student: look up existing case/profile by email or normalised phone and show a "this person already exists — open their case / continue anyway" dialog.
- In `create-student-from-case`: if the email already maps to a user that is already linked to a *different* case, return a 409 with the existing case reference instead of silently minting a second invite.
- Extend `createInvitation` to revoke any other pending invitation of the same type for the same email when a new one is issued.

---

## 2. Student lands in Partner Dashboard — ROOT CAUSE CONFIRMED

**Findings**
- The user has **two roles** in `user_roles`: `social_media_partner` and `student` (user `d8bce800…`).
- `get_my_role()` returns exactly one role, ordered admin > team_member > **social_media_partner** > ambassador > student. So a student who also holds a partner role always resolves to partner.
- `src/pages/ActivateAccountPage.tsx:137-140` routes purely on `get_my_role()`, so activation of a *student* invitation drops them into the partner dashboard. `AuthContext` uses the same single-role RPC everywhere, so the whole app treats them as a partner.
- How the second role appeared: the same email was invited as a student (case 000027/000028) and later as a partner recruit (pending partner invitation at 06:53). `accept-invitation` and `create-student-from-case` both *upsert* a role and never check for a conflicting one.

**Fix plan**
- Route on the invitation, not on the global role: `accept-invitation` should return `intended_role`, and `ActivateAccountPage` should navigate using that value.
- Add a real multi-role model at the app edge: keep `get_my_role` for defaults, but add a role switcher / "active role" for the rare dual-role user, and make `ProtectedRoute` accept any held role rather than only the top-priority one.
- Guard rail: block assigning `student` to a user that already holds `social_media_partner` (and vice-versa) unless an admin explicitly confirms; surface a warning in the invite UI.
- Data cleanup: decide which identity this specific account should be and remove the other role.

---

## 3. Account ↔ case linking — BROKEN (confirmed)

**Findings**
- `cases.student_user_id` is set per case, but `profiles.case_id` is a **single** column that each new account-creation run overwrites. Live: case 000027 still points at user `d8bce800…`, while that user's `profiles.case_id` now points at case 000028. One account, two cases, inconsistent back-links.
- `profiles` also has a second, unused-looking `linked_case_id` column (null here) — two competing sources of truth.
- No orphan case created by the edge function itself; the orphaning comes from the client always inserting a brand-new case (item 1).

**Fix plan**
- Treat `cases.student_user_id` as the single source of truth; derive the student's case from it and stop writing `profiles.case_id` (or keep it strictly as a denormalised "current case" updated by trigger).
- Add a guard in `create-student-from-case`: refuse to link a user that is already `student_user_id` on another open case unless the caller confirms a transfer.
- Backfill/repair script for the existing duplicated cases.

---

## 4. Document security — bucket is SAFE, app code is BROKEN

**Findings**
- Both buckets (`student-documents`, `chat-attachments`) are **private** (`public = false`). No document is anonymously reachable. Storage policies are `authenticated`-scoped: owner-by-folder for students, assigned-case for team, full access for admin.
- Two real bugs in `src/pages/team/SubmitNewStudentPage.tsx`:
  1. It calls `getPublicUrl()` on a private bucket and stores that URL in `documents.file_url` — the link is permanently dead (no leak, but broken downloads).
  2. It uploads to `${caseId}/…` while the student read policy matches `folder[1] = auth.uid()`, and it inserts `documents.student_id = user.id` (**the team member**, not the student). Result: the student cannot see their own documents, and the uploading team member is recorded as their owner.

**Fix plan**
- Replace `getPublicUrl` with `createSignedUrl` at read time everywhere; store only the storage path in `documents`.
- Standardise upload paths and set `documents.student_id` to the student's user id (or make the column nullable and rely on `case_id` + policies).
- Add a storage read policy keyed on `case_id` for students, matching the path convention chosen.

---

## 5. Email trigger mapping — no misroute found; report UNVERIFIED

**Findings**
- `reset-student-password` **sends no email at all** — it sets a temp password and returns it to the admin UI. It cannot be the source of a stray reset email.
- `auth-email-hook` maps Supabase action types (`invite` / `magiclink` / `recovery`) to distinct templates; each transactional caller passes an explicit `templateName`. No caller passes a variable/derived template name.
- `email_send_log` for today shows only `student-invite`, `partner-invite`, `new-message` and `email-test` — **no recovery email was actually sent**. The reported "password reset email" was most likely a `student-invite`/`partner-invite` whose Arabic copy reads like a password setup message (the activation flow does ask the user to set a password).

**Fix plan**
- Reword the invite templates so "set your password" is clearly framed as account activation, not a reset.
- Add `template_name` + trigger source to the admin email log view so a future report can be traced in one click.
- If the user can name the exact button they clicked, re-check that path — currently UNVERIFIED.

---

## 6. Production domain — CLEAN

- `APP_URL`/`SITE_URL` are hard-coded to `https://darb.agency` in `_shared/invitations.ts`, `_shared/email-ui/theme.ts`, `notify-new-message`, and `src/lib/referral.ts`.
- The only `lovable.app` / `lovableproject.com` references left are the CORS allow-list in `_shared/cors.ts` (intentional, preview access).
- One exception: `src/components/auth/PasswordResetModal.tsx:28` uses `window.location.origin` for `redirectTo`, so a reset started from the preview host redirects back to the preview host.
- UNVERIFIED: the Supabase auth Site URL / redirect allow-list itself (config, not code) — needs a check in auth settings.

**Fix plan** — pin the reset `redirectTo` to `https://darb.agency/reset-password` in production, and confirm the auth Site URL.

---

## 7. RLS audit — sound, with two gaps

**Findings**
- `cases`: only admin and assigned team member policies; students read through the `get_my_case()` RPC, partners through `get_partner_pool_cases`. No direct student/partner read — correct.
- `case_submissions`: admin, assigned team, and student-owns-case SELECT — correct.
- `documents`: admin / assigned team / `student_id = auth.uid()` — correct in policy, but defeated in practice by the wrong `student_id` written at upload (item 4).
- `profiles`: own row, admin, and "team member who created this profile". Gap: a team member **assigned** to a case cannot read that student's profile unless they created it — likely causes blank fields in team views.
- All policies target `authenticated` (no `public` grants left).

**Fix plan** — add an assigned-team SELECT policy on `profiles` scoped through `cases.assigned_to`; re-test after the `documents.student_id` fix.

---

## 8. "raneem dawahade" empty phone / empty City, education, passport — ROOT CAUSE CONFIRMED

**Findings** (live query)
- The phone is **not** lost on the case: DRB-2026-000025 has `0525260547`, 000027 has `0529402168`; the linked profile also has a phone. What is empty is `case_submissions.student_email` and `case_submissions.student_phone` — both `''` for case 000027.
- Cause: `SubmitNewStudentPage.tsx` writes email and phone **only into `case_submissions.extra_data` JSON**, never into the dedicated `student_email` / `student_phone` columns the Admin Submissions view reads.
- City / education level / passport type are empty because these fields exist only on `cases` and are **only ever populated by the public apply form**. The manual and Submit-New-Student flows never collect or write them (the apply-page cases 000019/000029 do have them; every `manual` / `submit_new_student` case has them blank).

**Fix plan**
- Write `student_email` / `student_phone` to their real columns (keep `extra_data` as-is for backwards compatibility) and backfill existing rows from `extra_data`.
- Add City / education level / passport type to the Submit New Student and manual-create forms, or have the Admin Submissions detail view fall back to `extra_data` and clearly show "not collected" instead of a blank field.

---

## Suggested execution order

1. Wrong-dashboard routing (blocks real users today) — item 2.
2. Submissions data loss + missing intake fields — item 8.
3. Document ownership / signed URLs — item 4.
4. Duplicate case + duplicate invitation guards — items 1 and 3.
5. `profiles` RLS for assigned team, reset `redirectTo` pinning, invite copy — items 7, 6, 5.
