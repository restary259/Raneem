
## Issues Found in Phase 1 & 2

### CRITICAL — Login page uses old roles, breaks redirect
`StudentAuthPage.tsx` (lines 54-65) still uses OLD role names:
- `'lawyer'` → should be `'team_member'`
- `'influencer'` → should be `'social_media_partner'`
- Redirects to `/team-dashboard`, `/influencer-dashboard` → now legacy redirects
- Also calls `user_roles` directly instead of using `get_my_role()` RPC (violates rules)
- Also silently creates a `'user'` role if no role found — but `'user'` is not in the new `app_role` enum (will crash DB insert)

**Fix**: Rewrite `redirectByRole` to use `get_my_role()` RPC and `ROLE_TO_PATH` from AuthContext. Remove the `'user'` role creation. Remove `'lawyer'`/`'influencer'` checks.

### CRITICAL — `create-team-member` edge function uses old roles
Line 83: `if (!["influencer", "lawyer"].includes(role))` — rejects valid roles `team_member` and `social_media_partner`.

**Fix**: Update validation to accept `['team_member', 'social_media_partner']`.

### MINOR — Login page still shows signup tab (students can't self-register)
Per overhaul rules: students are NEVER self-created. The signup tab in `StudentAuthPage` must be REMOVED entirely. The page should be login-only.

### VERIFIED WORKING ✅
- `AuthContext.tsx` — correct 4-role enum, `get_my_role()` RPC, 6s safety timer
- `ProtectedRoute.tsx` — correct check order with AdminSecurityGate for admin only
- `DashboardLayout.tsx` — collapsible sidebar, RTL-aware, all nav keys present
- `App.tsx` — correct route structure for all 4 role trees
- `nav.*` keys — present in both EN and AR dashboard.json (verified at line 1228)
- `case.status.*` keys — present (line 1253)
- All 9 admin pages — created and wired in routes
- Database schema — all new tables confirmed in schema (cases, appointments, case_submissions, programs, accommodations, platform_settings, important_contacts, referrals, activity_log, visa_applications)

---

## Phase 3 — Team Dashboard Plan

### Files to create (11 new files):

**1. `src/pages/team/TeamTodayPage.tsx`**
- Today's appointments count + list (from `appointments` WHERE `team_member_id = user.id` AND `date(scheduled_at) = today`)
- Case counts by status (`cases` WHERE `assigned_to = user.id`)
- Quick action buttons: "Create New Case" (modal), "Submit New Student" (link to /team/submit)

**2. `src/pages/team/TeamCasesPage.tsx`**
- Tabs: My Cases | Unassigned (assigned_to IS NULL) | All
- Within each tab: filter by status chips (New, Contacted, Appointment, Profile, Payment, Submitted)
- Forgotten cases tab — calls `get_forgotten_cases()` RPC, highlighted red
- "Create New Case" modal: name + phone → inserts into `cases` with `source:'manual'`, `assigned_to: user.id`
- Each case card → navigates to `/team/cases/:id`

**3. `src/pages/team/CaseDetailPage.tsx`** (most complex)
- Fetches case + case_submission + appointments from DB
- Shows current status + stage-specific action block prominently at top
- Stage actions:
  - `new`: "Mark as Contacted" → `status = 'contacted'`
  - `contacted`: "Schedule Appointment" → opens AppointmentSchedulerModal
  - `appointment_scheduled`: shows appointment info + "Record Outcome" → opens AppointmentOutcomeModal  
  - `profile_completion`: ProfileCompletionForm (program dropdown, accommodation dropdown, dates, student name/phone/email fill)
  - `payment_confirmed`: PaymentConfirmationForm (service_fee + translation_fee + checkbox)
  - `submitted`: read-only summary, waiting for admin
- Case history log (all status changes + timestamps — stored in `activity_log`)
- Documents section (list + upload to `student-documents` bucket)

**4. `src/components/team/AppointmentSchedulerModal.tsx`**
- Date/time picker, duration, notes
- Inserts into `appointments` (case_id, team_member_id = user.id, scheduled_at, notes)
- Updates case status → `appointment_scheduled`
- Calls `log-activity` via Supabase RPC `log_activity()`

**5. `src/components/team/AppointmentOutcomeModal.tsx`**
- 5 radio options: Completed, Delayed, Cancelled, Rescheduled, No Show
- Extra field for new date (Delayed/Rescheduled)
- On submit → calls `record-appointment-outcome` edge function
- Outcome routing:
  - completed → case `status = 'profile_completion'`
  - delayed → stay `appointment_scheduled`, new appointment required
  - cancelled → `status = 'contacted'`
  - rescheduled → new appointment row, link `rescheduled_to`
  - no_show → `status = 'forgotten'`, `is_no_show = true`

**6. `src/components/team/ProfileCompletionForm.tsx`**
- Program dropdown (from `programs` table, active only)
- Accommodation dropdown (from `accommodations` table)
- Date pickers: program_start_date, program_end_date
- Student info fields: name, phone, email (updates `profiles` if student_user_id exists)
- Saves to `case_submissions` (upsert on case_id)
- On save → case status → `payment_confirmed` if form complete

