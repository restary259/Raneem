
## Assessment of Phase 1 Foundation

**What's solid:**
- ✅ `AuthContext.tsx` — correct 4-role enum, `get_my_role()` RPC, 6s safety timer, `mustChangePassword`
- ✅ `ProtectedRoute.tsx` — correct check order (initialized → user → mustChangePassword → role → AdminSecurityGate for admin only)
- ✅ `DashboardLayout.tsx` — collapsible sidebar with `navConfig` for all 4 roles, RTL-aware, NotificationBell, signOut
- ✅ `App.tsx` — routes correctly structured: `/admin/*`, `/team/*`, `/partner/*`, `/student/*` with ProtectedRoute; legacy redirects in place
- ✅ `main.tsx` — AuthProvider wrapping App correctly
- ✅ Database: new `cases`, `appointments`, `case_submissions`, `programs`, `accommodations`, `visa_applications`, `platform_settings`, `important_contacts`, `referrals`, `activity_log` tables all present per schema

**Two gaps to fix BEFORE Phase 2:**

1. **AdminDashboardPage has duplicate security gate logic** — it has its OWN `AdminSecurityGate` and `admin-verify` edge function call hardcoded inside it, SEPARATE from `ProtectedRoute`. This means the admin hits the security gate TWICE. The old `AdminDashboardPage` was built before `ProtectedRoute` existed. It must be unwrapped — the page should just render its content directly, trusting that `ProtectedRoute` already handled auth + security gate.

2. **Translation keys missing for DashboardLayout nav items** — `DashboardLayout` uses `t('nav.overview')`, `t('nav.pipeline')`, etc., but the locale files don't have a `nav` namespace or these keys. The sidebar will show raw key strings. Must add all nav keys to both `en/dashboard.json` and `ar/dashboard.json`.

---

## Phase 2 Plan — Admin Dashboard (9 pages)

All pages render inside the `DashboardLayout` via `<Outlet />`. They are standalone page components, not tab-based.

### Files to create:
1. `src/pages/admin/AdminCommandCenter.tsx` — KPI tiles (active cases, submitted this month, enrolled this month), forgotten cases alert, recent activity feed (last 10 from `activity_log`)
2. `src/pages/admin/AdminPipelinePage.tsx` — Kanban board: columns for each case status, cards showing name + assigned team member + days in stage, click to advance, assign dropdown
3. `src/pages/admin/AdminTeamPage.tsx` — team members list (from `user_roles` joined to `profiles` for `team_member` + `social_media_partner`), "Create Team Member" button calling `create-team-member` edge function
4. `src/pages/admin/AdminProgramsPage.tsx` — Programs tab (CRUD on `programs`) + Accommodations tab (CRUD on `accommodations`)
5. `src/pages/admin/AdminSubmissionsPage.tsx` — Cases at `submitted` status; each opens detail; "Mark Enrolled" button sets `case_status = 'enrollment_paid'` and sets `enrollment_paid_at` on `case_submissions`
6. `src/pages/admin/AdminFinancialsPage.tsx` — total revenue from `case_submissions.service_fee + translation_fee` on enrolled cases, partner commission owed, referral discounts applied
7. `src/pages/admin/AdminAnalyticsPage.tsx` — funnel chart (cases by status count), avg days per stage, source breakdown
8. `src/pages/admin/AdminActivityPage.tsx` — real-time feed from `activity_log` with realtime subscription
9. `src/pages/admin/AdminSettingsPage.tsx` — `platform_settings` CRUD (partner commission rate, forgotten thresholds), `important_contacts` full CRUD

### Wire routes in `App.tsx`:
Replace placeholder `AdminDashboardPage` references in sub-routes with the actual new page components.

### Fix AdminDashboardPage:
Strip out the duplicate `AdminSecurityGate` and `admin-verify` logic — the page now only renders for already-authenticated+authorized admins (ProtectedRoute handled it). Keep the old component for backward compat but redirect `/admin` index to `AdminCommandCenter`.

### i18n:
Add to both `en/dashboard.json` and `ar/dashboard.json`:
- All `nav.*` keys used by DashboardLayout
- All `case.status.*` keys
- `admin.commandCenter.*`, `admin.pipeline.*`, `admin.team.*`, `admin.programs.*`, `admin.submissions.*`, `admin.financials.*`, `admin.analytics.*`, `admin.activity.*`, `admin.settings.*`

### Data strategy for new admin pages:
Each page fetches its own data directly with `supabase.from(...)` using `useEffect` + `useState` (no shared hook needed for Phase 2 since each page is distinct). Realtime subscription on `cases` for pipeline and command center.

---

## File Summary

| File | Action |
|---|---|
| `src/pages/AdminDashboardPage.tsx` | Strip duplicate security gate, redirect index to AdminCommandCenter |
| `src/pages/admin/AdminCommandCenter.tsx` | New |
| `src/pages/admin/AdminPipelinePage.tsx` | New |
| `src/pages/admin/AdminTeamPage.tsx` | New |
| `src/pages/admin/AdminProgramsPage.tsx` | New |
| `src/pages/admin/AdminSubmissionsPage.tsx` | New |
| `src/pages/admin/AdminFinancialsPage.tsx` | New |
| `src/pages/admin/AdminAnalyticsPage.tsx` | New |
| `src/pages/admin/AdminActivityPage.tsx` | New |
| `src/pages/admin/AdminSettingsPage.tsx` | New |
| `src/App.tsx` | Wire new routes |
| `public/locales/en/dashboard.json` | Add nav.*, case.status.*, admin.* keys |
| `public/locales/ar/dashboard.json` | Add nav.*, case.status.*, admin.* keys |
