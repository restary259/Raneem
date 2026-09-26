# Fix: the "WhatsApp or book an appointment" choice is missing after applying

## Confirmed cause
Your test used a phone number that already has a case (+4917623790623, "Raneem G Dawahade"). When a phone number already has a case, the server updates that case but deliberately does not issue a booking pass. This is a security rule: without it, anyone who knows a phone number could book visits on another person's case.

The form only shows the choice screen when it gets a booking pass back. With no pass, it skips straight to the final "received" screen. New phone numbers still get the choice screen.

## Fix
- Show the choice screen after every successful application, including repeat phone numbers.
- For a repeat phone number, the security rule stays in place and no booking pass is issued. The WhatsApp card works as normal. The appointment card shows a short note that the DARB team will contact the student on WhatsApp to set the visit time, instead of opening the calendar.
- Add the new note wording in Arabic, English, and Hebrew.

## Verify
- Apply with a new phone number: the choice screen shows and the calendar opens.
- Apply with a phone number that already has a case: the choice screen shows and the appointment card shows the note.
- Archive the test applications.

## Technical details
- `src/components/apply/ApplyForm.tsx`: after success, go to the choice screen regardless of the token (dashboard embedded mode keeps its current behavior). Render the booking card as the calendar when a token exists, and as the informational note when there is none.
- New key `apply.bookingViaTeam` in the bundled and public `landing.json` files (ar/en/he).
- No change to the backend function.
