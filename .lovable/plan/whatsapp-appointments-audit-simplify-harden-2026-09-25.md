# WhatsApp + Appointments: audit, simplify, harden

Fix the existing system, not a parallel one. No new dashboards, tabs or filters.

## Step 1 — Audit first (written report, no code)
- Screenshots of WhatsApp inbox, appointments and settings at 320 / 375 / 390 / 414 / 768 / 1024 / 1440 px. The admin area needs your 6-digit code, so screens will be captured from the team view where the admin gate blocks the test browser.
- List every overlap, cut-off, extra filter, long sentence, duplicate status and scroll problem.
- Trace the appointment flow end to end: create, confirm, reschedule, cancel, remind, complete / no-show, and what WhatsApp sends at each point.
- Deliver as a short report in Files before changing anything.

## Step 2 — Chat layout
- Header fixed, only messages scroll, composer pinned at bottom and above the phone keyboard.
- Remove competing scroll areas; no page scroll while chatting; long messages wrap; no sideways scroll at 320px.

## Step 3 — Shorter UI
- Connection: 🟢 Connected / 🔴 Disconnected / 🟡 Attention.
- Reply window: 🟢 24h / 🔴 Expired.
- Message states: Sending, ✓ Sent, ✓✓ Delivered, ✓✓ Read, ⚠ Failed.
- Filters kept to Search, Stage, Date. Remove other filters and explanatory paragraphs.
- Settings grouped as WhatsApp (status, templates, test) / Appointments (confirmation, reminder, reschedule, cancellation toggles) / Automation (on/off, last run, logs). Each setting in one place only.

## Step 4 — One appointment lifecycle
Scheduled → Confirmed → Completed, with Cancelled and No-show as endings. The same names in the screens, the database, reminders and WhatsApp messages.

## Step 5 — Reliable automatic messages
- Confirmation only after the appointment is actually saved, sent once.
- Reminders computed from the real appointment time; a rescheduled appointment uses the new time; cancelled / completed / no-show never get reminders; no duplicates.
- Every automatic message sent from the server with a logged event and duplicate protection.

## Step 6 — Verify
- Tests, build, before/after screenshots at every width.
- Live test on +972529402168 only: confirmation, reminder, reschedule, cancellation. No marketing messages. Templates still awaiting Meta approval will be reported, not faked.

## Out of scope
Meta approvals, Direct Send permission, second number, Hebrew, campaign redesign.

## Technical details
- `appointments` has no status column today: state comes from `outcome`, `outcome_recorded_at` and `rescheduled_to`. Plan: add a constrained `status` (scheduled/confirmed/completed/cancelled/no_show) backfilled from existing outcome data, kept in sync by trigger, so no existing screen breaks.
- Audit `send-appointment-reminders`, `record-appointment-outcome`, the `whatsapp-connector` appointment dispatch and `TeamAppointmentsPage.tsx`; add a unique send key per (appointment, purpose, scheduled time) so duplicates are impossible.
- Chat fix in `WhatsAppInboxPage.tsx`: single `min-h-0` flex column, one scroll container, `100dvh` + safe-area on mobile.
