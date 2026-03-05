# Complete System Overhaul — DARB Platform v2

This is a full rebuild of the dashboard layer, database schema, and routing architecture. The public-facing pages (/apply, landing, contact, etc.) are untouched.

---

## Scope Summary


| Category       | Action                                                     |
| -------------- | ---------------------------------------------------------- |
| Database       | 1 new migration — new schema, new role enum, 12 new tables |
| Routes         | Delete 6 old routes, add 25+ new routes                    |
| Edge Functions | Update 2, create 4, delete 5                               |
| Components     | Delete ~20 old components, build ~50 new pages/components  |
| Auth           | New AuthContext with 4-role system                         |
| i18n           | New translation keys in both locale files                  |


---

##  Lovable Safeguards — Raneem Platform Overhaul

**Read this before writing a single line of code.**

---

## SECTION 1 — ABSOLUTE DO NOTs

These are hard stops. If any instruction, plan, or logical deduction leads you toward any of the following, stop and flag it instead of proceeding.

---

### 1. Do NOT touch `/apply` beyond two specific changes

The `/apply` public form is live and in use. You are only allowed to make exactly two changes to it:

- Pass `source: 'apply_page'` when creating the case
- Pass `partner_id` if `?ref=partner` exists in the URL query string

Everything else about `/apply` — its form fields, its layout, its validation, its submission logic — must remain exactly as it is. Do not refactor it, do not clean it up, do not "improve" it.

The case creation on submit must move from a client-side Supabase insert to a call to the new `create-case-from-apply` edge function. That is the only structural change allowed.

---

### 2. Do NOT create any self-registration flow for students

Students cannot sign up themselves. There is no "Create Account" or "Register" page for students. The only way a student account is created is:

- Via the `create-student-from-case` edge function, triggered by a team member after submission
- Or via a team member manually generating a temp password from the student's profile page

If you find yourself creating any route like `/student-register`, `/student-signup`, or any public form that creates a student auth user — stop. That is wrong.

The `/student-auth` page that already exists handles only login and password reset for existing student accounts. Do not add signup logic to it.

---

### 3. Do NOT apply AdminSecurityGate to any role except admin

The `AdminSecurityGate` component (TOTP 2FA check) wraps only the `/admin` route tree. It must not appear anywhere near `/team`, `/partner`, or `/student` routes. Do not generalize it, do not move it, do not "refactor" it into a shared component that other roles use.

---

### 4. Do NOT modify the PWA infrastructure

The following files are off-limits entirely:

```
public/sw.js (or any service worker file)
public/manifest.json
src/utils/pwaUtils.ts
src/hooks/usePWA.ts
src/components/common/PWAInstaller.tsx

```

Do not touch them. Do not "update" them for the new routing. Do not delete them. If anything breaks the PWA during this overhaul, it will be because you touched these files.

---

### 5. Do NOT install new npm packages without flagging first

Before adding any new dependency to `package.json`, stop and list what you want to install and why. Some packages conflict with the existing setup (particularly anything that touches routing, auth, or i18n). The existing stack is:

- `react-router-dom` — routing (already installed, do not swap for anything else)
- `@tanstack/react-query` — data fetching
- `react-i18next` — translations
- `@supabase/supabase-js` — database
- `shadcn/ui` — component library (already configured)
- `lucide-react` — icons

If you need a charting library for analytics pages, flag it. Do not silently add it.

---

### 6. Do NOT delete or modify these existing files without explicit instruction

The following files must be preserved exactly as they are unless a specific phase instruction says otherwise:

```
src/components/admin/AdminSecurityGate.tsx
src/components/auth/PasswordStrength.tsx
src/components/auth/PasswordResetModal.tsx
src/hooks/useSessionTimeout.ts
src/utils/pwaUtils.ts
src/integrations/supabase/client.ts
src/components/common/NotificationBell.tsx
src/components/common/OfflineIndicator.tsx
src/components/common/InAppBrowserBanner.tsx
src/components/common/CookieBanner.tsx

```

---

### 7. Do NOT create placeholder pages silently

If a page is in scope but you cannot complete it in this session, do not create a blank component or a "Coming Soon" placeholder without saying so explicitly. A silent placeholder will be mistaken for a completed page during review. Instead, list what is incomplete at the end of your session output.

---

### 8. Do NOT run TRUNCATE without CASCADE and correct order

