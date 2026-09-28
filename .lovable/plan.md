# iPhone push notifications + 15-minute appointment alert

Goal: a team member who installs DARB on the iPhone Home Screen and allows notifications gets reminders 24 hours, 1 hour and 15 minutes before their own appointments. Tapping a reminder opens that exact appointment. This uses the push system we already have. No second provider and no Apple developer keys.

## What changes for users
- **Setup on iPhone:** Safari shows clear steps: "Share → Add to Home Screen → open DARB → Enable". After you allow notifications, the app sends a test notification so you know this phone actually receives them.
- **Settings:** a "This device" card shows whether DARB is installed, whether notifications are allowed or blocked, and when the last notification arrived.
- **Reminders:** a new "Appointment starting soon" alert 15 minutes before, in addition to the 24h and 1h ones. Only the team member assigned to the appointment gets it. It stays on screen until you tap it, and it opens the appointment directly.
- **No more pop-ups when you sign in:** returning users are never asked for notification permission again after login.

## Steps
1. **Install identity:** add `"id": "/"` to the app manifest so the Home Screen app keeps a stable identity.
2. **Silent refresh on sign-in:** at sign-in, AuthContext switches from `subscribeToPush` (which can ask for permission) to `refreshPushSubscription` (never asks).
3. **Setup dialog:** NotificationOnboardingDialog gets iOS install steps, an "I installed DARB" re-check, and an automatic test notification after you enable. It shows different messages for "not installed", "blocked" and "enabled".
4. **Settings card:** PushNotificationSettings gets a "This device" health card built from the existing diagnostics (installed, permission, background worker, subscription, last delivery or error).
5. **Database migration:**
   - allow reminder kind `t_15m` and create it for the assigned team member when an appointment is created or moved
   - add separate `push_sent_at` and `email_sent_at` fields, so an email failure never causes a second push.
6. **Reminder worker** (send-appointment-reminders):
   - handles t_24h (medium), t_1h (high) and t_15m (high, email skipped)
   - Arabic and English titles, e.g. "موعدك يبدأ بعد 15 دقيقة"
   - payload `type: appointment_15m`, category `appointments`, tag `appointment:<id>:<kind>`, link `/team/appointments?appointment=<id>`
   - marks push and email as sent separately, and only retries the channel that failed.
7. **Background worker** (service-worker.js): 15-minute alerts stay on screen until tapped. Appointment reminders do not change the app-icon badge count. Tapping keeps using the existing "open or focus the app" behaviour.
8. **Appointments page:** reads `?appointment=<id>` and opens that appointment's details automatically.
9. **Checks:** typecheck, tests, and a live check that one appointment 20 minutes away produces exactly one 15-minute notification for the assigned member.

## Technical notes
- No new notification category. Uses `appointments` / `cat_appointments`, told apart by `type` and `priority`.
- No fake `interruption-level` field. On a Home Screen web app, iOS only honours standard Web Push, so we use push urgency `high` instead. A code comment will explain this.
- Apple's push servers (`push.apple.com`) are already on the endpoint allow-list. Security rules stay as they are: you can only subscribe your own device, and only admins can send to other users.
- The cron frequency (every 5 minutes) already fits a 15-minute reminder. If it turns out to be slower, it will be changed to 5 minutes.
- The live change is a new migration that recreates the reminder trigger. It keeps the existing 24h and 1h behaviour and adds 15m. Existing future appointments get their t_15m rows added once.
