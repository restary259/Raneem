# Apply page: remove email, move companion step, redesign booking

## Changes

### 1. Remove the email field
- Delete the Email input from the personal-details step of the application form.
- Drop it from the "can continue" validation and from the submission payload (the backend already treats email as optional, so nothing else breaks; no receipt email is sent, which matches the WhatsApp-only decision).

### 2. Move "applying alone or with a friend" to the end
- New step order: **1. Your details → 2. Education → 3. Alone or with a friend → 4. Review & submit**.
- The companion name/phone fields still appear only when "with a friend" is chosen, and validation moves with the step. Step titles, icons, and the progress bar update accordingly.

### 3. Redesign the post-submission booking stage (DARB-branded, inspired by the reference)
After submitting, the student chooses between booking an office visit or skipping — restyled as two clean cards. Choosing "book" opens a redesigned booking flow:

- **Mini step indicator** at the top: Choose date → Choose time → Confirm, with checkmarks for completed steps (like the reference, in DARB brand colors instead of blue).
- **Calendar card**: month view with a legend (available / unavailable / selected), available days highlighted, unavailable days greyed out.
- **Time-slot grid**: available times as clean pill buttons; taken slots shown hatched/striked and disabled; the selected slot filled in the brand color.
- **Summary card**: chosen date, time, and the office location (Tamra, Merkaz area) with icons, plus a "change time" link to go back.
- **Confirm button** in the brand color, then a **success state** with a check icon, the confirmed details, and a note that the team confirms the request and follows up on WhatsApp.
- Fully RTL-aware, Arabic + English, works on phone and desktop, uses existing design tokens (brand gold/navy) — no hardcoded blue.

## Technical notes
- Files: `src/components/apply/ApplyForm.tsx` (step reorder, email removal, success-screen choice cards), `src/components/apply/PublicOfficeBooking.tsx` (booking UI rebuild), locale keys in `public/locales/{en,ar}` + `src/locales/{en,ar}` where applicable (parity-guarded).
- No backend changes: the booking token flow, slot availability, and the pending-until-confirmed appointment logic stay exactly as they are.
- Verified with typecheck + build, and a visual check of the apply page in English and Arabic.
