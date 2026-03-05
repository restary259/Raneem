
## What the User Wants

1. **Submit New Student → goes straight to admin** (currently sets `status: 'enrollment_paid'`, should set `status: 'submitted'` so admin processes it first before marking enrolled)
2. **Create Student Account modal — smart email+case matching**: type email → filters cases that match (by phone or name), or pick manually. Always generates temp password only (no invite flow). Show password immediately + copy button.
3. **My Students — click on student → see full profile info + documents** (name, DOB, address, program, payment, all `extra_data` from case_submissions, plus documents uploaded)
4. **Birthday date picker fix** — in both `SubmitNewStudentPage.tsx` and `ProfileCompletionForm.tsx`, replace the standard calendar (no year/month navigation) with a proper DOB picker: a year dropdown + month dropdown + day picker so you can jump to birth years easily (e.g. 1990s, 2000s)

## Files to Change

### 1. `src/pages/team/SubmitNewStudentPage.tsx`
- Change `status: 'enrollment_paid'` → `status: 'submitted'` in the case insert
- Remove `enrollment_paid_at`, `enrollment_paid_by` from the case_submissions insert (student is not yet enrolled, admin must confirm)
- Keep `submitted_at`, `submitted_by` → stays
- Change `payment_confirmed: true` → keep it since team already confirmed payment in this form
- Replace the `DateField` component (lines ~246-261) with a smart `BirthdayPicker` component that has: year Select (1940–2015), month Select, then day Select. Simple dropdowns, no calendar needed for DOB.

### 2. `src/pages/team/TeamStudentsPage.tsx`
**Create Student Account modal rewrite:**
- Remove the "fetch eligible cases first, then show dropdown" approach
- New flow: Single email input at the top. As user types email (debounced 300ms), search all cases assigned to current user (no `student_user_id`) whose `full_name` or `phone_number` contains the typed text OR `extra_data->>'student_email'` from case_submissions matches
- Actually simpler: type email first → independently show a case selector dropdown that filters all eligible cases. The email and case are two separate fields. Email does NOT filter cases — they are independent.
- **Always temp password only** — change the `handleCreate` function: after calling edge function, always show the password modal (remove the `result.invited` branch — just always show password)
- Add a "Show All Info" sheet/dialog when clicking a student card: full profile panel

**Student profile view (click on card):**
- Instead of navigating to `/team/cases/${c.id}`, open a `Dialog` or `Sheet` showing:
  - Student name, phone, status badge
  - `extra_data` fields from `case_submissions`: DOB, address, gender, city of birth, emergency contact, school, program dates, service fee, accommodation
  - Documents section: query `documents` where `case_id = c.id`, show list with file name, category, download link
- Keep "Open Full Case" button at bottom that does navigate to case detail
- Need to also fetch `case_submissions` data for the selected case

### 3. `src/components/team/ProfileCompletionForm.tsx`  
- Replace `DateField` for DOB with the same smart `BirthdayPicker` (year/month/day dropdowns). Other date fields (arrival, course start/end) can stay as calendar pickers since those are future dates.

### No DB migration needed — `status: 'submitted'` already exists as a valid status.

## Birthday Picker Design
```
Year: [Select 1940..2015]  Month: [Jan..Dec]  Day: [1..31]
```
Implemented as a small inline component with 3 selects. No calendar popup needed for DOB. This is universally accessible and fast for team members filling forms.

## Summary of Changes

| File | Change |
|------|--------|
| `SubmitNewStudentPage.tsx` | `status: 'submitted'`, remove enrollment fields, replace DOB picker |
| `TeamStudentsPage.tsx` | Smart create modal (email + case separate), temp-pw only, student info sheet on click |  
| `ProfileCompletionForm.tsx` | Replace DOB calendar with year/month/day selects |
