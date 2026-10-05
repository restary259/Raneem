# Audit and fix: confirming an office appointment fails

## What I confirmed
- In your last test the calendar loaded, but every press of "Confirm appointment" (Mon 19 Oct, 15:00 Tamra time) came back with "Booking could not be updated. Please contact DARB."
- The booking link itself is valid. The application is still at "New", it has no office or appointment yet, and the Tamra office has booking turned on, one team member and normal booking settings.
- The time you picked passes every check visible in the booking rules: it is within the 14-day window, more than 2 hours away, inside opening hours and on a 30-minute step. A rejected time would show "time taken", not this message, so the cause is something else.
- The app hides the real database error behind that generic message, so the exact cause is **not confirmed yet**.

## Likely causes, to check in this order
1. The automatic step that picks the team member for the slot fails or finds nobody. For example, Tamra's one member may not be marked as taking bookings, or may not cover consultations.
2. Something that runs automatically when an appointment is saved fails, such as creating reminders or sending WhatsApp or notifications.
3. Moving the application from "New" to "Appointment scheduled" is blocked by one of the rules that guard application stages.

## Steps
1. **Show the real reason:** record the actual database error on the server (never shown to the visitor), then repeat the booking once in the preview to capture it.
2. **Fix only that cause:**
   - Team-member data problem: tell you exactly what to set in Admin → Offices, or supply SQL for you to run.
   - Database rule problem: supply a migration file for you to deploy manually. Nothing is applied for you.
3. **Better message:** if no team member is free, show "No team member is free at this time, please pick another time" instead of "contact DARB".
4. **Verify:** book a slot end to end on /apply and /office-visit, check that a second booking of the same slot is blocked, and run the booking tests.

## Technical details
- `src/lib/publicBooking.functions.ts` (around line 437) maps every non-"Time unavailable" error from `manage_public_appointment` to a generic message. Add a server `console.error` with `result.error.message/code`, and map "Office unavailable" (null assignee) to a clear reason.
- Suspects, inspected first with read-only queries:
  - `resolve_office_assignee_for_slot(...)` and the `office_members` flags for Tamra.
  - Triggers on `appointments` INSERT.
  - The guard triggers on `cases` UPDATE (`office_id`/`assigned_to` set, `new`→`appointment_scheduled`).
- No data is changed during the audit. Migrations remain manual-deploy.