The data reset in the migration must follow this exact order to avoid foreign key violations:

```sql
TRUNCATE public.notifications CASCADE;
TRUNCATE public.activity_log CASCADE;
TRUNCATE public.referrals CASCADE;
TRUNCATE public.visa_applications CASCADE;
TRUNCATE public.case_submissions CASCADE;
TRUNCATE public.appointments CASCADE;
TRUNCATE public.cases CASCADE;

```

Never run `TRUNCATE` on: `profiles`, `user_roles`, `platform_settings`, `programs`, `accommodations`, `important_contacts`, `documents`, `push_subscriptions`.

---

### 9. Do NOT drop columns or tables that are still referenced by live code

If you drop a table or column in the migration but the old component code still references it, the app will break on load even if the component is scheduled for deletion in a later phase. The correct order is:

1. Write the migration (new tables, new columns)
2. Update the code that uses the OLD structures to use the NEW ones
3. Only then drop the old structures in a follow-up migration

Never drop first and update later.

---

### 10. Do NOT change the Supabase project URL or anon key

`src/integrations/supabase/client.ts` must not be modified. The Supabase client configuration is environment-specific and changing it will break the connection to the live database.

---

## SECTION 2 — THINGS YOU MUST ALWAYS DO

---

### 1. Always use the `get_my_role()` RPC for role detection

Never read the `user_roles` table directly from the client to determine a user's role. Always use the `get_my_role()` SECURITY DEFINER RPC. This bypasses RLS safely and is the single source of truth for roles.

```typescript
// CORRECT
const { data: role } = await supabase.rpc('get_my_role');

// WRONG — never do this
const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);

```

---

### 2. Always add both Arabic and English translations for every new string

Every new UI string must have a translation entry in both:

- `src/i18n/locales/ar.ts` (or wherever the Arabic locale file lives — check the actual path)
- `src/i18n/locales/en.ts`

Do not hardcode any string directly in a component. Do not write `<p>New Case</p>`. Write `<p>{t('case.status.new')}</p>` and add the key to both locale files.

---

### 3. Always set `last_activity_at` when updating a case

The `get_forgotten_cases()` RPC uses `last_activity_at` to find stale cases. The trigger `trg_case_activity` handles this automatically on `UPDATE` — but only if you are actually updating the `cases` table row. If you update a related table (like `appointments` or `case_submissions`) you must also call:

```sql
UPDATE public.cases SET updated_at = now() WHERE id = :case_id;

```

Or call the `log-activity` edge function which handles this.

---

### 4. Always check `initialized` before rendering protected content

In `ProtectedRoute`, the component must show a spinner while `initialized === false`. Never render protected content or redirect before the auth state is confirmed. The safety timer is 6 seconds — do not shorten it.

```typescript
if (!initialized) return <Spinner />;
if (!user) return <Navigate to="/student-auth" replace />;

```

---

### 5. Always use ILS as the default currency

Any field that stores a monetary amount must default to ILS. Never default to USD or leave currency unset. Platform settings, fee fields, commission amounts — all ILS by default.

---

### 6. Always enable RLS on every new table

Every `CREATE TABLE` in the migration must be immediately followed by:

```sql
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

```

Then add explicit policies. A table with RLS enabled but no policies will deny ALL access including admin. Do not forget the admin policy.

---

### 7. Always use SECURITY DEFINER for functions that cross RLS boundaries

Any SQL function that reads across user boundaries (like `get_my_role`, `get_forgotten_cases`, `has_role`) must be:

```sql
CREATE OR REPLACE FUNCTION public.fn_name()
RETURNS ... LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$ ... $$;

```

Never use `SECURITY INVOKER` for these cross-boundary functions.

---

### 8. Always call `log-activity` after significant case events

The admin's Live Activity Feed depends on `activity_log` being populated. After any of these events, call the `log-activity` edge function:

- Case created (any source)
- Case status changed
- Appointment scheduled
- Appointment outcome recorded
- Student account created
- Submission completed
- Admin marks enrolled

---

### 9. Always handle the RTL/LTR layout in new components

The app switches between RTL (Arabic) and LTR (English). Every new component must:

- Use `useDirection()` hook or `useTranslation` + `i18n.language` to detect direction
- Never use `margin-left` or `margin-right` in fixed pixel values — use `ms-` / `me-` (margin-start/end) Tailwind utilities instead
- Test that the sidebar collapses correctly in both directions

