
## Analysis Summary

From the screenshots and code review:

1. **Admin Team page** — Already shows name/email correctly. The `/admin/analytics` page has layout issues with the pie chart label rendering (text overflow on Arabic labels in the horizontal bar chart - `YAxis width={80}` is too narrow).

2. **Case visibility** — `TeamCasesPage` has an "Unassigned" tab that team members shouldn't see (per spec, only Admin assigns apply/contact cases). The pipeline correctly shows `assigned_to` but team members can see all cases via "All" tab.

3. **Submit New Student** — Only has 3 fields (name, phone, email). Needs full multi-section redesign with ~20 fields across 3 sections.

4. **Appointments** — Current page shows list view only. No calendar. Today's view at `/team/appointments/today` shows the same static data. Need to swap: Appointments = calendar, Today = live feed.

5. **Influencer dashboard** — Has "my-link" tab that should be removed per spec. Cases should show pipeline stage synced with Admin.

6. **Submissions page** — Only shows `status='submitted'` from `cases` table — seems correct but currently only shows cases submitted via the Submit New Student flow, not from the pipeline.

---

## Plan — Prioritized Changes

### 1. Fix Analytics Page Rendering (`AdminAnalyticsPage.tsx`)
- Increase `YAxis width` from 80 to 120 for Arabic labels  
- Add `tick={{ fontSize: 10, fill: 'currentColor' }}` with proper wrapping  
- Fix pie chart label to show only count, not overflowing name

### 2. Remove "Unassigned" tab from Team Dashboard (`TeamCasesPage.tsx`)
- Remove the `unassigned` TabTrigger and its fetch logic  
- Keep: My Cases, All, Forgotten

### 3. Fix Case Visibility — Apply/Contact cases only in Admin until assigned
The `cases` table has `assigned_to`. Team members query with `tab=mine` → `eq('assigned_to', user.id)`. The "All" tab shows everything — that's correct for team. The issue is the Apply/Contact cases appear in "All" tab before assignment.  
**Fix**: The "All" tab in TeamCasesPage should only show cases where `assigned_to = user.id OR source = 'manual'` for that user. Unassigned apply/contact cases should NOT be visible to team members at all.

### 4. Submitted profiles appearing in Admin Submissions
Currently `AdminSubmissionsPage` queries `status='submitted'`. When team member completes a case profile and moves it to `profile_completion` stage, and then it gets to `payment_confirmed → submitted`, it would appear. The issue is the pipeline isn't moving correctly. The `SubmitNewStudentPage` directly creates with `status='enrollment_paid'` — this is a bypass flow, not the pipeline flow. The admin submissions page is for the pipeline flow. This seems to be working, but team members submitting via the direct form bypass the pipeline. **No code change needed** — the direct submit goes straight to `enrollment_paid`.

### 5. Appointments page — Calendar UI + Today feed
- Replace `TeamAppointmentsPage` with a calendar-style component using `react-day-picker` (already installed) or a simple week/month view built with CSS grid  
- Add create appointment modal that attaches to a case  
- `TeamTodayPage` (Today) becomes the chronological live feed  
- Add "New Appointment" button that opens modal with case selector + datetime picker

### 6. Submit New Student — Multi-section form redesign
Add sections:
- **Section A**: First name, last name, personal email, phone, emergency contact name/phone, city of birth, full address, DOB, age (auto), gender
- **Section B**: Program (from DB), school (free text or from programs), arrival date, course start/end, accommodation type, accommodation category, preferred subjects  
- **Section C**: Document uploads (passport, photo, other) — optional/skippable  
- On submit: creates case + `case_submissions` record + student account via edge function

### 7. Influencer Dashboard — Remove "my-link" tab, add case pipeline view
- Remove `my-link` tab from `TAB_CONFIG`  
- Change role check to accept `social_media_partner` (currently checks `influencer` role which is the legacy role — need to support both)  
- `students` tab: show cases with `partner_id = user.id` from `cases` table (synchronized stages)  
- Show commission per case from `platform_settings.partner_commission_rate`

### 8. Admin "Created Users" tab — New page
- Add `/admin/students` route (already exists as `AdminProgramsPage` link needs updating)  
- `AdminStudentManagement` already exists at `src/components/admin/StudentManagement.tsx` — verify it shows student accounts  
- Add navigation item in admin sidebar

---

## Files to Change

| File | Change |
|------|--------|
| `src/pages/admin/AdminAnalyticsPage.tsx` | Fix chart widths for Arabic/RTL |
| `src/pages/team/TeamCasesPage.tsx` | Remove "Unassigned" tab; restrict "All" to only show user's assigned cases |
| `src/pages/team/TeamAppointmentsPage.tsx` | Rebuild as calendar UI (week view + create modal) |
| `src/pages/team/TeamTodayPage.tsx` | Make Today page a live chronological appointments feed |
| `src/pages/team/SubmitNewStudentPage.tsx` | Full multi-section form redesign (sections A, B, C) |
| `src/pages/InfluencerDashboardPage.tsx` | Remove "my-link" tab; fix role check to accept `social_media_partner`; show cases from `cases` table |
| `src/pages/admin/AdminTeamPage.tsx` | Already shows name/email — no change needed |
| `src/components/layout/DashboardLayout.tsx` | Verify admin sidebar has Created Users link |
| `public/locales/en/dashboard.json` | Add missing keys for new features |
| `public/locales/ar/dashboard.json` | Mirror Arabic keys |

---

## Appointment Calendar Design

```text
┌──────────────────────────────────────────────────────┐
│  Appointments         [Week ▾]  [+ New Appointment]  │
├──────┬─────┬────┬─────┬─────┬─────┬────┬────────────┤
│ Time │ Mon │Tue │ Wed │ Thu │ Fri │Sat │    Sun     │
├──────┼─────┼────┼─────┼─────┼─────┼────┼────────────┤
│ 9am  │     │    │     │     │     │    │            │
│ 10am │[📋 A]│    │     │     │     │    │            │
│ 11am │     │    │     │[📋 B]│     │    │            │
│...   │     │    │     │     │     │    │            │
└──────┴─────┴────┴─────┴─────┴─────┴────┴────────────┘
```

Click on time slot → create appointment modal  
Click on existing appointment → view/edit/record outcome

---

## Submit New Student Form Sections

```text
Section A — Student Information
  First Name | Last Name
  Email (for account) | Phone
  Emergency Name | Emergency Phone
  City of Birth | Date of Birth | Age (auto)
  Gender

Section B — Program & Accommodation
  Program (dropdown from DB) | School
  Arrival Date | Course Start | Course End
  Accommodation Type | Accommodation Category
  Preferred Subjects (multi-select checkboxes)

Section C — Documents (skippable)
  [Upload Passport] [Upload Photo] [+ Add Document]
  ✓ Skip — student will upload later

[Submit & Create Student Account]
```

---

## Influencer Dashboard Fix

- Role check: accept both `social_media_partner` AND `influencer` (legacy) from `user_roles`  
- Query `cases` table with `partner_id = user.id` for the students/cases view  
- Remove `my-link` tab  
- Commission display: fetch `platform_settings.partner_commission_rate` × qualifying cases  
- Each case row shows: student name, phone, status (synced to `cases.status`), commission amount
