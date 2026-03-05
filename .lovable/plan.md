
## Full Audit & Phase 4 Implementation Plan

### What I Found — Current State

**Login page (StudentAuthPage.tsx) — issues:**
1. Still imports and references `lovable` for Google OAuth (lines 3, 56-65) — must be removed
2. Still renders Google sign-in button (lines 234-253) and divider — must be removed
3. `redirectByRole` logic is correct (`get_my_role()` RPC + `ROLE_TO_PATH`) ✅
4. `mustChangePassword` flow works correctly ✅
5. Visual design is a plain card — needs a polished makeover

**Phases 1-3 audit — mostly solid, one gap:**
- AuthContext ✅ — 4 roles, `get_my_role()`, 6s timer, `mustChangePassword`
- ProtectedRoute ✅ — correct order, AdminSecurityGate for admin only
- DashboardLayout ✅ — RTL-aware, collapsible, role-based nav
- App.tsx routing ✅ — all 4 role trees, legacy redirects
- DB schema ✅ — all tables present, RLS policies correct
- Admin pages (9) ✅ — all created, wired
- Team pages ✅ — all created, wired
- Edge functions ✅ — `create-team-member`, `record-appointment-outcome`, `create-student-from-case` all correct
- i18n ✅ — all nav.*, case.status.*, team.*, admin.* keys present

**Admin account setup — `ranimdwahde3@gmail.com`:**
- The `AdminSecurityGate` correctly handles: force-password → enroll-totp → verify-totp
- The password `Ranim123@123` satisfies `validatePassword` (10+ chars, uppercase, lowercase, number, special char) ✅
- If `must_change_password` is still true in DB, the gate will prompt password change first
- The TOTP 2FA flow is properly implemented in `AdminSecurityGate.tsx` ✅
- No code changes needed for admin setup — the gate handles it on first login

**Phase 4 scope — edge functions:**
Per the approved plan:
- Update `create-team-member` → Already updated (role validation is `team_member`/`social_media_partner`) ✅  
- Update `admin-mark-paid` → needs updating to set `enrollment_paid_at` on `case_submissions`
- Create `create-student-from-case` → Already created ✅
- Create `record-appointment-outcome` → Already created ✅
- Create `create-case-from-apply` → NOT yet created (still missing)
- Create `log-activity` → NOT needed as standalone edge fn — `log_activity` RPC exists in DB and is called directly ✅
- Delete: `lead-sla-check`, `admin-early-release`, `admin-weekly-digest`, `seed-majors`, `create-influencer` → still exist in filesystem but just unused; will delete

---

### Plan

**Fix 1: StudentAuthPage — remove Google button, polish UI**
- Remove the `lovable` import and `handleGoogleSignIn` function entirely
- Remove the divider + Google button from JSX
- Redesign the page: dark gradient background (slate-900 to blue-950), centered card with DARB logo/name prominently, frosted glass card effect, branded color button, clean typography
- Keep: login form, forgot password link, change-password modal

**Fix 2: Create `create-case-from-apply` edge function**
- Receives: `full_name`, `phone_number`, `source` (= `'apply_page'`), optional `partner_id`
- Validates partner_id if provided (checks `user_roles` for `social_media_partner`)
- Inserts into `cases` table with `source`, `partner_id`, `status='new'`
- Calls `log_activity` RPC
- Returns `{ case_id }`
- Note: does NOT modify `/apply` form itself — that's a separate concern

**Fix 3: Update `admin-mark-paid` edge function**
- Currently does what? Need to check — update it to:
  - Set `case.status = 'enrollment_paid'`
  - Set `case_submissions.enrollment_paid_at = now()`, `enrollment_paid_by = caller_id`
  - Call `log_activity`

**Fix 4: Delete obsolete edge functions**
- Delete: `lead-sla-check`, `admin-early-release`, `admin-weekly-digest`, `seed-majors`, `create-influencer`
- These are dead code per Phase 4 plan

**Fix 5: i18n — add `auth.loginSubtitle` key to `en/common.json` and `ar/common.json`**
- The login page uses `t('auth.loginSubtitle', 'Sign in to your DARB account')` — fallback exists so not critical, but clean it up

---

### Files to change

| File | Action |
|---|---|
| `src/pages/StudentAuthPage.tsx` | Remove Google OAuth, redesign UI |
| `supabase/functions/create-case-from-apply/index.ts` | Create new |
| `supabase/functions/admin-mark-paid/index.ts` | Update to new schema |
| `supabase/functions/lead-sla-check/index.ts` | Delete |
| `supabase/functions/admin-early-release/index.ts` | Delete |
| `supabase/functions/admin-weekly-digest/index.ts` | Delete |
| `supabase/functions/seed-majors/index.ts` | Delete |
| `supabase/functions/create-influencer/index.ts` | Delete |
| `public/locales/en/common.json` | Add `auth.loginSubtitle` |
| `public/locales/ar/common.json` | Add `auth.loginSubtitle` |

**After implementation, admin `ranimdwahde3@gmail.com` with `Ranim123@123`:**
1. Logs in → auth-guard validates credentials
2. `AuthContext` fetches role → `admin`
3. `ProtectedRoute` detects `admin` → renders `AdminSecurityGate`
4. Gate checks `must_change_password` → if true, force new password (skip since Ranim123@123 is strong)
5. Gate checks TOTP factors → if no verified factor, shows QR code to enroll
6. Admin scans with Google Authenticator, enters 6-digit code
7. Gate verifies → `onCleared()` called → dashboard loads
8. On subsequent logins, gate goes directly to TOTP verify step

No migration needed. The admin account must exist in the DB with `admin` role in `user_roles`. This is confirmed from auth logs showing `ranimdwahde3@gmail.com` successfully logging in (status 200).
