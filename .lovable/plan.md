# Audit of shipped work + final cleanup + full test run

## Audit result: shipped changes verified

Confirmed in the current code:
- `admin-mark-paid` records the commission with the admin-entered amount before the status flip, so the trigger can no longer latch revenue to 0.
- `_shared/auth.ts` exists and `send_welcome_email`, `send-branded-email`, `send-event-email`, `admin-weekly-digest` all call `requireAuth` with role restrictions before any work.
- `auth-guard` no longer references the undefined `deviceId`.
- `PartnerPayoutsPanel` bulk actions and `totalPending` now use only `status === 'pending'`; empty-selection guard is in place.
- `ReassignDialog` goes through the `reassign_case` RPC.
- The two public forms (`SubmitVideo`, `RegistrationForm`) call the still-public `send-email`, so the new auth checks don't break the public site.

No regressions found. One residual: `PartnerPayoutsPanel` still buckets `approved` rewards into the `pending` display list (line 362) even though they're excluded from money math — cosmetic, addressed below.

## Remaining steps

1. **Payout panel clarity (M5).** Split `approved` rewards out of the "pending" bucket in `PartnerPayoutsPanel` into a clearly labelled "In payout request" group so admins can see at a glance why a reward has no pay button. No money-math change — that is already correct.
2. **Raw error messages (M1).** Replace `error.message` shown directly in toasts on the admin/team money and case surfaces with translated, generic messages, logging the raw error to console instead. Scope: the payout, reassign, mark-paid and submission flows.
3. **Dead files (M4).** Remove the stray `orm.tsx src/components/dashboard/ReferralTracker.tsx` artifact and any other unreferenced files confirmed to have zero imports.
4. **Full test run.**
   - Typecheck the whole project.
   - Run the existing vitest suite.
   - Run the database linter and the security scan, confirm the only remaining warnings are the trigger functions and RLS helpers that must stay as-is.
   - Drive the app in a headless browser as admin: load the admin dashboard, open the payouts tab, the pipeline and a case detail page, and capture console errors.
   - Smoke the edge functions: confirm each newly-guarded function returns 401 without a token and does not 500 with one.

## Technical notes

No migrations are needed for any of the remaining steps — everything left is client code, cleanup, and verification. `verify_jwt` stays `false` in `config.toml`; the in-code `requireAuth` check is the enforcement point, matching the platform's signing-key setup.
