# P0 Crash Fixes — Edge Functions

Verified against the current codebase. Three defects, all confirmed by reading the files.

## What is broken

1. **Ten edge functions call validation helpers they never import.**
   `admin-early-release`, `admin-mark-paid`, `create-influencer`, `create-student-account`,
   `create-student-from-case`, `create-student-standalone`, `create-team-member`,
   `record-appointment-outcome`, `reset-student-password`, `send-custom-notification`
   all use `parseBody`, `z`, `uuid`, `personName`, `shortText`, `longText` with no
   `import ... from "../_shared/validate.ts"` line. Every request throws a ReferenceError,
   caught and returned as a generic 500 — which the UI shows as "Edge Function returned a
   non-2xx status code" (appointment outcome, student account creation, mark-paid, etc.).

2. **`emailField` does not exist.** Five of those files (`create-team-member`,
   `create-student-standalone`, `create-influencer`, `create-student-account`,
   `create-student-from-case`) reference `emailField`; the shared module exports `email`.
   This would still crash after fixing the imports.

3. **`verify-admin-password` has an out-of-scope variable.** Its module-level `json()` helper
   spreads `corsHeaders`, but that const is declared inside the request handler. Every response
   path — success, wrong password, and the catch block — throws, so the admin password gate
   fails on both correct and incorrect passwords.

## The fix

- Add the exact import line each of the ten files needs (only the symbols it actually uses)
  from `supabase/functions/_shared/validate.ts`.
- Rename `emailField` → `email` at the five usage sites.
- In `verify-admin-password/index.ts`, make `json()` take the headers as a parameter (or build
  the CORS headers at module level from the request) so every response path resolves.

No schema changes, no RLS changes, no business-logic changes. Purely restoring code that the
earlier validation refactor left half-applied.

## Verification

- Type/lint check the functions.
- Call `record-appointment-outcome`, `create-student-standalone`, and `verify-admin-password`
  directly with a real auth token and confirm they return proper 200/400/401 responses instead
  of 500s.
- Confirm a bad payload now returns a 400 with a field-level message (proving validation is
  actually running, not just silently absent).

## Deliberately not in this change

Re-testing the case timeline and Schedule Appointment behaviour, the appointment calendar
colour pass, new `case_event` types, the services/auto-invoicing model and merged Finance tab,
the full 135-migration RLS pass, and multi-tenant design. Several of those may look different
once the crashes are gone, so they come after this lands.
