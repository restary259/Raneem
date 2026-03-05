
## Analysis Summary

**8 tasks to implement across multiple files:**

1. **Data Purge** — Delete all cases, case_submissions, appointments, payments, documents, commissions, rewards, payout_requests. Keep all profiles and user_roles. Done via `AdminSettingsPage.tsx` existing reset flow (currently it deletes profiles/roles too — need to adjust it to KEEP accounts).

2. **Student visibility on creation** — `AdminStudentsPage.tsx` already shows all students via `user_roles + profiles`. Issue: team creates via `create-student-standalone` which works. Admin just needs to be able to refresh or auto-refresh after creation. Currently only admin sees the list — no issue to fix here structurally.

3. **Team member permissions** — `TeamStudentsPage.tsx` currently shows ALL students (same list as admin). Need to restrict so team members only see students THEY created. The `profiles` table doesn't have a `created_by` field. We need to track `created_by` in the edge function and store it in the profile. Currently `create-student-standalone` doesn't record who created the student. Plan: add `created_by` field to the profile insert in the edge function, then `TeamStudentsPage` filters by `created_by = user.id`.

4. **Remove "Preferred Subject"** — In `SubmitNewStudentPage.tsx` lines ~420-439, remove the entire "Preferred Subjects" chips section + remove the `PREFERRED_SUBJECTS` const + `preferredSubjects` state + `toggleSubject` function + remove from `extra_data` on submit.

5. **Custom document name for "Other"** — In `DocumentsManager.tsx`, when `category === 'other'`, show an additional text input for custom name. Store this custom name in the `file_name` field (or use `notes` field). Actually best approach: when `category === 'other'`, show a `customDocName` input and use that as `file_name` when saving.

6. **Student profile: phone, city of birth, emergency contact, arrival date** — In `StudentProfile.tsx`, currently phone/city are read-only (agency managed). Per the new requirement, students should be able to edit: `phone_number`, `city_of_birth` (new field — not in current profile, would need to use `city` or we need to clarify), `emergency_contact` (not in profiles table currently), `arrival_date` (currently admin-only). 
   - Looking at the profiles table: columns include `city` (could serve as city of birth), `phone_number`. 
   - For emergency contact: no column exists in `profiles`. We can store it in `notes` or add it to the update payload using an existing jsonb field. Best: use the `notes` field for emergency contact OR we need a DB migration.
   - For `arrival_date`: the profiles table has this field — it's currently "Set by admin" read-only.
   - Decision: Add `emergency_contact` and `city_of_birth` fields. Since `profiles` doesn't have these, we'll use existing `city` for city-of-birth (rename label in student context), and we can add an `emergency_contact` column via DB migration OR store in a new field. Since we want to keep it simple: add a DB migration to add `emergency_contact text` to profiles.

7. **Back to Main Website button** — DashboardLayout.tsx already has a DARB link to `/`. Need to add a proper "Back to Website" button in the header. For Student (DashboardLayout): add a home icon button. For Admin (AdminLayout): already has "Return to Site". For Team (DashboardLayout): same layout, add button.

8. **System stability** — no changes needed.

## Files to Change

### DB Migration
Add `emergency_contact` column to `profiles` table.

### `src/pages/admin/AdminSettingsPage.tsx`
Fix the data reset to KEEP user accounts — only delete operational data:
- DELETE from `documents`
- DELETE from `appointments`  
- DELETE from `case_submissions`
- DELETE from `cases`
- DELETE from `payments`
- DELETE from `rewards`
- DELETE from `commissions`
- DELETE from `payout_requests`
- Keep `profiles` and `user_roles` intact

### `supabase/functions/create-student-standalone/index.ts`
Add `created_by` to the profile insert so team can filter their own students.

### `src/pages/team/TeamStudentsPage.tsx`
Filter student list to show only students where `created_by = user.id` (team-created).
Remove all action buttons except basic view (no documents, no profile editing).

### `src/pages/team/SubmitNewStudentPage.tsx`
Remove: `PREFERRED_SUBJECTS` array, `preferredSubjects` state, `toggleSubject` function, the "Preferred Subjects" chips UI block (lines ~420-439), `preferred_subjects` from `extra_data`.

### `src/components/dashboard/DocumentsManager.tsx`
When `category === 'other'`: show a `customDocName` input field.
Use the custom name as the document's display label (stored in `file_name` with the custom name).

### `src/components/dashboard/StudentProfile.tsx`
Make editable:
- `phone_number` — remove from read-only, add to `handleSave` update
- `city` (relabeled as "City of Birth") — make editable
- `emergency_contact` (new field) — editable input
- `arrival_date` — make editable (not admin-only)

### `src/components/layout/DashboardLayout.tsx`
Add a "Back to Website" button in the header (navigate to `/`).

## Summary Table

| File | Change |
|------|--------|
| DB migration | Add `emergency_contact` to `profiles` |
| `AdminSettingsPage.tsx` | Fix reset: keep accounts, delete only operational data |
| `create-student-standalone/index.ts` | Store `created_by` in profile |
| `TeamStudentsPage.tsx` | Filter to own students, remove doc/edit actions |
| `SubmitNewStudentPage.tsx` | Remove Preferred Subjects |
| `DocumentsManager.tsx` | Custom name input for "other" category |
| `StudentProfile.tsx` | Make phone/city/emergency/arrival editable |
| `DashboardLayout.tsx` | Add "Back to Website" button in header |
