# DARB — E2E Audit Response (UI/UX + data layer)

I checked your 54-point list against the live code and database. Most items are already shipped from the earlier phases; below is what is genuinely still broken, what is shipped-but-unverified, and the fix plan.

## Verified broken (root causes confirmed)

### A. School is not a real relationship on the submission (items 13, 14, 24-28, and the whole second brief)
Confirmed by inspecting the database: `case_submissions` has `program_id`, `accommodation_id`, `insurance_id` — but **no `school_id` column**. The school is only stashed inside the free-form `extra_data` JSON, and the Spreadsheet Hub reads `extra_data.school_name`, which is empty on all 4 existing submissions (only `school_id` is in the JSON).

Consequences, all reproduced from the data:
- School column in Spreadsheet Hub is blank.
- The school filter list is built from those blank values, so it only ever shows "All schools".
- Excel/PDF exports inherit the same blank column.

Fix at the data layer:
1. Migration: add `case_submissions.school_id` referencing `schools(id)`, backfill from `extra_data->>'school_id'` and, where missing, from the selected programme's school.
2. Migration: validation trigger rejecting a submission whose `program_id` or `accommodation_id` belongs to a different school than `school_id` (the backend must refuse invalid combinations, not just the dropdown).
3. Wizard writes the real `school_id` column (it already resets programme/accommodation when the school changes).
4. Spreadsheet query joins `school:schools(name_en,name_ar)` and returns the real name; filter switches to filtering by school id with names as labels; School packet, Excel and PDF all read the same joined field.

### B. Student onboarding is not enforced (items 7, 8, 36)
`profiles` has `date_of_birth`, `gender`, `nationality`, `passport_number`, `passport_expiry`, `eye_color`, `visa_status` — but only **one** emergency contact pair (`emergency_contact_name`/`_phone`). There is no gate forcing an activated student through profile completion before the dashboard.

Fix:
1. Migration: `emergency_contacts jsonb` (array of `{name, relationship, phone}`), min two entries enforced in the form; keep legacy columns in sync for existing views.
2. Add an onboarding route the student is redirected to after setting their password, blocking the dashboard until required fields are saved (identity, phone, 2 emergency contacts, passport/visa basics).
3. Track status: invited → activated → profile setup required → completed, surfaced in Student Management.

### C. Invitation idempotency (items 4, 44)
`create-student-from-case` reuses an existing auth user, but it re-sends an activation email on every click and does not check `user_invitations` for a still-valid pending token.

Fix: before sending, look up an unexpired invitation for that email; if one exists, return "invitation already sent (x minutes ago)" instead of issuing a second email, and rate-limit resends. Keep the account-reuse path as is.

## Shipped earlier — needs live verification, not rework
These were implemented in the previous phases and I will re-run them end to end rather than rebuild:
- Confirmation/review step, insurance selector, weekly × weeks pricing, service fee recording (items 3, 15-20).
- Arabic/Hebrew PDF fonts, Excel repair fix, School + Month filters, School packet (items 23, 25-29) — I will generate a real Excel and both Arabic and English PDFs and inspect them page by page.
- Team commission/payout records and the team member stats sheet (items 30-32) — the database currently holds one pending `team` reward, so the pipeline fires; the empty table needs re-checking after the school join lands.
- Chat mention popup, smart auto-scroll, mobile chat height, appointment-outcome and invite Edge Function error surfacing (items 37-42) — fixed this session, still to be exercised in the live app.

## Not reproducible from code alone — will be checked during the E2E run
- Item 5 (student landing on the Partner dashboard) — activation routing was already changed to read roles from the database; needs a live activation to confirm.
- Item 43 (a case email arriving as a password reset) — every template maps to its own trigger in code; needs the actual send log inspected.
- Item 40 (chat auto-opening on mobile) — no auto-open exists in code; UNVERIFIED until seen on a device.

## Order of work
1. School relationship migration + backfill + validation trigger.
2. Wizard, spreadsheet query, filters, Excel/PDF export wired to the real join.
3. Invitation idempotency guard.
4. Student onboarding gate + two emergency contacts.
5. Full E2E run: fresh student → school/programme/accommodation/insurance → confirm → submit → invite → activate → onboarding → admin/case/spreadsheet → real Excel + Arabic PDF + English PDF inspection → payment unpaid→paid → enrolled → team payout → chat checks. Anything I cannot drive (2FA-gated admin screens, real inbox delivery) is reported as UNVERIFIED rather than passed.

## Technical notes
- New columns: `case_submissions.school_id` (FK to `schools`), `profiles.emergency_contacts` (jsonb). Both get GRANTs and follow existing RLS patterns.
- No new frontend fallbacks such as `school || "Unknown"` — the column is joined or the row is flagged.
- Spreadsheet, Excel and PDF continue to share one query module (`sheetQueries.ts`) so all three exports stay identical.
