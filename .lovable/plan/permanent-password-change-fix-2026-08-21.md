# Permanent password-change fix

## Audit conclusion

### Exact root cause

The live failure is caused by a conflict between two database objects:

1. `public.clear_must_change_password()` is exposed to `authenticated` and performs:
   `UPDATE public.profiles SET must_change_password = false WHERE id = auth.uid()`.
2. The `BEFORE INSERT OR UPDATE` trigger on `public.profiles` executes `public.restrict_profiles_write()`. Its current live definition raises `Non-admin users cannot change must_change_password` whenever a non-admin changes that column.

`clear_must_change_password()` being `SECURITY DEFINER` does **not** bypass row triggers. For a normal signed-in caller, the trigger still sees `auth.uid()` as that user, the JWT/session role as `authenticated`, and `has_role(..., 'admin') = false`; it therefore rejects the RPC's own update.

This is proven by the live definitions and grants:

- `clear_must_change_password`: owner `postgres`, `SECURITY DEFINER`, executable by `authenticated`.
- `restrict_profiles_write`: the live function contains the exact exception at the `must_change_password` comparison.
- The `profiles` RLS policy already permits authenticated users to update their own row (`USING/WITH CHECK auth.uid() = id`), so RLS is **not** the source of this exception.
- Auth logs show a successful `PUT /user` password update followed immediately by repeated `same_password` errors. This proves Auth changed the password; the later flag-clear step failed and the UI retried the already-applied password.

### Why it keeps reappearing

- `restrict_profiles_write()` has been copied and redefined in **16 migrations**; every version retains the same admin-only `must_change_password` branch.
- `clear_must_change_password()` has been defined twice with the same incompatible body. The latest migration incorrectly states that `SECURITY DEFINER` “bypasses the trigger.”
- Previous work reasserted the RPC, backfilled flags, and patched callers, but never reconciled the RPC with the trigger. The backfill set more non-admin rows to `true`, increasing exposure to the broken path.
- `ForcePasswordChange` currently treats a failed flag clear as non-blocking and calls `onDone()`. The in-memory gate opens, while the database flag remains `true`; the next login reads it again and reopens the gate.
- The existing guard test only rejects direct frontend writes. It does not exercise the live RPC/trigger interaction. Its component test explicitly expects the fail-open behavior.
- Password updates are duplicated across six frontend surfaces with inconsistent handling. Partner and agent settings update Auth but do not run the flag-clear step; this is not the primary forced-gate failure, but it is another source of drift.

## Implementation

### 1. Create one server-owned password-change transaction boundary

Add a `change-own-password` Edge Function as the sole user-facing password mutation path.

- Require a valid bearer session; do not accept a target user ID or role from the client.
- Resolve the caller from the bearer token.
- Use a user-scoped backend client to call the native Auth password update, preserving Auth password policy and session checks.
- Treat Auth's `same_password` response as recoverable **only** so a retry can finish a prior partial success.
- After Auth succeeds (or the retry reports `same_password`), use the service-role backend client to set `profiles.must_change_password = false` for the resolved caller ID only.
- Re-select and verify that the flag is false before returning success.
- Never log or return the submitted password.
- Return structured error codes for invalid session, weak/same password, Auth failure, and flag-persistence failure.

This removes the trigger/RPC collision without weakening the trigger: the service-owned profile update follows the existing trusted-server path, while the endpoint itself is strictly self-scoped.

### 2. Retire the broken authenticated RPC path

Add one new, latest migration that:

- Revokes `EXECUTE` on `public.clear_must_change_password()` from `PUBLIC`, `anon`, and `authenticated`.
- Retains service-role access only if the function is kept for internal recovery; otherwise drops it after all source call sites are removed.
- Does **not** loosen the `profiles` UPDATE policy or allow ordinary users to write `must_change_password` directly.
- Does **not** remove or weaken any other guarded columns in `restrict_profiles_write()`.

No data backfill is needed for correctness: flagged users complete the unified flow on their next attempt. Any cleanup of already-stale flags must be a separate, evidence-based operator action, not an automatic blanket clear.

### 3. Centralize every frontend password change

Add one typed client helper that invokes `change-own-password`, normalizes structured errors, and returns success only after both Auth and profile-flag persistence succeed.

Replace all six independent implementations:

- `src/components/auth/ForcePasswordChange.tsx`
- `src/pages/ResetPasswordPage.tsx`
- `src/pages/StudentAuthPage.tsx`
- `src/components/admin/AdminSecurityGate.tsx`
- `src/pages/partner/PartnerProfilePage.tsx`
- `src/pages/agent/AgentSettingsPage.tsx`

For forced-password flows:

