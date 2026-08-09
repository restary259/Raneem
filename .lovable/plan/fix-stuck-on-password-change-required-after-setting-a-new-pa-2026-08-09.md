# Fix: stuck on "Password Change Required" after setting a new password

## What is happening

Confirmed from the sign-in logs and the database:

- The password change itself **succeeds** (auth log shows a successful user update at 16:48:35).
- But the account's "must change password" flag is **still on** (`team@gmail.com` → `must_change_password = true`).
- Because the flag is still on, the app immediately re-opens the same dialog, so it looks like nothing happened. Pressing the button again with the same password returns "New password should be different from the old password" (seen in the logs at 16:48:38), which is why it feels permanently stuck.

## Root cause

A security rule added earlier (the profile-protection trigger) blocks **any non-admin** from changing `must_change_password` — it was added to stop privilege tampering. The sign-in screen tries to clear that flag directly from the browser, the database rejects it, and the app ignores that rejection instead of reporting it. Result: password updated, flag never cleared, dialog loops.

The same flawed pattern exists in a second place (`src/components/auth/ForcePasswordChange.tsx`), so any role hitting that screen would loop too.

## The fix

1. **Database:** add a small server-side function `clear_must_change_password()` that lets a signed-in user clear only their own flag, and nothing else. The trigger keeps blocking every other attempt to touch that field, so the security guarantee stays intact.
2. **Sign-in screen (`src/pages/StudentAuthPage.tsx`):**
   - Change the password first, then call the new function to clear the flag.
   - Stop ignoring failures: if clearing the flag fails, show the real error instead of silently looping.
   - Remove the fragile "update flag first, roll it back on failure" logic.
3. **`src/components/auth/ForcePasswordChange.tsx`:** apply the same corrected order and error handling.
4. **Unblock the affected account:** clear the stale flag for `team@gmail.com`, whose password is already changed, so it can sign in without repeating the dialog.
5. **Verify:** sign in with a temporary-password account, set a new password, and confirm it lands on the correct dashboard for its role with no dialog reappearing.

## Technical notes

- New RPC: `public.clear_must_change_password()` — `SECURITY DEFINER`, `search_path = public`, updates `profiles.must_change_password = false WHERE id = auth.uid()`, granted to `authenticated` only. It sets no other column, so it cannot be used for privilege escalation.
- `restrict_profiles_write` stays unchanged; the definer function runs as owner and is therefore allowed.
- Client order becomes: `supabase.auth.updateUser({ password })` → `supabase.rpc('clear_must_change_password')` → check error → `refreshRole()` → close modal. The redirect effect in `StudentAuthPage` then routes by role via `ROLE_TO_PATH`.
- Data fix: one-off update of `profiles.must_change_password = false` for the already-changed account.
