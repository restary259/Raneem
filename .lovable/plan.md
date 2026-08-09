# Fix invitation activation + master-partner attribution

## What I found (verified against the live database and code)

**Root cause 1 — master-partner attribution is silently erased by a database trigger.**
`restrict_profiles_write()` is `SECURITY DEFINER` owned by `postgres`, so its escape hatch
`current_user = 'service_role'` can never be true (inside a definer function `current_user` is the
owner, not the caller). Every server-side write to `profiles` therefore falls into the
"untrusted user" branch, which on INSERT force-sets `master_partner_id := NULL` and
`must_change_password := false`. Because the approval code upserts the profile, the
BEFORE INSERT trigger scrubs the row *before* the ON CONFLICT update, so the scrubbed values
are what get stored.

Evidence: recruit application `Raneem Dawahade / tsukuyomidomain00@gmail.com` was approved under
master partner `81f7f86b-…` and the created profile `d8bce800-…` has
`master_partner_id = NULL`, `must_change_password = false`, role `social_media_partner`.
This is the "attribution disappears" bug, and it also breaks the forced password change.

**Root cause 2 — "wrong information" is the login screen, not the invitation.**
The Arabic string is `auth.invalidCredentials` ("بيانات تسجيل الدخول غير صحيحة") on
`StudentAuthPage`. Invitations today are Supabase `generateLink({ type: 'recovery' })` links.
Those are single-use and short-lived: if the mail scanner pre-opens them, the user waits a day,
or opens on a second device, the token is already burned. `ResetPasswordPage` then silently
times out after 8s and dumps the user on the login page, where they have no password (a random
one was generated server-side) — so they get "wrong information" and the only visible way out is
signing up fresh. There is no invitation record to fall back on.

**Root cause 3 — there is no invitation model.** Nothing stores invited email, type, role,
inviter, master partner, case, status or expiry. State lives entirely inside a Supabase auth token,
so it cannot survive a refresh, a new device, or a second click.

Domains are already correct: both `approve-partner-recruit` and `create-student-from-case` use
`https://darb.agency`. No lovable.app URLs remain in the invite path (only in the CORS allowlist).

## The fix

### 1. Repair the profiles trigger (unblocks everything)
Rewrite `restrict_profiles_write()` to identify a trusted server caller correctly
(`session_user`/`auth.role()`/JWT role claim = `service_role`), keeping every existing restriction
for real end users. Then backfill `master_partner_id` on profiles for all already-approved recruit
applications so existing partners are attributed to the master partner who recruited them.

### 2. Real invitation records
New table `user_invitations`:
`invited_email, invitation_type (student|partner), intended_role, token_hash (sha256 of the
emailed token), inviter_id, master_partner_id, case_id, recruit_application_id, status
(pending|accepted|revoked), expires_at (7 days), accepted_at, accepted_user_id, timestamps`.
RLS: no anon/authenticated read of the raw table; validation happens through security-definer
functions. Grants for `service_role` + admin read for the inbox UI.

### 3. Invitation links point at a real activation page
`approve-partner-recruit` and `create-student-from-case` stop emailing recovery links and instead
create/reuse an invitation row and email
`https://darb.agency/activate?token=<opaque token>`.
Re-sending an invite reuses the same invitation record with a fresh token — it never creates a
duplicate invitation or a duplicate account. The activation token is long-lived (7 days),
re-openable, device independent, and stored hashed.

### 4. Activation page + "You were invited" modal
New public route `/activate`:
- looks the token up through `get_invitation_preview(token)` (returns type, masked invited email,
  recruiter/case label, status) before asking for anything;
- shows the "You were invited" panel with the invited email prefilled and read-only-ish,
  plus new password + confirm password;
- distinct, translated states for *invalid token*, *expired*, *already accepted → sign in*,
  and *email does not match this invitation* — never the generic "wrong information";
- on success signs the user in and routes by role (partner → partner dashboard, student → student
  dashboard).

`/student-auth` gets a small addition: if it is reached with `?token=…` (or an activation attempt
failed), it surfaces the same invited-user modal instead of the plain login form. Normal login,
password reset, and the existing `/reset-password` recovery flow stay exactly as they are.

### 5. Server-side acceptance (edge function `accept-invitation`, no JWT required)
Validates, in this order: token hash exists → status is `pending` → not expired → submitted email
matches the invited email → password meets policy. Only then does it create **or reuse** the auth
user, set the password, assign the intended role, write `master_partner_id` (partner) or link the
existing case/student record (student), mark the invitation accepted with `accepted_user_id`, and
audit-log it. The master-partner id and case id are read from the invitation row on the server —
never from the URL, the browser, or the submitted form — so a tampered URL cannot re-point a
recruit at a different master partner, and no duplicate student/partner record is created.

### 6. Tests
- Unit: invitation validation matrix (valid, tampered token, expired, already accepted, wrong
  email, duplicate email with existing account).
- E2E (`e2e/partner-recruit.spec.ts` extended + a new student invite spec): approve → invitation
  row created → activation page shows "You were invited" → set password → dashboard opens; then a
  direct database assertion that `profiles.master_partner_id` equals the recruiting master partner
  and that the student user is linked to the exact originating case.
- Manual live send to `tsukuyomidomain00@gmail.com` with database verification afterwards.

## Technical notes
- Migration steps: fix `restrict_profiles_write`, backfill attribution, create `user_invitations`
  (+ grants, RLS, indexes), add `get_invitation_preview` security-definer function.
- Edge functions touched: `approve-partner-recruit`, `create-student-from-case`, new
  `accept-invitation` (`verify_jwt = false`), redeploy all three.
- Templates `partner-invite.tsx` / `student-invite.tsx` keep their design; only the
  `activationUrl` value changes.
- Frontend: new `src/pages/ActivateAccountPage.tsx`, route in `App.tsx`, invited-user modal on
  `StudentAuthPage`, new `ar`/`en` strings under an `activate.*` namespace.
