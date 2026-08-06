# Final hardening, deep audit and end-to-end test run

Everything from the previous plan is shipped. This plan closes the last confirmed defects found in a fresh read-only pass, then runs a real end-to-end test (creating an actual case and driving it through the pipeline in a headless browser).

## 1. Partner case visibility (Critical — confirmed)

The `cases` table has a policy `Partner can view all cases` whose condition is only "is a partner" — every partner can read every case row (names, phone numbers, education data), regardless of who referred them.

The partner dashboards do intentionally support a "pool mode" (`platform_settings.partner_dashboard_show_all_cases`), so the fix must keep that feature working while removing the blanket read:

- Replace the policy with one that allows a partner to read only their own cases (`partner_id = auth.uid()` or `referred_by = auth.uid()`).
- Add a security-definer function that returns pool-mode cases with a reduced column set (no phone number, no intake notes) and only when the pool-mode setting is on; point the partner overview and earnings pages at it.

## 2. Settings readable by everyone (High — confirmed)

`platform_settings` is readable by any signed-in user, including students, which exposes commission rates.

- Restrict the read policy to admins, team members and partners.
- Confirm no student-facing screen reads the table (partner and admin pages are the only callers).

## 3. Referral features querying a non-existent column (High — confirmed)

The `referrals` table has `referrer_user_id` and no `status` column, but three places query `referrer_id` and one filters on `status`:

- `src/components/dashboard/ReferralTracker.tsx` — `referrer_id`
- `src/components/admin/ReferralManagement.tsx` — `referrer_id` plus `.eq('status','paid')`
- `src/components/admin/SecurityPanel.tsx` — `referrer_id` in the fraud check

These fail silently (queries error, lists render empty). Fix them to use `referrer_user_id`, and base the milestone count on referrals whose linked case reached `enrollment_paid` instead of the missing `status` column.

## 4. Full end-to-end test run

- Typecheck the whole project.
- Database linter and security scan; confirm the only remaining warnings are the trigger functions and RLS helpers that must stay as-is, and that the partner and settings findings are gone.
- Headless browser run against the live app, signed in with the available session:
  - Create a real case through the team "submit new student" flow.
  - Walk it through the pipeline stages (contacted, appointment, profile, payment, submitted) and confirm each transition sticks.
  - Open the case detail page, the payouts tab and the pipeline list; capture console errors.
  - Verify the commission and revenue rows written for that case are correct (team commission recorded, `platform_revenue_ils` non-zero, `commission_split_done` set once).
  - Clean up the test case afterwards so the database is left as found.
- Re-smoke the guarded edge functions: 401 without a token, no 500 with one.

## Technical notes

Steps 1 and 2 need one migration (policy replacement plus a new security-definer reader for pool mode). Step 3 is client-only. The database currently holds no live cases, so the policy change carries no data-loss risk. `verify_jwt` stays `false`; in-code `requireAuth` remains the enforcement point.
