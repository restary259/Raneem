# Case finance: "Confirm & Save" and "Submit to Admin" are broken by a naming mismatch

## What I verified (not assumed)

I inspected the live database and the deployed function bodies for the case you have open
(`4fadd703…`, student total ₪5,000).

1. **The finance checklist table only accepts four labels.**
   `case_finance_confirmations` has a CHECK constraint allowing exactly:
   `agency_service_fee`, `language_course`, `accommodation`, `insurance`.
   The seeding function `ensure_case_finance_confirmations` inserts those same four.
   Every one of the 5 cases in the database has all four rows sitting at `pending`.

2. **The confirm function writes to a label that cannot exist.**
   `confirm_agency_service_payment` updates the row
   `WHERE finance_type = 'service_fee'` — a value the CHECK constraint forbids.
   That UPDATE silently matches **zero rows** (no error), so the checklist is never
   marked confirmed.

3. **The submit function reads the same non-existent label.**
   `submit_case_for_review` requires a `service_fee` row with status `confirmed`
   before it will submit. Since that row can never exist, it always raises
   `SUBMIT_BLOCKED: DARB service payment must be confirmed by the assigned team member`.
   This is exactly why "Submit to Admin" does nothing but show an error.

4. **What "Confirm & Save" *did* do on your case:** on 2026-08-22 it created the
   confirmed ₪5,000 agency payment, set `payment_confirmed = true`, and moved the case
   `profile_completion → payment_confirmed`. So the stage *did* advance once. It looks
   stuck because the finance checklist still reads "pending" and the next step (submit)
   is permanently blocked.

5. **A second, independent blocker:** `submit_case_for_review` also requires
   `program_start_date`. Four of the five submissions in the database have it `NULL`
   (your current case is the one that has it set: 2027-07-01). Those four cases would
   still fail to submit even after the label fix, with a different message.

6. **Same bug class in the enrollment gate:** `assert_case_ready_for_enrollment` loops over
   `school_course` / `school_accommodation` / `school_insurance` — also labels that cannot
   exist. Its loop matches nothing, so it silently reports "ready" without ever checking the
   German-side items. That is a real hole in the admin enrollment gate.

## The fix

All of it is a vocabulary alignment inside three database functions. No table changes,
no RLS changes, no frontend logic changes, no commission/payment math touched.

**One new migration** (idempotent, `CREATE OR REPLACE` only):

1. `confirm_agency_service_payment` — change the single `WHERE finance_type = 'service_fee'`
   to `'agency_service_fee'`, and make the UPDATE fail loudly if it matches zero rows
   (so a future mismatch can never be silent again). Everything else in the body
   (permission check, total check, payment row creation, stage flip) stays byte-identical.
2. `submit_case_for_review` — change the `EXISTS` check from `'service_fee'` to
   `'agency_service_fee'`. Nothing else changes: the same gates, the same provisional
   team reward, the same invoice issuance.
3. `assert_case_ready_for_enrollment` — map the three checked labels to the real ones
   (`language_course`, `accommodation`, `insurance`) so the German-side gate actually runs.
4. **Data repair for cases already confirmed:** for every case that has a *confirmed*
   `agency_service` payment but a `pending` `agency_service_fee` checklist row, set that
   row to `confirmed` (using the existing payment's confirmer and timestamp). This unblocks
   your current case immediately without re-running any payment logic. It touches only that
   one checklist row per case — no money, no status, no rewards.

**Frontend (small, presentation only):**

- Surface the real `SUBMIT_BLOCKED:` reason in the error toast on the case page instead of the
  generic "action failed", so a missing course start date reads as a missing course start
  date. This is a message-mapping change in the existing error helper only.

## Not doing (out of scope, flagged for your decision)

- Back-filling the four cases missing `program_start_date`. That is student data; the team
  should set the course start date in the profile step. After the fix the app will say so
  explicitly instead of failing silently.
- No change to commission recording, invoices, payouts, or the stage-transition trigger.

## Verification after the fix

- Re-query the checklist rows for your case and confirm `agency_service_fee = confirmed`.
- Click Submit to Admin on `4fadd703…` and confirm the case moves to `submitted`, an invoice
  row is issued, and the provisional team reward is created exactly once.
- Confirm the other four cases now fail with a clear "course start date required" message
  rather than the payment-confirmation error.
- Run the build and unit test suite.
