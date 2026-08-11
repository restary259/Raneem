# Audit — Recent Code Editor Changes (Team Students + student account creation)

Audit only. No code was changed.

## 1. What actually changed

Commits from today (all "Code edited in Lovable Code Editor"). Two change sets:

Set A — Team "Students" page + student account creation (14:44 → 15:19)
- `src/pages/team/TeamStudentsPage.tsx` (+591 lines): invite/manual mode toggle, email-driven "linked cases" lookup, pending-invitation list with resend, success view with activation link / temp password + copy buttons, transfer confirmation.
- `supabase/functions/create-student-from-case/index.ts`: new `mode: "invite" | "manual"` parameter, temp-password generation and reset, `activation_url` now returned to the caller.
- `public/locales/{en,ar}/dashboard.json`: new `team.students.*` keys.

Set B — earlier today (12:58 → 14:07): `CaseFinance.tsx`, `CaseProfileForm.tsx`, `CaseProfilePanel.tsx`, `CaseAttentionPanel.tsx`, `caseTasks.ts(+test)`, `CaseDetailPage.tsx`, locale files.

Chain traced: dialog form → `submitCreate()` → `supabase.functions.invoke("create-student-from-case")` → service-role client → `auth.admin.createUser` / `updateUserById` → `profiles`, `cases`, `user_invitations`, `admin_audit_log` → JSON response → `newCreds` state → success view.

## 2. Overall result

**FAIL** — one critical production defect (broken English translation file) plus one critical security regression (staff-triggered password reset of any existing student account), and several feature paths that silently return nothing under real Team RLS.

| Area | Result |
| --- | --- |
| A. Overall | FAIL |
| B. UI/UX | PASS WITH WARNINGS |
| C. Frontend logic | FAIL |
| D. Data fetching | FAIL |
| E. Supabase | FAIL |
| F. Edge functions | FAIL |
| G. SQL / RPC | PASS (no new SQL) |
| H. RLS / Security | FAIL |
| I. Data integrity | PASS WITH WARNINGS |

## 3. Findings

### 🔴 C1 — `public/locales/en/dashboard.json` is invalid JSON
Line 3552 contains `},   ,` followed by a duplicated `tabs`/`invoice` block that is never closed before `"messagesInbox"`. Introduced at 14:05 today.
- Problem: the whole English `dashboard` namespace fails to parse, so **every English dashboard screen** (admin, team, partner, student) falls back to inline defaults or raw key strings.
- Correct approach: delete the stray comma and the duplicated `tabs`/`invoice` block (it already exists inside `finance`), then re-validate both locale files.
- Files: `public/locales/en/dashboard.json`.

### 🔴 C2 — "manual" mode lets any team member reset any existing student's password
In `create-student-from-case`, when `mode: "manual"` and the email already belongs to a student, `resetManualPassword()` calls `auth.admin.updateUserById(..., { password })` and returns the new password to the caller.
- Problem: a team member only has to type a known student email to receive working credentials for that account — silent account takeover, no case-ownership check, no rate limit, and the student is locked out of their own password.
- Correct approach: restrict password reset on an *existing* account to admins (or require the case to be assigned to the caller), log it to `admin_audit_log` as a security event, and keep `mode: "manual"` for freshly created accounts only.
- Files: `supabase/functions/create-student-from-case/index.ts`, `src/pages/team/TeamStudentsPage.tsx`.

### 🟠 H1 — `activation_url` is now returned to the browser
The one-time activation link is returned in the response and rendered with a "Open" button.
- Problem: staff can open the link and set the student's password themselves, i.e. impersonate the student; the link is also copied into clipboards/logs. This is exactly what the durable-invitation flow was built to avoid.
- Correct approach: return the link only when the email send failed (`invitation_failed`), gate it to admins, and drop the "Open" button.

### 🟠 H2 — Pending invitations list is always empty for team members
`fetchInvitations()` selects from `user_invitations`, whose only SELECT policy is `has_role(auth.uid(),'admin')`.
- Problem: on this **team** page the query returns `[]` with no error surfaced (the `error` field is discarded), so the "Pending invites" section and its Resend buttons never appear. Verified against `pg_policies`.
- Correct approach: add a team-scoped SELECT policy (student invitations created by the caller) or fetch via a security-definer RPC; surface query errors instead of swallowing them.

