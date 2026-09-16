# Aiham Edris proposal — v3 (verified, statement tone, PDF only)

Rebuild the Münster proposal as a new file. Same design, same 10-page structure. No Word copy this time. Keep v1 and v2 untouched.

Output: `DARB-Proposal-AIHAM-EDRIS-Muenster-2026-v3.pdf`

## What the verification found

Checked page by page against KAPITO's official 2026 Dates & Prices sheet and the KAPITO student information sheet.

Correct, no change needed:
- Intensive Course 20 lessons/week, Mon–Fri 09:00–12:30, max 12 students.
- 26.10.2026 is the only absolute-beginner start date in October; next 23.11.2026, then January 2027.
- First booking 13 weeks at €180/week = €2,340; extension 29 weeks at €160/week = €4,640; total €6,980. Booking all 42 weeks at once = €6,720.
- Course end dates: first block ends Friday 05.02.2027, full plan ends Friday 27.08.2027 (winter break 19.12.2026–03.01.2027 is not taught and not charged).
- Arrival Sunday 25.10.2026, departure Saturday 28.08.2027, room booked Sunday to Saturday.
- Room only, no meals: weeks 1–4 €440, then €110/week; arranging fee €150 (one-off, non-refundable).
- Minimum age 16 for the course, 18 for a room without meals — he turns 18 on 06.04.2026, before the start.
- Passport 36093366 expires 31.05.2027, before the end of the course.

Four things are wrong or unproven and will be corrected:

1. **"First payment to the school ≈ €4,120" is not how the school bills.** The official sheet states: after the registration form is sent, transfer a €200 deposit (or the full amount) — the place is reserved once the deposit arrives — and the remaining balance is transferred before departure to Münster. The €4,120 figure will be removed and replaced with this exact sequence, plus a line saying the school issues the precise invoice after registration.
2. **The €200 is described inconsistently.** The accommodation section of the school's information sheet calls it a refundable security deposit for bookings of 13 weeks or more; the price list's registration section calls a €200 deposit the payment that reserves the course place. The proposal will state both readings as written by the school and note that we confirm the exact treatment with them before any transfer.
3. **Accommodation weeks vs calendar weeks.** The course is 42 taught weeks, but from 25.10.2026 to 28.08.2027 the calendar covers about 44 weeks because of the two-week winter break. The room is booked as a continuous Sunday-to-Saturday period. The document will show both: €4,620 if the room is not kept over the winter break, €4,840 if it is kept, and state that the school confirms which applies.
4. **Summer supplement.** €30/week is the published 2026 rate for 06.07–28.08.2026. His summer weeks fall in 2027, so about €240 stays but is labelled an estimate on the 2026 rate, not a quoted price. The 2026 exam dates will no longer be shown next to his plan — only the exam fees, marked as 2026 fees subject to change.

## Content changes

- **Tone.** Everything becomes plain statements of fact. No advice, no reassurance, no "we recommend", no explaining his own decision back to him. Each block is a labelled line: what it is, when it happens, what it costs.
- **Arrival and keys.** A clear sequence: host family name, address and phone are sent about one week before the start; he contacts them that week to give his arrival time; arrival Sunday 25.10.2026; the host hands over the room and keys on arrival; check-in on a different day or an earlier arrival is only possible with prior agreement and extra nights are charged separately at a price the school confirms. Stated as the school's procedure, with the point that exact arrival and handover details come from the school and the host family closer to the date.
- **What arrives later.** A short block stating that the school confirms the place, the host family, the exact arrival window and the final invoice after registration; these are not fixed today.
- **Email.** `darbsocial27@gmail.com` replaced with `info@darb.agency` everywhere.
- **Closing line.** The last page ends with a statement that the final detailed pricing and the exact amount to be paid will be provided within a few days.
- Everything else — branding in Arabic (مكتب درب), Western numerals, €1 ≈ ₪3.52 with the approximation note, ₪4,000 office fee shown separately from school fees, the not-included list — stays as is.

## Technical

Edit the existing generator at `/tmp/aiham/build.py`, rebuild the PDF, render every page to an image and inspect each one for footer overflow, Arabic joining, RTL order and number accuracy before delivery. Skip the DOCX step entirely. Deliver only the new v3 PDF to the documents folder.
