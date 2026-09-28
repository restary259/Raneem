# Clean the case side panel and add a two-step appointment action

## 1. Case side panel (pipeline drawer)
- The appointment currently shows twice: the "Office visit" row inside the top info card, and a second "APPOINTMENT" card below "Open Full Case".
- Remove the second "APPOINTMENT" card entirely. The "Office visit" row stays the one place for the appointment (date, office, status).
- Move the confirm button that lived in the removed card into the "Office visit" row, so nothing is lost.
- Tidy spacing: consistent gaps between the info card, "Open Full Case", and the Contact / Education sections (the Contact heading currently touches the card above it).
- Same cleanup on the full case page if it shows the appointment twice (the application info block plus the appointments stage card) — keep one.

## 2. Two-step appointment action
Instead of confirming with one tap, the team member taps **"Manage appointment"** and gets a small menu:
- **Confirm** — confirms the visit (same server action used today).
- **Reschedule** — opens the new date/time picker, then saves.
- **Cancel** — asks "Are you sure?" and then cancels the visit.

Applied everywhere the confirm button exists today: the case side panel, the full case page, and the "Visit requests" list on the Appointments page. Works on phone (menu opens as a bottom sheet) and desktop (dropdown).

## Technical details
- `AdminPipelinePage.tsx`: delete the duplicate appointment block (~lines 860–925); render actions via `CaseApplicationInfo`.
- New shared `AppointmentActionMenu` component: Confirm → `confirm_public_appointment` RPC; Reschedule/Cancel → existing `record-appointment-outcome` function (`rescheduled` with `new_scheduled_at`, `cancelled`). No database changes.
- Used in `CaseApplicationInfo.tsx` and `TeamAppointmentsPage.tsx` visit requests.
- New labels added in EN/AR/HE.