- Remove the current fail-open behavior; do not call `onDone()` until the server confirms the flag is false.
- Refresh auth/profile state after success so `ProtectedRoute` observes `mustChangePassword = false` immediately.
- Preserve retry behavior: if the password changed but the flag write failed, resubmitting the same password must finish the flag clear rather than trap the user.

### 4. Make the migration/function boundary non-regressible

Replace comment-based assumptions with executable guards:

- Extend the source guard test so no app component may call `supabase.auth.updateUser({ password })` or `clear_must_change_password` directly; only the centralized helper may initiate the Edge Function.
- Add a migration-order regression test that fails if any migration newer than the canonical password-security migration redefines `restrict_profiles_write()` or re-grants authenticated execution of `clear_must_change_password()` without updating the canonical contract.
- Add an Edge Function source test asserting: caller identity is server-derived, no target user ID is accepted, Auth update precedes the flag clear, `same_password` retry is supported, the flag is re-selected, and success is returned only after verification.
- Update the misleading migration comments/documentation that claim `SECURITY DEFINER` bypasses triggers.

## Affected files and objects

### Frontend

- New shared password-change client helper.
- The six password-changing components/pages listed above.
- `src/lib/authError.ts` only if needed to map the new structured error codes consistently.
- `src/components/auth/__tests__/ForcePasswordChange.test.tsx` to replace the current fail-open expectation.
- `src/lib/mustChangePasswordGuard.test.ts` and a new password-flow/migration regression test.

### Backend

- New `supabase/functions/change-own-password/index.ts`.
- New latest migration revoking the obsolete authenticated RPC entry point.
- `public.clear_must_change_password()` grants or removal.
- `public.restrict_profiles_write()` remains strict; no RLS policy broadening.

### Explicitly not root causes

- Native Auth password update: observed succeeding.
- `profiles` self-update RLS policy: it allows the row; the trigger raises afterward.
- `ProtectedRoute`: it correctly re-enforces the still-true database flag and therefore exposes, rather than creates, the bug.
- Account-creation functions that stamp `must_change_password = true`: they use trusted server credentials and are intentionally setting the gate.

## Security boundaries that must not change

- Do not grant non-admin users direct write access to `must_change_password`.
- Do not add a blanket trigger bypass for `authenticated`, `auth.uid()`, `current_user`, or all `SECURITY DEFINER` calls.
- Do not permit a client-supplied user ID in the new function.
- Do not weaken the self-row RLS predicate or any unrelated guarded profile fields.
- Do not change role records, admin checks, MFA, invitation behavior, or account-creation permissions.
- Keep `accept-invitation` setting `must_change_password = false`; invitees choose their password during activation.
- Keep manual account-creation functions stamping and verifying `must_change_password = true` before returning a temporary password.

## Verification matrix

### Functional, using real authenticated requests

For each role — `admin`, `team_member`, `social_media_partner`, `ambassador`, `agent`, and `student`:

1. Set up a test account with `must_change_password = true` through an authorized server fixture.
2. Sign in and confirm the protected route displays the forced-password gate.
3. Submit a valid new password through the exact deployed function call.
4. Verify Auth accepts login with the new password and rejects the old password.
5. Verify the caller's profile flag is false and the gate stays cleared after sign-out/sign-in.
6. Repeat the request with the same password after a simulated flag-write failure; verify recovery completes without changing another field.

Also verify voluntary changes from partner and agent settings and the recovery-link page use the same path.

### Negative security tests

- Anonymous request to the function returns `401`.
- Authenticated callers cannot choose or alter another user's ID.
- Direct authenticated `profiles.must_change_password` updates remain rejected by `restrict_profiles_write()`.
- Authenticated execution of `clear_must_change_password()` is denied after migration.
- Attempts to change `commission_amount`, roles, manager/feature flags, attribution, deactivation fields, email, or another profile remain denied exactly as before.
- Non-admin access to admin routes/RPCs remains denied; admin MFA behavior remains intact.

### Deployment and regression checks

- Deploy `change-own-password`, apply the migration, then run the full build and test suite.
- Run the backend security linter/scan and confirm no new executable `SECURITY DEFINER` exposure.
- Inspect live grants and current trigger/function definitions after migration.
- Execute the real function flow for all six roles, not a generic database probe.
- Re-run direct-write denial tests after success.
- Confirm the migration-order/source guards fail against a fixture that reintroduces an authenticated RPC grant or a direct password-update call.

## Success criteria

There is one user-facing password-change implementation. Auth changes the caller's password and the trusted backend clears only that caller's flag before reporting success. Every role can complete the flow, direct flag manipulation stays blocked, unrelated permissions remain unchanged, retries recover partial success, and automated guards prevent later migrations or UI code from restoring the broken RPC/trigger pattern.