---

### 10. Always set `mustChangePassword: true` when creating any new user account

When `create-team-member` or `create-student-from-case` creates a new auth user, the `profiles.must_change_password` column must be set to `true`. This forces the user to set a real password on first login. Never create a user account and leave this as `false`.

---

## SECTION 3 — SCHEMA RULES

These rules apply to every migration and every database interaction.

---

### The new `app_role` enum has exactly 4 values

```sql
CREATE TYPE public.app_role AS ENUM (
  'admin',
  'team_member',
  'social_media_partner',
  'student'
);

```

There is no `moderator`, no `influencer`, no `lawyer`, no `agent`. If you find references to these old roles anywhere in the code, delete them.

---

### The new case status flow is strictly defined

Valid status values and the only allowed transitions:

```
new → contacted
contacted → appointment_scheduled
appointment_scheduled → [outcome recorded]:
  completed  → profile_completion
  delayed    → appointment_scheduled (new date required)
  cancelled  → contacted
  rescheduled → appointment_scheduled (new appointment record)
  no_show    → forgotten
profile_completion → payment_confirmed
payment_confirmed → submitted
submitted → enrollment_paid  (admin only, via admin-mark-paid)

```

Terminal states: `enrollment_paid`, `forgotten`, `cancelled`

There is no `eligible`, no `assigned`, no `appt_waiting`, no `appt_completed`, no `services_filled`, no `ready_to_apply`, no `visa_stage`. These are OLD statuses. Delete every reference to them.

---

### The `cases` table is the single source of truth for student pipeline

Do not use `leads`, `contact_submissions` (for pipeline), or `student_cases` for pipeline data. Those tables are dead. All pipeline data lives in `public.cases`.

---

### Foreign key discipline

Every `case_id` reference must be `REFERENCES public.cases(id) ON DELETE CASCADE`. Every `user_id` reference must be `REFERENCES auth.users(id) ON DELETE CASCADE` unless there is a specific reason to use `SET NULL` (which must be documented in a comment).

---

## SECTION 4 — SESSION BOUNDARIES

This overhaul is too large for one Lovable session. Each phase must be completed and verified before the next begins.

**At the end of every session, you must output:**

```
SESSION COMPLETE CHECKLIST:
✅/❌ Migration ran without errors
✅/❌ All new RLS policies tested (admin, team, student, partner)
✅/❌ AuthContext initializes correctly for each role
✅/❌ All new routes load without 404
✅/❌ No old route references remain in completed files
✅/❌ Both AR and EN translations added for all new strings
✅/❌ RTL layout verified
✅/❌ No TypeScript errors in modified files

INCOMPLETE ITEMS (carry to next session):
- [list anything not finished]

DO NOT START NEXT PHASE until all ✅ items are confirmed.

```

---

## SECTION 5 — COMMON MISTAKES TO AVOID

Based on the complexity of this project, these are the most likely failure points:


| Mistake                               | Why it happens                        | How to avoid                                                           |
| ------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| Creating a student signup page        | Feels natural to have one             | Re-read Section 1, Rule 2                                              |
| Forgetting RLS on a new table         | Easy to miss when writing many tables | Add `ENABLE ROW LEVEL SECURITY` immediately after every `CREATE TABLE` |
| Hardcoding Arabic or English strings  | Fast to write, easy to forget         | Always use `t('key')` from i18n                                        |
| Using `margin-left` instead of `ms-`  | LTR habits                            | Use Tailwind start/end utilities                                       |
| Dropping a table before updating code | Migration runs, app crashes           | Update code first, then drop                                           |
| Using client-side insert for `/apply` | Simpler in the moment                 | Must use `create-case-from-apply` edge function                        |
| Skipping `must_change_password: true` | Default is false                      | Always set explicitly on account creation                              |
| Reading `user_roles` directly         | Bypasses the RPC abstraction          | Always use `get_my_role()`                                             |
| Mixing old case statuses with new     | Old enums still in codebase           | Delete `caseStatus.ts` and `caseTransitions.ts` at start of Phase 1    |
| Leaving `last_activity_at` stale      | Only updating related tables          | Always touch `cases.updated_at` when a case event occurs               |


## Phase 1 — Foundation (blocks everything else)

### 1a. Database Migration

Single file: `supabase/migrations/20260305000001_overhaul_v2.sql`

