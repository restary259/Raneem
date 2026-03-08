
## Full Analysis

### What currently works ✅
- Student detail sheet opens, shows profile info, documents list with download, visa fields, referral count
- Document upload by admin works
- Selective Delete dialog UI exists and calls `selective-delete` edge function
- Reset password works

### What's broken or missing 🔴

**1. Edit form only saves 5 fields, but shows 14 fields in view mode**
- View mode shows: email, phone, city, emergency_contact, arrival_date, gender, date_of_birth, nationality, country, university_name, intake_month, last_updated, created, created_by
- Edit form only has inputs for: full_name, phone_number, city, emergency_contact, arrival_date
- Missing editable fields: **gender, date_of_birth, nationality, country (address), university_name, intake_month, notes**
- Also `profiles` has more fields: `passport_number`, `passport_expiry`, `emergency_contact_name`, `emergency_contact_phone` — these should be shown/editable too

**2. Selective Delete — `deletion_logs` table exists but `selective-delete` edge function writes to it using `cases` table, while the actual student pipeline uses the `cases` table (confirmed). The real issue: the edge function uses `cases` table correctly. BUT the password verification for hard-delete uses `supabaseAuth.auth.signInWithPassword()` with the admin's email — this requires the admin's actual auth password, which IS correct per the user's request. However, the soft delete also tries to delete `case_submissions` which may not exist. Need to verify the `case_submissions` table.**

**3. Real-time sync — when student uploads a document or updates profile while admin has the sheet open, the admin panel doesn't refresh.** The sheet fetches data once on open. Need to add a Supabase Realtime subscription inside the sheet so it auto-refreshes when `documents` or `profiles` change for the selected student.

**4. `fetchStudents` filters `.not("created_by", "is", null)` AND `.is("case_id", null)` — this means students who self-registered (no `created_by`) OR have a `case_id` are INVISIBLE in admin Students page.** The user says they can see "student test 01" so at least one student shows. But any self-registered students or students linked to cases won't appear. Should remove these filters or make them optional.

**5. Visa fields display but are hardcoded as `label_en`/`label_ar` text inputs — select fields with `options_json` don't render as `<select>` dropdowns.** The `field_type` can be `text`, `date`, `select`, `boolean` but only text/boolean is handled; select and date use the text input fallback.

### Plan: 5 targeted fixes in `AdminStudentsPage.tsx`

#### Fix 1: Expand Edit Form — all profile fields editable
Add inputs for: gender (select), date_of_birth (date), nationality (text), country/address (text), university_name (text), intake_month (text), notes (textarea), passport_number (text), passport_expiry (date)

Update `editForm` initial state in `openStudent()` to include all these fields.
Update `handleSave()` to write all these fields to `profiles`.

#### Fix 2: Remove over-restrictive fetch filter
Remove `.not("created_by", "is", null)` and `.is("case_id", null)` from `fetchStudents` — show ALL users with `role = 'student'`. The admin should see every student account regardless of origin.

#### Fix 3: Fix visa field rendering — handle `select` and `date` types
In the visa fields render block, add cases for `field_type === "select"` (render `<select>` with `options_json`) and `field_type === "date"` (render `<Input type="date">`).

#### Fix 4: Real-time sync for open student sheet
Add a `useEffect` inside the sheet that subscribes to:
- `documents` table filtered by `student_id = selected.id` — on INSERT/DELETE, re-fetch docs
- `profiles` table filtered by `id = selected.id` — on UPDATE, re-fetch profile

This handles both admin-uploads and student self-uploads appearing live.

#### Fix 5: Selective Delete — verify edge function compatibility
The `selective-delete` edge function writes to `deletion_logs` ✅ and targets `cases` table (the unified table). It uses `student_user_id` column on `cases` — confirmed this column exists on `cases`. The password verification re-signs in with the admin's email+password which is the correct behavior per the user's request.

**One issue**: the edge function uses `cases` with `student_user_id` but it also references `case_submissions` table — need to check if that table exists. If not, that's a silent error. Will add a guard.

Also need to add `deletion_logs` RLS policy for admin inserts (the edge function uses service role key, so RLS is bypassed — this is fine already ✅).

The soft-delete for `contact_info` nulls out `phone_number`, `emergency_contact`, `city` and sets `deleted_at`. The `profiles` table has `deleted_at` column ✅.

**No edge function changes needed** — the selective-delete already correctly uses the admin's password for hard-delete verification.

### Files Changed
1. **`src/pages/admin/AdminStudentsPage.tsx`** — 5 fixes:
   - Remove restrictive fetch filters (show all students)
   - Expand `editForm` + `handleSave` to all profile fields
   - Expand edit UI to render all fields with appropriate input types
   - Add real-time subscriptions for docs + profile when sheet is open
   - Fix visa `select`/`date` field type rendering

No database migrations needed — all profile columns already exist. No edge function changes needed.

---

## Summary Table

| Issue | Root Cause | Fix |
|---|---|---|
| Edit only saves 5 fields | `editForm` state + `handleSave()` incomplete | Add all 9 missing fields to edit form |
| Self-registered students invisible | `.not("created_by", "is", null)` filter | Remove over-restrictive filter |
| Student uploads don't appear live for admin | No realtime subscription in sheet | Add Supabase Realtime for `documents` + `profiles` |
| Visa `select`/`date` fields broken | Only `boolean`/`text` handled | Add `select` and `date` cases to renderer |
| Selective Delete password unclear | Already correct — uses admin login password | No change needed, just verify works |

**1 file changed**: `src/pages/admin/AdminStudentsPage.tsx`