### 🟠 H3 — Linked-case lookup queries a column that does not exist
`lookupCasesForEmail()` selects `school_name, name` from `master_services`. That table has only `service_name` (no `school_name`, no `name`), and `case_submissions.program_id` has no FK to it.
- Problem: PostgREST returns 400, the error is discarded, `programNames` stays empty, so the case "Program" label is always blank. The same wrong query exists inside the edge function (`universityName`), pre-existing, so the student profile's university is always null.
- Correct approach: resolve the programme from the real programs table and use its actual column names; assert with a query before shipping.

### 🟠 H4 — Case lookup is invisible to the team member who needs it
`case_submissions` and `cases` are readable by a team member only for cases where `assigned_to = auth.uid()`. So the email lookup shows no case for any case not assigned to the caller, while the edge function will happily link *any* `case_id` it is given (no ownership check).
- Problem: inconsistent authority — UI under-shows, backend over-permits, including `confirm_transfer` case moves by non-admins.
- Correct approach: enforce case ownership (or admin) inside the edge function for `case_id` and `confirm_transfer`.

### 🟡 M1 — Errors swallowed in three new data paths
`fetchInvitations`, `lookupCasesForEmail`, and the program sub-query all destructure only `data` (or `console.error` only). No error state, no retry, no empty-vs-failed distinction.

### 🟡 M2 — Stale state on the success view
`newCreds` is not cleared when the dialog reopens via the trigger button (only on close and on Done). `copied` is a single shared flag for two different copy buttons. `mode` resets to `invite` on close but `linkedCases` from a previous email can persist while the debounce is in flight (no request-sequence guard → last-write-wins race on fast typing).

### 🟡 M3 — Dead/confusing code
`const password = mode === "manual" ? generateTempPassword() : generateTempPassword();` — both branches identical; in invite mode a "temp" password is created and discarded. `var submissionRef = submission;` (function-scoped `var`) is unused legacy.

### 🟡 M4 — 15 new Arabic keys missing
`team.students.linkedCases`, `checkingCases`, `confirmTransfer`, `activationLink`, `copyInviteLink`, `copyPassword`, `openLink`, `pendingInvites`, `resendInvite`, `invitationSent`, `inviteExpires`, `invited`, `caseProgram`, `caseStatus`, `enterEmailForCases` are absent from `ar/dashboard.json` (Arabic is the primary audience), and 5 of them are also absent from the English file. They render English inline fallbacks.

### 🔵 L1 — Minor
`navigator.clipboard.writeText` unguarded (fails on non-secure contexts, unhandled rejection). Resend always posts with `mode: "invite"` and no `case_id`, so a resend for a case-linked student drops the case context.

### Data integrity note
Creation remains idempotent-ish: existing identity is reused, `ALREADY_LINKED` blocks silent case transfer, invite emails are rate-limited. No duplicate-student risk found. The one integrity risk is C2 overwriting a live student's password.

## 4. End-to-end testing performed

- Git history and full diffs of both change sets (read).
- `pg_policies` for `user_invitations`, `case_submissions`, `cases`, `master_services`, `profiles` → confirms H2, H4.
- `information_schema.columns` for `master_services` / `case_submissions` → confirms H3.
- `restrict_profiles_write` definition → confirms the service-role `must_change_password` upsert is allowed (not a defect).
- JSON parse of both dashboard locale files → confirms C1 (en fails, ar parses).
- Key-by-key comparison of the 38 `team.students.*` keys used by the page → confirms M4.
- Browser click-through of the Team Students dialog was **not** run (needs a team-member session); flagged rather than claimed.

## 5. Proposed fix order (one at a time, awaiting approval each)

1. C1 — repair `en/dashboard.json` (unblocks everything English).
2. C2 — restrict manual password reset of existing accounts.
3. H1 — stop returning the activation link by default.
4. H4 — enforce case ownership in the edge function.
5. H2 — make pending invitations actually load for team members.
6. H3 — fix the programme lookup (page + edge function).
7. M1/M2/M3/M4/L1 — error surfacing, state hygiene, dead code, translations.

No fix will be applied until you approve it, and each will be verified frontend + backend + database before moving to the next.
