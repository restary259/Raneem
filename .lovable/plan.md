
## Student Account System — Fully Independent from Cases

### What the User Wants
1. Student accounts = completely standalone (no case linkage)
2. Team creates accounts with just email + name → temp password shown immediately
3. Students self-manage their dashboard (profile, documents)
4. Admin has a "Students" section showing all accounts + profile + documents
5. Force password change on first login

### Current State Problems
- `create-student-from-case` edge function: requires `case_id`, links `student_user_id` to case
- `TeamStudentsPage.tsx`: modal requires selecting a case
- `AdminStudentsPage.tsx`: shows student accounts tied to cases, navigates to case detail
- The entire "Create Student Account" flow is tightly coupled to cases

### Architecture Decision
The `cases` table has `student_user_id`. We keep this column (don't break existing data) but make it **optional** — student accounts can exist without a case. The new "Create Student Account" flow skips case linking entirely.

### New Edge Function: `create-student-standalone`
Replace the case-dependent flow with a new edge function:
- Input: `email`, `full_name` (optional)
- Always creates with temp password (never invite flow)
- Sets `must_change_password: true`
- Assigns `student` role
- Creates profile
- Returns `{ temp_password, email, user_id }`
- No case reference at all

### Files to Change

**1. `supabase/functions/create-student-standalone/index.ts`** (NEW)
- Accept: `{ email, full_name? }`
- Validate: team_member or admin only
- Check: email not already registered
- Generate secure temp password (12 chars, mixed)
- Create auth user with `email_confirm: true`, `must_change_password: true` in metadata
- Assign `student` role in `user_roles`
- Create profile with `must_change_password: true`
- Return `{ success, user_id, email, temp_password, full_name }`

**2. `src/pages/team/TeamStudentsPage.tsx`** — Full rewrite of create modal:
- Remove all case-dependency logic (`eligibleCases`, `selectedCaseId`, `filteredCases`, `emailFilter`)
- New modal: just `email` input + `full_name` input
- Call `create-student-standalone` edge function
- Show temp password popup immediately with:
  - Student email
  - Temp password
  - "Copy Password" button
  - "Copy Email + Password" button  
  - "Close" button
- The student list at top: now shows ALL student accounts (not just cases in certain statuses). Query: `user_roles` where `role = 'student'` → then `profiles` by those IDs. Independent of cases.

**3. `src/pages/admin/AdminStudentsPage.tsx`** — Rewrite:
- Show all student accounts from `user_roles + profiles` (no case join needed)
- When clicking a student → open a detail `Sheet` showing:
  - Profile info (name, email, phone, created_at)
  - Documents uploaded by that student (query `documents` where `student_id = user_id`)
  - "Reset Password" action (calls edge function or generates new temp password)
- Remove the "navigate to case" behavior entirely
- Remove the status filter (students have no case status)

**4. `supabase/functions/reset-student-password/index.ts`** (NEW - small utility)
- Admin only
- Input: `{ user_id }`
- Generates new temp password
- Sets `must_change_password: true` in profile
- Returns `{ temp_password }`

### No DB migration needed
- `cases.student_user_id` column already nullable — keep it as-is
- `documents.student_id` already exists
- `user_roles` + `profiles` already exist

### Summary Table
| File | Change |
|------|--------|
| `supabase/functions/create-student-standalone/index.ts` | NEW: case-free account creation |
| `supabase/functions/reset-student-password/index.ts` | NEW: admin password reset |
| `src/pages/team/TeamStudentsPage.tsx` | Remove case dependency, new modal, show all students |
| `src/pages/admin/AdminStudentsPage.tsx` | Show profiles+docs, remove case navigation |
