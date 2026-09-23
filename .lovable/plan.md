# Verify the student "confirm your details" screen (and close two gaps)

Automated checks already pass: the new prefill logic has unit tests (15 passing), the full suite is green (1444 passing), translations pass the English/Arabic parity check, and the build reports OK.

What is not yet verified is the screen itself with a real student. Reading through the flow surfaced two behaviours worth fixing before we call it correct.

## Two gaps found while reviewing

1. **Confirming while something is still missing can loop.** If the file we have is incomplete (say no date of birth), pressing "Everything is correct" saves what exists and then shows the same confirmation screen again, with no clear way forward. It should instead take the student straight to the first missing detail.
2. **Fixing the emergency contacts from the review doesn't come back.** Editing any other line returns to the confirmation screen; editing the contacts line finishes onboarding instead. It should behave like the rest.

## Fixes

- After confirming, if anything required is still blank, continue to the first missing question rather than reopening the confirmation screen.
- Returning from a contacts edit goes back to the confirmation screen, same as every other line.

## Verification

Sign in as a real student in the preview and check:

- A student with a case sees the confirmation screen first, with name, phone, email, date of birth, gender, nationality, city of birth, address, language school, intake and emergency contact filled from their file.
- "Everything is correct" with a complete file saves once and opens the dashboard.
- "Everything is correct" with something missing lands on that missing question, not back on the same screen.
- "Edit" on any line, including emergency contacts, returns to the confirmation screen with the change kept.
- "Go through the details step by step" walks the normal questions with the answers pre-filled.
- A student without a case sees the normal wizard, unchanged.
- Arabic renders right-to-left with no clipped text; email stays read-only.

Screenshots at phone width in English and Arabic, plus the passing build and test run, are the evidence.

## Technical notes

- Changes are limited to `src/components/student/StudentOnboardingGate.tsx` (post-confirm routing and the return path from the last task).
- No database, security-rule, case-status or team/admin changes. Saving still goes through the existing guarded profile write.