**Drops:** old `app_role` enum (cascades to `user_roles`), old `cases` table if exists  
**Creates:**

- New `app_role` enum: `admin | team_member | social_media_partner | student`
- `user_roles` (rebuilt)
- `platform_settings` (partner commission rate, forgotten thresholds)
- `programs` (language schools, universities — replaces majors/master_services)
- `accommodations`
- `cases` (replaces leads + student_cases — unified pipeline table)
- `case_submissions` (profile completion + fees)
- `appointments` (rebuilt with outcome tracking)
- `visa_applications`
- `important_contacts`
- `referrals` (rebuilt — simpler)
- `activity_log`
- Alters `profiles` (add case_id, nationality, DOB, passport fields, biometric_photo_url)
- Alters `documents` (add case_id, uploaded_by, is_visible_to_student)
- Alters `notifications` (rebuild with title_ar/title_en, case_id)
- All RLS policies
- All trigger functions: `update_case_activity`, `notify_student_profile_update`
- RPCs: `has_role`, `get_my_role`, `get_forgotten_cases`
- `TRUNCATE` old data: cases, appointments, activity_log, notifications

**Preserved (untouched):** `profiles`, `documents`, `push_subscriptions`, `admin_audit_log`, `eligibility_thresholds`, `checklist_items`, `student_checklist`, `commission_tiers`

### 1b. AuthContext

New file `src/contexts/AuthContext.tsx`:

- Roles: `admin | team_member | social_media_partner | student`
- Uses `get_my_role()` RPC (SECURITY DEFINER)
- `mustChangePassword` from `profiles.must_change_password`
- 5s initialization timeout
- `ROLE_TO_PATH` map for redirect on login

### 1c. Routing

Update `src/App.tsx`:

- Remove: `/lawyer-dashboard`, `/team-dashboard`, `/influencer-dashboard`, `/partnership`
- Add: `/admin/*`, `/team/*`, `/partner/*`, `/student/*` (25 new routes)
- Keep: `/`, `/apply`, `/student-auth`, `/reset-password`, all public pages

### 1d. DashboardLayout

New `src/components/layout/DashboardLayout.tsx`:

- Collapsible sidebar (w-14 collapsed / w-60 expanded) using shadcn Sidebar
- Role-based navConfig
- NotificationBell
- Language switcher
- RTL-aware

### 1e. ProtectedRoute

New `src/components/auth/ProtectedRoute.tsx`:

- Checks: initialized → user → mustChangePassword → allowedRoles
- Admin: wraps with AdminSecurityGate

---

## Phase 2 — Admin Dashboard (9 pages)


| Route                | Component            | Key Content                                                            |
| -------------------- | -------------------- | ---------------------------------------------------------------------- |
| `/admin`             | AdminCommandCenter   | KPI tiles, recent activity, forgotten cases alert                      |
| `/admin/pipeline`    | AdminPipeline        | Kanban columns by status, drag/click to advance, filter by team member |
| `/admin/team`        | AdminTeamPage        | List + Create Team Member (calls `create-team-member` edge fn)         |
| `/admin/programs`    | AdminProgramsPage    | Programs + Accommodations tabs, full CRUD                              |
| `/admin/submissions` | AdminSubmissionsPage | Submitted cases, "Mark Enrolled" button                                |
| `/admin/financials`  | AdminFinancialsPage  | Revenue breakdown, partner commission, referral discounts              |
| `/admin/analytics`   | AdminAnalyticsPage   | Funnel chart, avg time per stage, source breakdown                     |
| `/admin/activity`    | AdminActivityPage    | Real-time activity_log feed                                            |
| `/admin/settings`    | AdminSettingsPage    | Commission rate, forgotten thresholds, important contacts CRUD         |


---

## Phase 3 — Team Dashboard (11 pages/components)


