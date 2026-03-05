
## Root Cause Analysis

From the auth logs provided:
1. **`invalid_credentials` (400)** — repeated failed logins mean the current password stored in Supabase auth doesn't match what's being tried. The password was changed multiple times via competing flows and likely ended up in an unknown state.
2. **`insufficient_aal` (401) on `/user` PUT** — when the admin tried to update password, Supabase blocked it because MFA is enrolled but the session is only AAL1. The `AdminSecurityGate` must complete TOTP verification BEFORE calling `updateUser({ password })`.
3. **One successful login at 02:04:21** followed immediately by a logout + failed `updateUser` → session was AAL1 but `updateUser` requires AAL2 when TOTP is enrolled.

**The real blocker**: The admin has an enrolled TOTP factor. Changing the password requires AAL2 (TOTP verified). But the current flow in `AdminSecurityGate` tries to update the password FIRST (`force-password` step), THEN verify TOTP. This is backwards — Supabase requires AAL2 before allowing password changes when MFA is enabled.

**The fix order must be**:
1. Login (AAL1 session)
2. TOTP challenge → verify → elevate to AAL2
3. THEN change password (now allowed because AAL2)
4. Mark `must_change_password = false`

## Plan

### 1. Fix `AdminSecurityGate` — Reorder steps correctly
Change the `check()` flow:
- If `must_change_password` AND has verified TOTP factor → go to `verify-totp` FIRST (not `force-password`)
- Only after TOTP verified (AAL2 reached) → show `force-password` 
- After password changed → done

New step order for existing admin with TOTP:
```
checking → verify-totp (AAL2) → force-password → done
```

New step order for fresh admin without TOTP:
```
checking → force-password → enroll-totp → done
```

### 2. Reset the admin account cleanly via migration
- Clear any stale MFA factors (unenroll existing TOTP) so admin starts fresh
- Set `must_change_password = true`
- Set password to known temp value: `DarbAdmin@2026!`

This ensures the admin won't hit the AAL2-required-for-password-change issue since they'll have no enrolled factor on first login.

### 3. Database migration
Run SQL to:
- Unenroll existing MFA factors for the admin user via `auth.mfa_factors` table deletion
- Reset `must_change_password = true` in profiles
- Clear `login_attempts` for the email

### Files to change:
- `src/components/admin/AdminSecurityGate.tsx` — fix step order (verify TOTP before password change)
- Database migration — clear MFA factors + reset password flag

### Temp password
The temp password will be: `DarbAdmin@2026!`
(Shared here as we're in the Lovable build interface — change immediately on first login)

The new flow after reset:
1. Login with `ranimdwahde3@gmail.com` / `DarbAdmin@2026!`  
2. `AdminSecurityGate` detects `must_change_password=true`, no TOTP factor → shows `force-password` directly
3. Admin sets new strong password
4. Admin enrolls TOTP (2FA)
5. Admin enters dashboard

### Specifically in AdminSecurityGate.tsx:
The `check()` function needs a smarter decision tree:

```typescript
const check = async () => {
  const { data: profile } = await supabase.from('profiles')...
  const mustChange = profile?.must_change_password ?? false;
  
  const { data: mfaData } = await supabase.auth.mfa.listFactors();
  const verified = (mfaData?.totp ?? []).find(f => f.status === 'verified');
  
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const isAAL2 = aalData?.currentLevel === 'aal2';
  
  if (verified && !isAAL2) {
    // Must verify TOTP first (required for any sensitive operation)
    setVerifyFactorId(verified.id);
    setStep('verify-totp');
    return;
  }
  
  // Now at AAL2 (or no TOTP enrolled)
  if (mustChange) {
    setStep('force-password');
    return;
  }
  
  if (!verified) {
    await startEnrollment();
    return;
  }
  
  setStep('done');
  onCleared();
};
```

And `handlePasswordChange` — after password update, check if TOTP is enrolled, if not enroll, otherwise done.
