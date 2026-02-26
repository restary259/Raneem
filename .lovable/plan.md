
# Security & Auth Overhaul — 5 Targeted Fixes

This plan covers exactly what the prompt specifies, no more, no less. Changes are surgical and will not touch any business logic, commission formulas, or unrelated components.

---

## Fix 1 — Remove Uniplaces Completely

**Files to delete:**
- `supabase/functions/uniplaces-proxy/index.ts` (entire folder)
- `src/pages/HousingPage.tsx`
- `src/components/housing/BookingButton.tsx`
- `src/components/housing/HousingCard.tsx`
- `src/components/housing/HousingDetailModal.tsx`
- `src/components/housing/HousingFilters.tsx`
- `src/components/housing/HousingGrid.tsx`
- `src/components/housing/HousingHero.tsx`

**`src/App.tsx` edits (2 lines removed):**
- Remove `const HousingPage = lazy(() => import('./pages/HousingPage'));` (line 41)
- Remove `<Route path="/housing" element={<HousingPage />} />` (line 116)

**`supabase/config.toml` edit:**
- Remove the `[functions.uniplaces-proxy]` block

---

## Fix 2 — Password Reset: Always Redirects to Our Page

**4 bugs to fix:**

### 2a — `StudentAuthPage.tsx` line 189
Change:
```ts
emailRedirectTo: `https://darb-agency.lovable.app/student-dashboard`
```
To:
```ts
emailRedirectTo: `${window.location.origin}/student-dashboard`
```

### 2b — `PasswordResetModal.tsx`
Already correct (`${window.location.origin}/reset-password`). No change needed.

### 2c — Rewrite `ResetPasswordPage.tsx`
The current page checks `access_token` in query params — but Supabase sends the token in the **URL hash fragment** (`#access_token=...`), not as a query param. This is the root cause of the redirect failure. The new implementation:
- Listens to `onAuthStateChange` for `PASSWORD_RECOVERY` event (which Supabase fires automatically after parsing the hash)
- Shows a spinner while waiting (up to 8s safety timeout)
- Validates password using the existing `validatePassword` helper (10+ chars, uppercase, lowercase, number, symbol)
- Signs out after successful reset and redirects to `/student-auth`
- Shows password strength indicator and show/hide toggles

### 2d — Update `tooShort` locale strings
- `public/locales/en/common.json` → `"tooShort": "Password must be at least 10 characters with uppercase, lowercase, number, and symbol"`
- `public/locales/ar/common.json` → `"tooShort": "كلمة المرور يجب أن تكون 10 أحرف على الأقل مع حرف كبير وصغير ورقم ورمز"`

---

## Fix 3 — Google Sign-In Button on Auth Page

### 3a — Add Google OAuth button to `StudentAuthPage.tsx`
- Add a `handleGoogleSignIn` function using `supabase.auth.signInWithOAuth({ provider: 'google' })`
- Add a visual divider + Google button with an inline SVG Google logo (no new dependency)
- Placed inside the card, above the mode-switch link

### 3b — Auto-assign `user` role for new Google sign-ins
In `redirectByRole`, if `roles` array is empty (new Google OAuth user with no role yet), insert `{ user_id, role: 'user' }` into `user_roles` then navigate to `/student-dashboard`. The existing `handle_new_user` trigger already inserts the `user` role on signup, but the OAuth flow may race with the trigger — this adds a safe fallback.

### 3c — Add locale keys
- `public/locales/en/common.json` inside `"auth"`: add `"orContinueWith"` and `"continueWithGoogle"`
- `public/locales/ar/common.json` inside `"auth"`: add same keys in Arabic

### 3d — Manual step (noted in comments, not code)
Developer must enable Google provider in the backend auth settings and add the callback URL to Google Cloud Console. This cannot be done in code.

---

## Fix 4 — Admin Forced Strong Password + 2FA Gate

### 4a — Database migration
New migration file `supabase/migrations/20260226120000_admin_security_enforcement.sql`:
- `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE`
- `UPDATE profiles SET must_change_password = TRUE WHERE id IN (SELECT user_id FROM user_roles WHERE role = 'admin')`
- Trigger `trg_admin_must_change_password`: automatically flags new admins on role assignment

### 4b — Create `src/components/admin/AdminSecurityGate.tsx`
A full-screen gate component with 4 sequential steps:
1. **`checking`** — queries profile for `must_change_password` and MFA factors; shows spinner
2. **`force-password`** — full password change form with `PasswordStrength` indicator and show/hide toggles; calls `supabase.auth.updateUser({ password })` then clears the DB flag
3. **`enroll-totp`** — QR code + manual secret + 6-digit code input; calls `supabase.auth.mfa.enroll()` → `challenge()` → `verify()`
4. **`verify-totp`** — 6-digit code input for returning admins at AAL1; calls `challenge()` → `verify()`
5. **`done`** — renders null, calls `onCleared()` to proceed

### 4c — Wire into `AdminDashboardPage.tsx`
- Add `securityCleared` state (starts `false`)
- Change the existing `setSessionReady(true)` at the end of `init()` to NOT set `sessionReady` immediately — `sessionReady` is only set when `AdminSecurityGate` calls `onCleared`
- Replace the single loading spinner with: spinner while `!isAdmin`, then `<AdminSecurityGate>` while `!securityCleared`, then the normal dashboard when both are true

---

## Fix 5 — Remove Dead `uniplaces-proxy` from `config.toml`

Already covered in Fix 1 — the `[functions.uniplaces-proxy]` block will be removed from `supabase/config.toml`.

---

## Summary of File Changes

| File | Action |
|---|---|
| `supabase/functions/uniplaces-proxy/index.ts` | Delete entire folder |
| `src/pages/HousingPage.tsx` | Delete |
| `src/components/housing/*` (6 files) | Delete |
| `src/App.tsx` | Remove 2 lines (HousingPage import + route) |
| `supabase/config.toml` | Remove `[functions.uniplaces-proxy]` block |
| `src/pages/StudentAuthPage.tsx` | Fix `emailRedirectTo` + add Google sign-in handler + button |
| `src/pages/ResetPasswordPage.tsx` | Full rewrite (hash-based recovery, PasswordStrength, sign-out) |
| `public/locales/en/common.json` | Update `tooShort`, add `orContinueWith` + `continueWithGoogle` in `auth` |
| `public/locales/ar/common.json` | Same as above in Arabic |
| `supabase/migrations/20260226120000_admin_security_enforcement.sql` | New migration: `must_change_password` column + admin trigger |
| `src/components/admin/AdminSecurityGate.tsx` | New component: password + TOTP gate |
| `src/pages/AdminDashboardPage.tsx` | Wire `AdminSecurityGate`, guard `sessionReady` behind `securityCleared` |

## What Will NOT Change
- No other routes, components, or hooks touched
- No existing i18n keys modified (only additions)
- No `auth-guard` edge function changes
- No `PasswordStrength`/`validatePassword` changes
- No `PasswordResetModal` changes (already correct)
- No commission, case, or payout logic changes
- No RLS policies changed