| Route                      | Component               | Key Content                                                      |
| -------------------------- | ----------------------- | ---------------------------------------------------------------- |
| `/team`                    | TeamToday               | Today's appointments, case counts by status                      |
| `/team/cases`              | TeamCases               | Tabs: My Cases / Unassigned / All; forgotten cases highlighted   |
| `/team/cases/:id`          | CaseDetail              | Full workflow — stage-specific action buttons, history log       |
| —                          | AppointmentScheduler    | Modal: pick date/time, notes                                     |
| —                          | AppointmentOutcomeModal | 5 outcomes with routing logic per GAP 1                          |
| —                          | ProfileCompletionForm   | Program/accommodation dropdowns, extra fields                    |
| —                          | PaymentConfirmationForm | Fee fields + "Payment Received" checkbox                         |
| `/team/appointments`       | TeamAppointments        | Calendar + list toggle, red for past-no-outcome                  |
| `/team/appointments/today` | TodayAppointments       | Today only, outcome buttons                                      |
| `/team/submit`             | SubmitNewStudent        | Full form, bypasses pipeline, creates case + student immediately |
| `/team/students`           | TeamStudents            | Submitted/Enrolled tabs                                          |
| `/team/students/:id`       | TeamStudentProfile      | Full view + visa section + documents                             |
| `/team/analytics`          | TeamAnalytics           | Personal KPIs, charts                                            |


---

## Phase 4 — Edge Functions


| Function                     | Action | Change                                                          |
| ---------------------------- | ------ | --------------------------------------------------------------- |
| `create-team-member`         | Update | Use new `team_member` role, new schema                          |
| `admin-mark-paid`            | Update | Sets `enrollment_paid_at` on `case_submissions`                 |
| `create-student-from-case`   | New    | Creates auth user, links to case, sends invite or temp password |
| `record-appointment-outcome` | New    | Handles 5 outcomes, updates case status                         |
| `create-case-from-apply`     | New    | Replaces client insert on /apply; creates case + logs activity  |
| `log-activity`               | New    | Inserts to `activity_log`                                       |
| `lead-sla-check`             | Delete | —                                                               |
| `admin-early-release`        | Delete | —                                                               |
| `admin-weekly-digest`        | Delete | —                                                               |
| `seed-majors`                | Delete | —                                                               |
| `create-influencer`          | Delete | —                                                               |


---

## Phase 5 — Student & Partner Dashboards

**Student** (6 pages under `/student/*`):
`/student/checklist` (index) → `/student/profile` → `/student/documents` → `/student/visa` → `/student/refer` → `/student/contacts`

**Partner** (4 pages under `/partner/*`):
`/partner` (overview) → `/partner/link` → `/partner/students` → `/partner/earnings`

---

## Phase 6 — Cleanup & i18n

**Files to delete:**

```
src/pages/InfluencerDashboardPage.tsx
src/pages/TeamDashboardPage.tsx
src/components/influencer/ (all)
src/components/lawyer/ (all)
src/components/partnership/ (all)
src/components/admin/EligibilityConfig.tsx
src/components/admin/MasterServicesManagement.tsx
src/lib/caseStatus.ts → replace
src/lib/caseTransitions.ts → replace
```

**i18n:** Add all new keys to both `public/locales/ar/dashboard.json` and `public/locales/en/dashboard.json` — case statuses, appointment outcomes, partner/student strings.

---

## Implementation Order

```text
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
Each phase is blocked by the previous.
Phase 1 must complete before ANY dashboard work starts.
```

---

## Critical Constraints (preserved from requirements)

- `/apply` public form — untouched, only add `partner_id` + `source` tracking via new `create-case-from-apply` edge function
- Student accounts — NEVER self-created; always via `create-student-from-case`
- 2FA gate — admin only, via existing `AdminSecurityGate.tsx`
- Realtime subscriptions — `cases`, `notifications`, `activity_log`
- PWA infrastructure — keep as-is
- Forgotten cases — run via `get_forgotten_cases()` RPC on page load + 5-min interval check for appointment outcomes
- All currency defaults to ILS

---

## File Count Estimate


| Phase     | New Files                                               | Deleted Files         | Modified Files        |
| --------- | ------------------------------------------------------- | --------------------- | --------------------- |
| 1         | 5 (migration, AuthContext, App, Layout, ProtectedRoute) | 0                     | 2 (App.tsx, main.tsx) |
| 2         | 9 page components                                       | 5 old admin files     | 0                     |
| 3         | 13 page/modal components                                | 3 old team files      | 0                     |
| 4         | 4 edge functions                                        | 5 edge functions      | 2 edge functions      |
| 5         | 10 page components                                      | 2 old dashboard pages | 0                     |
| 6         | 0                                                       | 10+ old components    | 4 i18n files          |
| **Total** | **~41**                                                 | **~25**               | **~8**                |


This is a multi-session implementation. Each phase will be executed as a separate Lovable session to avoid context overflow.