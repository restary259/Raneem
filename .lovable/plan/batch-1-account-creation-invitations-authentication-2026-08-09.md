# Batch 1 — Account creation, invitations & authentication

Scope: dashboard operations side only. No public-site work.

## What the audit found (verified in code + database)

Account creation today
- Manual creation only, from Admin → Team page. It calls the `create-team-member` backend function, which creates the auth user with a random temporary password, assigns the role (team member / partner / ambassador / admin), writes the profile with "must change password", and returns the temp password for the admin to copy. No email is sent.
- A separate older `create-influencer` function still exists and assigns a role value (`influencer`) that is no longer part of the role list. It is legacy and unused by the current UI.
- Students get accounts through the case flow (`create-student-from-case`), which uses the durable invitation system.

Invitations today
- A real invitation system already exists and is correct in shape: an invitation row per invited person, hashed one-time token, 7-day expiry, revoke-older-links behaviour, a public activation page at `/activate`, and a server-side accept endpoint that reads role and network attribution from the invitation row (never from the URL).
- Only two entry points create invitations: student invites from a case, and partner invites when a master partner's recruit application is approved. There is no way for an admin to invite a team member, partner or ambassador directly.
- The database only allows invitation types `student` and `partner`. Team and ambassador invitations cannot be stored yet.
- Branded Arabic partner invitation email already exists in the production email system and points at the real domain.

Authentication behaviour
- The "clicking Sign In shows a create-new-password screen" behaviour is not a bug in the sign-in code — it is the intended forced password change for accounts created manually with a temporary password. Because manual creation always sets that flag, every new team/partner account hits it on first sign-in, which is why it reads as a bug. It will be verified against the live app before any change.
- Getting "stuck on the login page" happens when the signed-in account has no role row: the app signs the user back out with a message. Invitation-accepted accounts do get a role, manually created ones do too, so this needs live reproduction before being called a fault.
- Post-activation routing already routes on the invited role, so a partner cannot be sent to the student or team dashboard.

## What will be built

1. Extend the invitation system (not a second one)
   - Allow team and ambassador invitations alongside student and partner.
   - Add one admin-triggered invitation endpoint that creates the pending invitation and sends the branded email.
   - Add branded team/ambassador invitation emails in the same design system as the existing partner invite; keep the partner invite exactly as it is.

2. Admin UI: two clearly separated paths
   - In the Add-account dialog, the admin picks the role, then picks either "Create account manually" (existing behaviour, temp password shown to copy) or "Send invitation email" (no password, invited person sets their own).
   - Each path states plainly what happens next.
   - Add an "Invited / pending" state in the team list so admins can see who has an open invitation, with resend and revoke.

3. Demo partner invitation
   - Send a partner invitation to `tsukuyomidomain00@gmail.com` through the production email path and verify the stored invitation is partner-typed, correctly addressed and correctly linked.

4. End-to-end verification of the invited partner
   - Open the activation link, set the password, confirm it lands on the partner dashboard, survives refresh, logout and login again, and never bounces back to a password screen.

5. Auth fixes only if reproduced
   - Reproduce sign-in against the live app first. If the forced-password screen appears where a normal login is expected, the fix is at the source: invited accounts must never carry the "must change password" flag, and the flag must clear reliably after a change. Any real cause found will be fixed at the root, not hidden in the UI.

6. Security and data-integrity pass
   - Confirm role comes only from the invitation row, tokens are single-use and expire, no duplicate accounts on re-activation, email must match the invitation, and that a partner hitting `/admin` or `/team` URLs is blocked by the database rules and not only by the frontend guard.

## Technical notes

- Migration: relax the `user_invitations.invitation_type` check to include `team` and `ambassador`; no new tables.
- New function `invite-account` (admin-only, reuses `_shared/invitations.ts` `createInvitation` and the existing `send-transactional-email` sender). It returns the activation URL to the calling admin so the link can be copied and, for this batch, verified directly — the raw token is never stored, only its hash.
- New templates `team-invite` and `ambassador-invite` registered in the existing transactional template registry, built from the same shared email UI components as `partner-invite`.
- `AdminTeamPage.tsx` gains the mode switch and the pending-invitations list; `create-team-member` keeps its current manual behaviour untouched.
- Legacy `create-influencer` will be flagged for removal but not deleted in this batch unless you approve it.

## Reporting

Each step is reported separately as `STEP N DONE — files changed — how to verify` or `STEP N BLOCKED`, with a final status list for steps 1–8. Batch 2 will not be started.
