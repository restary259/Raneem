# Verification result: account creation is clean, one backend job is broken

## What I checked

- All 40 backend functions exist in the repo; the latest build is clean ("build OK").
- Backend request logs for the retention window: the only non-2xx responses are from the push-notification dispatcher.
- Account-creation integrity queries came back clean:
  - 0 orphaned auth identities (the old "Database error checking email" cause)
  - 0 accounts without a profile, 0 active profiles without a role
  - 0 stale pending invitations (every pending invite has no matching active account)
  - 14 live pending invitations, 6 accounts correctly flagged for forced password change

No errors in account creation.

## The one real error

`push-dispatch` is being called every 5 seconds and returns **401 Missing bearer token** every time — 4,090 denials in the last 24 hours. `send-appointment-reminders` hits the same wall (69 denials).

Cause, verified: both scheduled jobs build their `Authorization` header from a vault secret named `email_queue_service_role_key`. That secret **does not exist** in the vault, so the header is built as null and the functions reject the call before doing any work.

Consequences:
- Push notifications never send. 6 messages are stuck in the queue.
- The push job is meant to unschedule itself when the queue empties; because the queue never drains, it retries forever every 5 seconds and floods the auth failure log.
- Appointment reminders (24h/1h) never send.

## Fix

1. Add a dedicated dispatch secret as a backend secret (not the service-role key, which isn't retrievable here), and store the same value in the vault under the name the jobs read.
2. Update `push-dispatch` and `send-appointment-reminders` to accept that dispatch secret as a valid caller identity, in addition to the existing service-role/admin paths. No other function's auth changes.
3. Re-point both cron jobs at the now-present secret and confirm they authenticate.
4. Drain the 6 stuck push messages and confirm the push job unschedules itself once the queue is empty.
5. Confirm the auth failure log stops growing.

## Out of scope

No changes to account creation, invitations, RLS, commissions, or any other function.
