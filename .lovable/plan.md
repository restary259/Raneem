# Master Partner recruit approval — account creation, branded invite email, inbox spacing

## The gap

When an admin approves a recruit application in the Applications inbox today:

1. `create-team-member` creates the auth account with a random temporary password.
2. The temp password is shown **once, in a toast** on the admin screen.
3. `approve_recruit_application` links the new user to the master partner and marks the row approved.

Nothing is ever sent to the recruited partner. They have an account and a dashboard, but no way to reach it unless the admin manually copies the password out of a toast and messages it. There is no invite email and no activation link.

Three additional correctness risks make this unsafe to scale:

- **Two-step approval can half-complete.** Account creation and the approval/link step are separate calls. If the second fails, the account exists but the application stays `pending` and the partner is not linked to the master partner. Retrying then fails with "already has this role".
- **No validation of the recruiter.** `create-team-member` accepts any `master_partner_id` without checking that the profile is actually a master partner, or that it matches the application row.
- **Profile overwrite.** The profile upsert always writes `commission_amount: 0` and `master_partner_id: null` for non-partner roles, so re-running it on an existing account can wipe values.

## What to build

### 1. One atomic approval path

New edge function `approve-partner-recruit` becomes the single entry point the Approve button calls. It does everything server-side, in order, and is safe to retry:

- Verify the caller's JWT and admin role.
- Load the application by id; refuse unless status is `pending`.
- Take the email, full name and `master_partner_id` **from the application row** — never from the client request body. The email the recruit typed at signup becomes their login email.
- Verify that `master_partner_id` points to a live profile with `is_master_partner = true`. Abort with a clear error otherwise.
- Create the auth account (email confirmed, random password never returned to the client) or reuse an existing account with the same email.
- Assign the `social_media_partner` role, set `master_partner_id`, and set `must_change_password` only for brand-new accounts. Only touch the profile columns this flow owns — no blanket `commission_amount` reset.
- Mark the application `approved` with `reviewed_by` and `reviewed_at`, and store `created_user_id`.
- Generate a single-use activation link and send the branded invite email.
- Write an admin audit log row.

If the email step fails, the approval still stands and the response reports that the invite did not go out, so the admin can resend rather than losing the account.

### 2. Branded partner invite email

New template `partner-invite` in the existing Lovable Emails setup, styled to match the current student invite (Arabic RTL, Darb brand):

- Greets the partner by name and states they were approved into `<master partner name>`'s network.
- Shows the login email.
- Primary button: a one-time activation link to choose a password.
- Short list of what the partner dashboard gives them (referral link, students, earnings, payout requests).
- Note that the link is single-use and must not be shared.

Registered in the template registry alongside `new-message`, `email-test` and `student-invite`.

### 3. Resend invite

The recruits list gets a **Resend invite** action on approved rows that issues a fresh activation link and re-sends the same email. This covers a bounced first send or a link that was never used, without creating a second account.

### 4. Inbox spacing fix

Every other admin page wraps its content in `p-4 sm:p-6 ... max-w-* mx-auto`. The rebuilt inbox page is missing that wrapper, which is why the header icon, search bar, export button and the submission cards run flush into the sidebar and off the right edge.

- Wrap the inbox page in the standard `p-4 sm:p-6 space-y-6 max-w-6xl mx-auto` shell.
- Re-align the sticky toolbar so its background still spans edge to edge while the controls stay inside the padded column.
- Same wrapper check applied to the two other admin pages missing it (Students, Financials) so the dashboard is consistent.

## Verification

- Live run: submit a recruit application through `/join/MP-XXXX`, approve it as admin, confirm the account is created with the applied email, `master_partner_id` matches the recruiting master partner, the application flips to approved, and the invite email is queued.
- Retry the approve action on an already-approved row and confirm it is refused cleanly instead of creating a duplicate.
- Confirm the activation link lands on the password screen and the partner reaches the partner dashboard with the correct network attribution and commission split.
- Screenshot the inbox at desktop and mobile widths in light and dark mode to confirm spacing.

## Technical notes

- New: `supabase/functions/approve-partner-recruit/index.ts`, `supabase/functions/_shared/transactional-email-templates/partner-invite.tsx`, plus a registry entry.
- Activation links use `auth.admin.generateLink({ type: "recovery" })` with the `/reset-password` redirect — the same mechanism already used for student invites. No plaintext password is ever emailed or stored.
- `RecruitApplicationsPanel.tsx` switches from the two-call sequence to the single function, drops the temp-password toast, and gains the resend action.
- `approve_recruit_application` / `reject_recruit_application` stay in place; the new function writes the approval with the verified admin id from the JWT.
- No commission math changes: the ₪1000 pool, the master's ₪200 override, and rate overrides are untouched.
