# Audit: iPhone push + 15-minute appointment reminder changes

Reviewed by reading the code: manifest, sign-in hook, onboarding dialog, push settings card, service worker, appointments page deep link, reminder database change, `send-appointment-reminders`, and `push-dispatch`.

## What is correct
- Manifest has a stable `id: "/"`. Signing in only refreshes an existing subscription and never shows a permission prompt.
- Reminder rows: `t_15m` is allowed, the trigger creates 24h, 1h and 15m reminders only for the assigned team member, and it skips unconfirmed public bookings. The backfill is idempotent.
- Push and email are tracked separately, and `dedupe_key` stops a retry from sending a second push.
- `push-dispatch` sets a separate tag for each appointment and each reminder window, so reminders do not replace each other on the lock screen.
- The service worker keeps the 15-minute alert on screen until it is tapped, and appointment pushes do not change the app-icon badge.
- The "This device" card uses translated text and en-US dates.

## Problems found (sorted by impact)

1. **Reminder time is shown in UTC.** `whenText` comes from `toISOString()`. A 14:00 Israel appointment shows as "11:00", both in the push and in the email. Fix: format it in `Asia/Jerusalem` with the en-US locale.
2. **Late reminders fire when they no longer make sense.** There is no check for how late a reminder is. After a cron outage, or when a booking is made less than 15 minutes ahead, the "starting in 15 minutes" alert can arrive after the meeting has started. The 24h reminder can also arrive hours late. Fix: skip and close any reminder once `scheduled_at` has passed. Also drop `t_24h`/`t_1h` reminders that are more than half their window late.
3. **A failing reminder retries forever and can block the queue.** If email or push keeps failing, `sent_at` is never set, so the reminder is retried every 5 minutes with no limit. The query takes the 100 oldest reminders, so stuck rows can crowd out new ones. Fix: add an attempt counter. After a few failures (or once the appointment has passed), close the reminder and log it.
4. **The deep link can miss.** The page only opens the appointment if it is already in the loaded list. An appointment outside the loaded date range will not open. Fix: if there is no match, load that one appointment by id and jump to its date. Remove the `?appointment=` value from the address once handled.
5. **Unconfirmed check:** these behaviours have not been confirmed on a real device or against live data yet: the `notifications.metadata` column exists in the live database, the trigger is still attached after the function was replaced, and delivery works on an iPhone Home Screen app. The first build step checks these with read-only queries.

## Out of scope (not changed)
- The earlier notification-settings draft stays unapproved and is not touched.

## Technical details
- Edit `supabase/functions/send-appointment-reminders/index.ts`:
  - Use `Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", dateStyle: "medium", timeStyle: "short" })`.
  - Add a staleness guard before sending.
  - Increment `attempts`. When `attempts >= 5` or the appointment has passed, set `sent_at` and write a structured warning.
  - Redeploy the function.
- New migration: `ALTER TABLE appointment_reminders ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0`, plus a verification query for the trigger and the `notifications.metadata` column.
- `TeamAppointmentsPage.tsx`: add a single-row fetch when there is no match, then `history.replaceState` to clear the parameter.
- Checks: typecheck, focused tests, and one manual reminder run against a test appointment.
