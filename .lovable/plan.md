
## Full Audit: Issues Found

### Issue 1: Assign dropdown shows no team members (CRITICAL BUG)
**Root cause**: In `AdminPipelinePage.tsx` line 64-67, the `profilesRes` query uses an **inline await** inside the `.in()` call:
```typescript
supabase.from('profiles').select('id, full_name, email').in('id',
  (await supabase.from('user_roles').select('user_id').eq('role', 'team_member')).data?.map(...) || []
)
```
This nested `await` inside `Promise.all()` is unreliable — the inner await may resolve before the outer Promise.all catches it, returning an empty array. **Fix**: Split into sequential fetches: first get `user_roles`, then pass IDs to `profiles` query.

### Issue 2: Profile completion stage must match SubmitNewStudentPage fields
`ProfileCompletionForm.tsx` only captures: student name, phone, email, program, accommodation, start/end date.
But `SubmitNewStudentPage` captures **~20 fields**: first/middle/last name, emergency contact, full address, DOB, age, gender, city of birth, school, arrival date, accommodation type/category, preferred subjects.
**Fix**: Expand `ProfileCompletionForm` to include all Section A + B fields from `SubmitNewStudentPage`.

### Issue 3: Completed appointments should disappear from the list
In `CaseDetailPage.tsx`, appointments are fetched with no filter — all show including `outcome='completed'`. The spec says completed appointments should disappear.
**Fix**: In `CaseDetailPage`, filter appointments to only show those where `outcome IS NULL` (pending/upcoming). Keep completed ones accessible via activity log only.

### Issue 4: Programs & Accommodations — PDF reference
The uploaded PDF is the "Registration Form" showing fields for: school selection (F+U Academy, Alpha Aktiv, GO Academy, VICTORIA Academy), accommodation types (single/double/hall), course types, dates. These should be pre-seeded into the `programs` and `accommodations` tables. Admin can then edit/add/delete. No schema change needed — already works. Need to seed default data via the `programs` and `accommodations` tables.

### Issue 5: Auto-generated cases workflow must be strictly enforced
Currently `CaseDetailPage` allows moving `new → contacted` but has no guard preventing jumps. The `ALLOWED_TRANSITIONS` in `caseTransitions.ts` already defines the correct path. Need to enforce it in the UI: only show the next valid action button for the current status.

### Issue 6: Mobile bottom nav — "Students" tab should point to "Ready to Apply" students
Currently team mobile nav has `/team/students` which shows `profile_completion`/`payment_confirmed`/`submitted` cases (Ready to Apply) — this is correct per previous plan. No change needed here.

### Issue 7: Admin pipeline assign dropdown rendering
The Select component with multi-line SelectItem content (name + email stacked) doesn't always render correctly in Radix UI's SelectItem. Need to use a simpler inline format: `"Name — email@..."` as a single line.

---

## Files to Change

### 1. `src/pages/admin/AdminPipelinePage.tsx`
- Split the nested `Promise.all` + inline await into sequential: first fetch `user_roles` where `role='team_member'`, then fetch `profiles` using those IDs
- Change SelectItem content from stacked `<div>` to simple string `{tm.full_name} — {tm.email}` (Radix SelectItem doesn't support flex children reliably)

### 2. `src/components/team/ProfileCompletionForm.tsx`
- Expand to include ALL fields from SubmitNewStudentPage Section A + B:
  - First/middle/last name (separate), emergency name/phone, city of birth
  - Full address (street, house no, postcode, city), DOB + auto-age, gender
  - Program (from DB), accommodation (from DB), school, arrival date, course start/end
  - Accommodation type + category, preferred subjects (checkboxes)
- Save all data into `case_submissions.extra_data` (matching SubmitNewStudentPage's exact field names)
- When saved, also update `cases.full_name` and `cases.phone_number`
- After saving, change case status to `profile_completion` only if currently below that (idempotent)

### 3. `src/pages/team/CaseDetailPage.tsx`
- Filter appointments display: only show `outcome IS NULL` ones (pending/upcoming)
- Add "Past appointments" collapsible for completed ones
- Add i18n for hardcoded English strings (Next Action card, labels)
- Make status badge human-readable (replace `_` with spaces + capitalize)

### 4. `src/pages/admin/AdminProgramsPage.tsx`
- Add **Edit** button to programs and accommodations cards (currently only Pause/Delete)
- Open a pre-filled edit dialog when clicked
- This allows admin to edit prices and details as required

### 5. Seed default programs data (INSERT via migration)
Pre-populate `programs` table with the 4 schools from the PDF:
- F+U Academy of Languages (language_school)  
- Alpha Aktiv (language_school)
- GO Academy (language_school)
- VICTORIA Academy (language_school)

And seed `accommodations` with standard types:
- Single Room, Double Room, Hall of Residence

Use a database migration with `INSERT ... ON CONFLICT DO NOTHING`.

### 6. `src/components/layout/DashboardLayout.tsx` (minor)
- Remove duplicate `nav.todayAppts` item from `team_member` nav — it shows in sidebar twice (both `/team/appointments` and `/team/appointments/today`)

---

## Workflow Summary (what we're enforcing)

```
new
 └─[Mark Contacted]──► contacted
                         └─[Schedule Appt]──► appointment_scheduled
                                               └─[Record Outcome: completed]──► profile_completion
                                                                                  └─[Save Profile Form]──► (stays profile_completion, form filled)
                                                                                                             └─[Student Pays → Confirm Payment]──► payment_confirmed
                                                                                                                                                    └─[Submit to Admin]──► submitted
                                                                                                                                                                            └─[Admin: Mark Enrolled]──► enrollment_paid
```

The `profile_completion` stage now has a **full form** (matching SubmitNewStudentPage) — after the team fills and saves it, they wait for student payment. The payment confirmation button appears at `payment_confirmed` stage. After payment is confirmed, case moves to `submitted` and Admin reviews it.

**Completed appointments** disappear from the "Appointments" card on case detail — only pending/upcoming show.

---

## Execution Order

```
1. Fix AdminPipelinePage assign dropdown (sequential fetch + simple label)
2. Expand ProfileCompletionForm to full student info form
3. Filter completed appointments in CaseDetailPage
4. Add Edit to AdminProgramsPage cards
5. Seed default programs (F+U, Alpha Aktiv, GO Academy, VICTORIA) + accommodation defaults
6. Clean up DashboardLayout duplicate nav item
```

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/pages/admin/AdminPipelinePage.tsx` | Fix sequential fetch for team members; fix SelectItem to single-line string |
| `src/components/team/ProfileCompletionForm.tsx` | Full Section A + B form (20+ fields matching SubmitNewStudentPage) |
| `src/pages/team/CaseDetailPage.tsx` | Filter completed appointments out; add i18n; fix status badge |
| `src/pages/admin/AdminProgramsPage.tsx` | Add Edit functionality to programs + accommodations |
| `supabase/migrations/` | Seed default programs (4 schools) + accommodations |
| `src/components/layout/DashboardLayout.tsx` | Remove duplicate todayAppts nav item |
