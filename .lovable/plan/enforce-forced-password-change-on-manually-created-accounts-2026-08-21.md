# Enforce forced password change on manually-created accounts

## What I verified first

- `create-team-member` already does the dedicated flag update, 500s on error, and re-checks the saved value before returning the temporary password.
- `agent-create-account` does the same in its own style.
- `accept-invitation` still turns the flag off (correct — the invitee picked their own password). It will not be touched.
- Live data: 5 active non-admin accounts currently have the flag off. Exactly 1 of them came from an accepted email invitation; the other 4 were created manually and were handed a temporary password.

So the source is already correct — the gap is deployment plus the accounts created before the fix.

## Plan

1. **Redeploy both functions** (`create-team-member`, `agent-create-account`) so the live behaviour matches the source. No code change needed to either file.

2. **Backfill migration.** Turn the flag on for active non-admin profiles that currently have it off *and* have no accepted invitation linked to them. Invite-activated users (who chose their own password) are excluded by that condition, so the one invited team member is left alone. Admins are excluded. This flips the 4 manually-created accounts.

3. **Regression test** in `src/lib/` mirroring the existing guard tests: assert that both manual-creation functions contain the stamp + verify sequence and never return the temp password before verification, and that `accept-invitation` still sets the flag to false.

4. **Verify**: run the build and the full test suite, and confirm both are green.

## Technical notes

- Backfill condition: `must_change_password = false AND deleted_at IS NULL AND role <> 'admin' AND id NOT IN (SELECT accepted_user_id FROM user_invitations WHERE status = 'accepted')`.
- The migration is idempotent (re-running changes nothing).
- No change to the invite flow, roles, RLS, or the profile write trigger.
