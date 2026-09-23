# Prefill the student onboarding wizard from the student's case file

Today a student who already has a case must retype details the team already collected (birthday, gender, city of birth, address, language school, intake, emergency contact). The wizard only reads the student's own account record, so anything stored on the case is ignored.

Change: on first entry, the wizard loads the details attached to the student's case, shows them on one "confirm your details" screen, and lets the student either confirm everything in one tap or correct individual items.

## What the student sees

1. **Review screen (new first screen)** — a clean list of everything already on file, grouped: name, phone, email, birthday, gender, city of birth, home address, language school, intake month, emergency contact. Each line shows the value and a small "Edit" action. Values that are missing are shown as "Not on file yet".
2. **Two actions**
   - *Everything is correct* — saves the confirmed details to the student's account in one go and jumps straight to the first item that is still missing (often just the second emergency contact). If nothing is missing, the wizard closes and the dashboard opens.
   - *Something needs changing* — opens the normal step-by-step wizard, with every field already filled in, so the student only edits what is wrong.
3. **Edit on a single line** — tapping "Edit" next to one item opens that one question, then returns to the review screen.
4. A student with **no case attached** (account created standalone) sees exactly the current wizard, unchanged.

## Technical notes

- `StudentOnboardingGate.tsx` load step gains a second read: `get_my_case()` plus the matching `case_submissions` row (students already have read access to their own submission through existing access rules — no database, policy, or migration change).
- A new pure helper (`src/lib/onboardingPrefill.ts`, unit-tested) maps case data to the wizard's profile shape:
  - full name ← case full name; phone ← submission student phone, else case phone
  - birthday / gender / city of birth ← submission extra data (`date_of_birth`, `gender`, `city_of_birth`)
  - street / house number / city ← `street`, `house_no`, `city`
  - language school ← `school_id`, accepted only when it matches an active school in the dropdown; the school display name stays in sync as today
  - intake month ← `start_month`
  - first emergency contact ← `emergency_contact_name` / `emergency_contact_phone`
  - nationality keeps its existing "Israel" default
- Merge rule: a value already saved on the student's account always wins; case data only fills blanks. Nothing is overwritten silently.
- Writes go through the existing `persist()` path (same guarded profile update). Email is still read-only and never written. Validation (`taskErrorFor`, phone format, two-contact minimum, `isProfileComplete`) is untouched, so a prefilled value that fails validation still blocks with the normal message.
- Confirm-all performs a single profile update containing only prefilled-and-valid values, then recomputes the resume position with the existing logic.
- New wording keys added to English and Arabic together (review title, "from your file" hint, confirm button, edit label, "not on file yet"), keeping the locale parity test green.

## Expected results

- A student whose team already filled the case profile finishes onboarding in about two taps instead of nine screens.
- Confirming stores exactly the values shown; reopening Profile / Admin student view shows the same values.
- Correcting one line changes only that line; all other prefilled values persist.
- A field missing from the case is still asked for as a normal question.
- A student without a case, or with an empty case profile, sees the current wizard with no behaviour change.
- No change to case status, submissions, commissions, contacts logic, access rules, or any team/admin screen.
- Build clean, existing onboarding and locale tests pass, plus new tests for the mapping helper (case value used, account value wins, unknown school ignored, empty case is a no-op).
