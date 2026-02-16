
# Team Dashboard Final Polish

## Issues to Fix

### 1. Complete Profile Does Not Move Case to Next Stage
The `saveProfileCompletion` function only checks 5 required fields (`student_full_name`, `student_email`, `student_phone`, `passport_number`, `nationality`). It needs to check ALL profile fields and reliably transition to `profile_filled` status. After saving, the case filter should auto-switch to the "profile_filled" tab so the user sees the moved case.

**Fix:** Expand the required fields list to include all mandatory fields (age, address, country of birth, language proficiency, destination city, school, intensive course, accommodation, gender). Show validation errors for missing fields. On successful save with all fields filled, transition to `profile_filled` and auto-switch the filter tab.

### 2. Appointment Stage -- Reschedule and Delete Buttons on Case Cards
Currently, the appointment stage case cards only show [Call] and [Complete Profile]. There is no way to reschedule or delete a case from the appointment stage tab.

**Fix:** Add [Reschedule] and [Delete] buttons to the appointment stage case card actions. Reschedule opens the existing reschedule dialog for the appointment linked to that case. Delete uses the existing delete confirmation flow.

### 3. Today's Appointments Visibility
Today's appointments are filtered to only show future ones (end > now). This is correct, but we also need to ensure the appointments section is visible and prominent on the Cases tab as a quick summary, not just on the Appointments tab.

**Fix:** Add a compact "Today's Appointments" summary card at the top of the Cases tab when there are active appointments today.

### 4. Toast Auto-Dismiss Duration
Currently toasts stay for a very long time (TOAST_REMOVE_DELAY = 1000000ms). The user wants notifications to auto-disappear in 1-2 seconds.

**Fix:** Change the toast duration to 2000ms (2 seconds) for quick action confirmations. Update the `TOAST_REMOVE_DELAY` constant and also pass `duration` to individual toast calls.

### 5. Admin Can Manually Edit Money Fields After Receiving Case
The `StudentCasesManagement` (admin side) shows financial data read-only. The admin needs to be able to edit `service_fee`, `school_commission`, `influencer_commission`, `lawyer_commission`, `referral_discount`, and `translation_fee` on submitted cases.

**Fix:** Add an "Edit Financials" button in the Money tab of the case detail dialog in `StudentCasesManagement`. This opens editable inputs for all financial fields and saves to the database.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/TeamDashboardPage.tsx` | 1. Expand mandatory fields + validation in `saveProfileCompletion`. 2. Auto-switch to `profile_filled` tab after completion. 3. Add Reschedule/Delete to appointment stage cards. 4. Add today's appointments summary to Cases tab. 5. Add `duration: 2000` to all toast calls. |
| `src/hooks/use-toast.ts` | Change `TOAST_REMOVE_DELAY` from 1000000 to 2000 for faster auto-dismiss. |
| `src/components/admin/StudentCasesManagement.tsx` | Add editable financial fields in the Money tab of the case detail dialog so admin can update fees/commissions after receiving a submitted case. |

---

## Technical Details

### Mandatory Profile Fields (all must be filled to advance)
- Personal: `student_full_name`, `student_email`, `student_phone`, `student_age`, `student_address`, `passport_number`, `nationality`, `country_of_birth`, `language_proficiency`
- Visa: `gender`
- Services: `selected_city`, `selected_school`, `intensive_course`, `accommodation_status`

If any field is missing, show a toast error listing which fields are incomplete and do NOT transition the status.

### Appointment Stage Actions
For cases in `appointment_scheduled` / `appointment_waiting` / `appointment_completed`:
- Find the linked appointment via `appointments.filter(a => a.case_id === c.id)`
- Show [Reschedule] button that opens the reschedule dialog
- Show [Delete Case] button with confirmation

### Admin Money Edit
- In `StudentCasesManagement`, add state for `editingMoney` (boolean) inside the case detail dialog
- When editing, render `Input type="number"` for each financial field
- On save, update `student_cases` row and call `onRefresh()`

### Toast Duration
- Set `TOAST_REMOVE_DELAY = 2000` in `use-toast.ts`
- This ensures all toasts auto-dismiss in 2 seconds

## Security Note
No new tables or RLS changes needed. All mutations use existing RLS policies (lawyers update their assigned cases, admins manage all cases).
