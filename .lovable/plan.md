# Tests for the "Manage appointment" menu

The app already has about 1,600 automatic tests. This plan adds tests for the new appointment menu.

## What gets checked
- Tapping **Confirm** confirms the visit and shows "Appointment confirmed".
- **Reschedule** keeps Save disabled until a new date is picked, then sends the new time and shows "Appointment rescheduled".
- **Cancel** asks "are you sure?" first, cancels only after the second tap, and shows "Appointment cancelled".
- If the server refuses, an error message appears and the screen doesn't lock up.
- After any successful action, the page refreshes so the status updates.

## Technical details
- New file `src/components/team/__tests__/AppointmentActionMenu.test.tsx` (vitest + Testing Library).
- Mock `@/integrations/supabase/client` (`rpc`, `functions.invoke`, `auth.onAuthStateChange`) and `useToast`.
- Assert that `confirm_public_appointment` receives `p_appointment_id`, and that `record-appointment-outcome` receives `outcome: "rescheduled"` with an ISO `new_scheduled_at`, or `outcome: "cancelled"`. Also assert that `onDone` is called only on success.
- Run the new file plus the full suite.
