# DARB Appointment Selector QA Checklist

## Desktop
- [x] DARB Navy and brand accents are used consistently.
- [x] Calendar and time slots use a spacious two-panel layout.
- [x] Appointment summary remains visible beside the selector.
- [x] Final confirmation is visually distinct from slot selection.
- [x] Selected date/time are clearly surfaced.
- [x] Office location remains visible.
- [x] Booking error states are readable and actionable.

## Mobile
- [x] Layout collapses to a single vertical journey.
- [x] Date selection remains touch-friendly.
- [x] Time slots remain touch-friendly.
- [x] Appointment summary follows the selection flow.
- [x] Confirmation actions stack cleanly on narrow screens.
- [x] Buttons preserve comfortable touch targets.
- [x] Motion can be reduced with prefers-reduced-motion.

## Product behavior
- [x] Selecting a time does not immediately create the appointment.
- [x] Student gets a final review/confirmation step.
- [x] Real booking races show the dedicated slot-taken message.
- [x] Operationally unavailable capacity is not described as another student booking it.
- [x] Appointment remains connected to the originating case.
- [x] Student-facing copy/save booking-link UI is not required.

## Final review
- [x] Current main branch used as the PR base.
- [x] Source-level review completed after the visual update.
- [ ] GitHub Actions / browser E2E passing result: pending repository CI execution.
