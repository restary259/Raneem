# DARB Application + Booking Funnel Review Checklist

## Requested journey
- [x] First step asks whether the student applies alone or with a friend/relative.
- [x] Personal details follow the route choice.
- [x] Israeli mobile placeholder uses the common local format `050-1234567`.
- [x] Email is required and sent in the case payload.
- [x] Education is a dedicated step.
- [x] Bagrut requires both Math units and English units.
- [x] Major remains optional.
- [x] Review + required privacy consent is the final application step.
- [x] Marketing consent is removed from this application flow.
- [x] Privacy/data collection details are expandable.
- [x] Application success does not expose a copy/save booking link.

## Appointment journey
- [x] Student enters booking from the application success state.
- [x] Available dates/times are shown using Asia/Jerusalem.
- [x] Student gets a dedicated final confirmation step before booking.
- [x] Confirmation shows the selected date/time and office.
- [x] Booking remains linked to the originating case.
- [x] Real double-booking is rejected by the secure booking path.
- [x] The UI has a recoverable unavailable-booking state.
- [x] The availability layer uses deterministic operationally-unavailable capacity rather than falsely claiming another student booked it.

## Staff/admin journey
- [x] Assigned case retains appointment linkage.
- [x] Admin case drawer renders the linked appointment.
- [x] Assigned admin can confirm a pending public appointment.
- [x] Database confirmation still requires the appointment's case to be assigned to the acting staff user.
- [x] Team appointment workspace already supports pending public-appointment confirmation.

## Notifications
- [x] Application receipt email is sent after case creation on a best-effort basis.
- [x] Existing approved WhatsApp appointment automation remains the customer confirmation channel after staff confirmation.
- [ ] Email delivery provider CI/integration test: not executed in this connector session.

## Verification
- [x] E2E test updated to follow the four-step journey.
- [x] E2E checks that only one consent checkbox is rendered on the final step.
- [x] Source-level regression checks completed after the final fix.
- [ ] GitHub Actions/CI result: no status checks were present for the reviewed branch commit at review time.
- [ ] Full browser E2E execution: not executed in this connector session.

## Review conclusion
Source-level checklist is complete. Do not treat the branch as CI-green until GitHub Actions/browser E2E reports passing results.
