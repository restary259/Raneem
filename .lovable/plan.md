# Apply funnel rebuild: major search, second applicant, booking, success screen

## Decisions (from your answers)
- **Next 7 days:** closed. Some other times are greyed out and labeled **"Unavailable"**. Nothing is ever labeled "booked". No fake bookings are saved.
- **Email:** no email field for anyone. The form stays WhatsApp-only.
- **Booking:** strongly encouraged. It is the main button, with a small "skip for now" link.

## New flow
```text
1 Your details -> 2 Education + preferred major -> 3 Review -> 4 Who are you applying with?
-> 5 Book your visit (encouraged) -> short loading -> "Your application was received" + major link
```

## Changes
1. **Preferred major search.** As the student types, suggestions come from the real DARB programs and majors lists, in Arabic, English and Hebrew. A match shows the program name, school, city and language where we have them. If a student picks a real program, both the major and the program are saved to their file. If nothing matches, the typed text is kept and marked "not matched".
2. **Review step.** One clean summary: name, phone, city, education, math/English units, major (and program), and how they're applying: alone, with a friend, or with a relative. If there's a second applicant, their details are shown too.
3. **"Who are you applying with?"** moves to the end, with three choices: alone, friend, relative. A short note says: "Applying together? You can get up to ₪500 in added value." This is display text only and doesn't change any prices. The amount is kept in one place so it's easy to change.
4. **Second applicant.** Same fields as the first applicant, apart from email: name, phone, city, education, Bagrut units, and major search with the same checks. Saved as that applicant's own record, so it never overwrites the first applicant.
5. **Consent appears once.** I'll find where the second copy comes from and remove it at the source.
6. **Booking step.** Heading: "Secure your appointment early." The flow goes date → time → review → confirm. It shows no "copy your link" and no "waiting for team confirmation" text. The team still confirms visits behind the scenes, as today.
7. **Success screen.** After a short 1–2 second spinner, a large checkmark appears with the text "تم استلام طلبك" and a short line of reassurance. It links to "View your major / program" (the real program or majors page) and "Browse all programs". It uses the DARB navy, blue and yellow, the blue arch shape, and an existing student photo. It works on phone and desktop, and the animation is reduced for students who turn motion off.
8. **Translations:** Arabic, English and Hebrew, with nothing falling back to English.
9. **Admin:** each case shows "Preferred subject" and "Preferred program".

## Technical details
- Files: `ApplyForm.tsx` (steps, review, companion, success), a new `MajorAutocomplete.tsx` using the `programs` table plus `searchMajors()`, and `PublicOfficeBooking.tsx` (copy, steps, removing the link and pending text).
- `publicBooking.functions.ts`: the availability check skips today through day 7 and greys out some other times in a fixed, repeatable pattern based on the slot time. It never writes rows. The database's existing protection against double bookings stays as it is.
- Database change: add `cases.preferred_program_id` (link to `programs`, can be empty), with the same access rules as the rest of the case. I apply it with the migration tool.
- `create-case-from-apply` + `insert_lead_from_apply`: accept and check `preferred_program_id`. The server confirms the program exists and is active. The friend's case keeps its own degree interest and program. Duplicate-phone handling, referral tracking and booking-link creation are unchanged.
- Tests: update `PublicOfficeBooking.test.tsx` and add form tests (consent once, second applicant kept separate, program saved, no pending text). Update the solo/friend/relative checks in `e2e/public-flow.spec.ts`. Then typecheck, translation-parity test, build, and a Playwright check in Arabic and English on phone and desktop. Any test cases I create get archived.
- The GitHub PR is opened through the existing repo sync. I can't open a PR directly from here.
