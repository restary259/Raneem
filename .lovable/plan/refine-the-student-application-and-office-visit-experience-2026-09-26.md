# Refine the student application and office-visit experience

## Goal
Make the four-step application feel calm and direct, and make requesting an office visit feel like choosing a date and time rather than scanning a long list of timestamp buttons. Keep DARB’s existing light visual identity and natural Arabic/English wording.

## Student-facing changes
1. Simplify the application page: remove decorative chrome and repeated trust tiles, use one clear step heading and quiet progress indicator, consistent field/choice styling, and enough space for the main action. Keep the four steps, current questions, optional details, consent, companion handling, and referral attribution intact.
2. Rework the post-submit choice into a concise success message with one prominent “Choose an office visit” action and a clear secondary “Let DARB contact me” action. Booking remains optional; do not imply that a requested time is already confirmed.
3. Replace the appointment picker’s flat, scrollable date-time grid with a compact date-first calendar showing only available days, followed by time choices for the selected day. Display times in the office’s local timezone, with readable 0–9 numerals in Arabic and English. Make the selected day/time and final request action unambiguous on a phone.
4. Give the separate visit-management page the same layout and clear states for loading, unavailable/expired links, no available times, pending requests, confirmed visits, changing a time, and cancellation. Keep error messages actionable without displaying an active booking choice on an invalid link.

## Technical boundaries
- Reuse the existing booking API, token protection, available slots, confirmation lifecycle, and scheduling rules; this is a presentation and interaction refinement, not a booking-policy change.
- Use existing semantic design tokens and shared controls; update both bundled and public English/Arabic translations together. Preserve RTL behavior, keyboard accessibility, focus states, reduced-motion support, and the existing partner-embedded application form.
- Do not create live applications or send notifications for visual testing.

## Verification
Check the four form steps and booking states with focused UI tests, then inspect phone and desktop layouts in Arabic and English. Check the preview’s build and runtime diagnostics after implementation. Live staff confirmation remains outside this visual refinement.