Wait — per the spec: profile_completion → payment_confirmed requires a SEPARATE payment confirmation step. So ProfileCompletionForm just fills the data and the status stays `profile_completion`. A separate "Confirm Payment" button advances to `payment_confirmed`.

**7. `src/components/team/PaymentConfirmationForm.tsx`**
- Service fee input (ILS)
- Translation fee input (ILS)
- Total calculated automatically
- "Payment Received" mandatory checkbox
- On submit → updates `case_submissions.payment_confirmed = true`, `payment_confirmed_at`, `payment_confirmed_by`
- Case status → `submitted`
- Calls `create-student-from-case` edge function to create student account
- Calls `log_activity()`

**8. `src/pages/team/TeamAppointmentsPage.tsx`**
- List view of all appointments for this team member
- Group: Today (green), Upcoming (blue), Past with no outcome (red — needs action)
- "Record Outcome" button on past appointments with no outcome
- Realtime subscription on `appointments`

**9. `src/pages/team/TodayAppointmentsPage.tsx`**
- Filtered view: only today's appointments
- Simple list with student name, time, notes
- "Record Outcome" button on each

**10. `src/pages/team/SubmitNewStudentPage.tsx`**
- Full form: name, phone, email, all profile fields, program (dropdown), accommodation (dropdown), dates
- Service fee + translation fee fields
- "Payment Received" mandatory checkbox
- On submit:
  1. Insert `cases` with `source:'submit_new_student'`, `status:'enrollment_paid'`, `assigned_to: user.id`
  2. Insert `case_submissions` with all fee data, `payment_confirmed:true`, `submitted_at:now()`
  3. Call `create-student-from-case` to create student account
  4. Call `log_activity()`

**11. `src/pages/team/TeamStudentsPage.tsx`** + **`TeamStudentProfilePage.tsx`**
- Tabs: Submitted | Enrolled
- Query `cases` WHERE `assigned_to = user.id` AND `status IN ('submitted', 'enrollment_paid')`
- Profile page: full view of student info, visa section, documents

**12. `src/pages/team/TeamAnalyticsPage.tsx`**
- Personal KPIs: cases closed this month, avg days to close, today's appointment count
- Bar chart: cases by status

### New edge function:
**`record-appointment-outcome`** — handles 5 outcomes, atomically updates appointment + case status + logs activity

**`create-student-from-case`** — creates Supabase auth user for student, sets `must_change_password:true`, links to case, sends welcome email

### i18n additions:
Add `team.*` keys to both EN and AR `dashboard.json`:
```
team.today.title, team.cases.title, team.cases.myTab, team.cases.unassignedTab, 
team.cases.allTab, team.cases.forgottenTab, team.case.detail.*, 
team.appointments.*, team.submit.*, team.students.*
```

### App.tsx update:
Replace all `TeamPlaceholderPage` with actual page components in the `/team/*` routes.

### Appointment outcome auto-popup:
In `TeamTodayPage` and `TeamAppointmentsPage`, run a check on load + every 5 minutes: if any past appointments have no outcome, show a banner/badge prompting the team member to record outcomes.

---

## Fixes to implement first (before Phase 3):

1. **`StudentAuthPage.tsx`**: Remove signup tab entirely. Fix `redirectByRole` to use `get_my_role()` RPC + `ROLE_TO_PATH`. Remove broken `'user'` role creation.

2. **`create-team-member` edge function**: Change role validation from `['influencer', 'lawyer']` to `['team_member', 'social_media_partner']`.

---

## File Summary

| File | Action |
|---|---|
| `src/pages/StudentAuthPage.tsx` | Fix: remove signup, fix redirectByRole |
| `supabase/functions/create-team-member/index.ts` | Fix: update role validation |
| `src/pages/team/TeamTodayPage.tsx` | New |
| `src/pages/team/TeamCasesPage.tsx` | New |
| `src/pages/team/CaseDetailPage.tsx` | New (largest) |
| `src/components/team/AppointmentSchedulerModal.tsx` | New |
| `src/components/team/AppointmentOutcomeModal.tsx` | New |
| `src/components/team/ProfileCompletionForm.tsx` | New |
| `src/components/team/PaymentConfirmationForm.tsx` | New |
| `src/pages/team/TeamAppointmentsPage.tsx` | New |
| `src/pages/team/TodayAppointmentsPage.tsx` | New |
| `src/pages/team/SubmitNewStudentPage.tsx` | New |
| `src/pages/team/TeamStudentsPage.tsx` | New |
| `src/pages/team/TeamStudentProfilePage.tsx` | New |
| `src/pages/team/TeamAnalyticsPage.tsx` | New |
| `supabase/functions/record-appointment-outcome/index.ts` | New |
| `supabase/functions/create-student-from-case/index.ts` | New |
| `src/App.tsx` | Update team routes |
| `public/locales/en/dashboard.json` | Add team.* keys |
| `public/locales/ar/dashboard.json` | Add team.* keys |
