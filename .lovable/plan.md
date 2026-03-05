
## Issues Identified

From the screenshots and code review:

1. **`/admin/students` → 404**: The route is in `DashboardLayout.tsx` nav config as `/admin/students` but there's **no route** defined in `App.tsx` for `admin/students`. Need to create `AdminStudentsPage.tsx` and register the route.

2. **Pipeline assign dropdown — no email shown**: `AdminPipelinePage.tsx` line 203 only shows `{tm.full_name}`. The `teamMembers` state only stores `{ id, full_name }` — missing `email`. Need to add `email` to the `TeamMember` interface and fetch it, then show `name (email)` in the select options.

3. **Mobile bottom nav — replace "Team" tab with "Students (ready to apply)"**: In `MobileBottomNav.tsx`, admin mobile nav has `{ key: 'nav.team', icon: Users, href: '/admin/team' }`. Replace with `{ key: 'nav.students', icon: GraduationCap, href: '/admin/students' }`.

4. **Team dashboard changes from previous plan didn't take effect**: Looking at the files — the changes ARE present (`TeamTodayPage.tsx`, `TeamCasesPage.tsx` are the new i18n-aware versions). The confusion is that `TeamStudentsPage` still has hardcoded English. Also the `Students` page in the team shows `submitted`/`enrolled` cases — user wants "ready to apply" students instead.

5. **Team `Students` tab should show "ready to apply" students**: Currently shows `submitted` and `enrollment_paid` statuses. Should show students in pipeline stages that indicate they're ready/in-progress — per spec this is cases with `payment_confirmed` or `profile_completion` status (students ready to apply for university).

## Files to Change

### 1. Create `src/pages/admin/AdminStudentsPage.tsx` (NEW)
A new page listing all student accounts (users with `student` role) created by team members. Shows: name, email, case status, creation date. Clicking opens the case/profile. Fetches from `profiles` + `user_roles` (role=student) + joins to `cases` via `student_user_id`.

### 2. Register route in `src/App.tsx`
Add `<Route path="students" element={<AdminStudentsPage />} />` inside the admin routes block (after line 180).

### 3. `src/pages/admin/AdminPipelinePage.tsx`
- Add `email` to `TeamMember` interface
- Update `fetchData` to also select `email` from profiles
- Update `Select` options to show `{tm.full_name} — {tm.email}` for better identification
- Same in the filter dropdown at the top

### 4. `src/components/layout/MobileBottomNav.tsx`
- Admin mobile nav: replace the `nav.team` item with `nav.students` linking to `/admin/students`
- Change the icon from `Users` to `GraduationCap`

### 5. `src/pages/team/TeamStudentsPage.tsx`
- Rename tabs to show "Ready to Apply" (cases with `profile_completion`/`payment_confirmed`) and "Enrolled" (`enrollment_paid`)
- Add i18n for all hardcoded English strings
- Show meaningful info (status badge, last activity)

### 6. `public/locales/en/dashboard.json` + `public/locales/ar/dashboard.json`
- Add `nav.students` key (if missing at top-level nav section)
- Ensure all keys used in TeamStudentsPage are present

## Execution Order

```
1. Create AdminStudentsPage (new file)
2. Register /admin/students route in App.tsx  
3. Fix AdminPipelinePage — add email to team member display in assign dropdown
4. Fix MobileBottomNav — swap admin "Team" tab with "Students"
5. Update TeamStudentsPage — fix tabs + i18n
6. Add missing translation keys
```

## AdminStudentsPage Design

```
Students Created by Team
[Search...] [Filter by status ▾]  [Refresh]

┌──────────────────────────────────────────────────────┐
│  Name              | Email          | Status  | Date  │
├──────────────────────────────────────────────────────┤
│  Ahmed Mohamed     | a@email.com    | Active  | 5 Mar │
│  Sara Ali          | s@email.com    | Pending | 4 Mar │
└──────────────────────────────────────────────────────┘
```

Fetches: `profiles` WHERE id IN (users with `student` role), joined to `cases.student_user_id` for status.

## Pipeline Assign Dropdown Fix

```typescript
// Current (broken — no email):
<SelectItem key={tm.id} value={tm.id}>{tm.full_name}</SelectItem>

// Fixed — shows name + email:
<SelectItem key={tm.id} value={tm.id}>
  {tm.full_name} — {tm.email}
</SelectItem>
```

The `TeamMember` interface and `profilesRes` select query need `email` added.

## Mobile Nav Change (Admin)

```typescript
// Remove:
{ key: 'nav.team', icon: Users, href: '/admin/team' }

// Add:
{ key: 'nav.students', icon: GraduationCap, href: '/admin/students' }
```

## Team Students Page Fix

Change tab from `submitted`/`enrolled` to `profile_completion`+`payment_confirmed` (ready to apply) and `enrollment_paid` (enrolled). Add i18n and proper bilingual labels.
