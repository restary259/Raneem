# DARB — Data reset, location cleanup, notification onboarding, appointment fixes

## 1. Location cleanup

Confirmed: the only place the app presents "Tamra, Israel" as DARB's location is the office block on the public site (`officeLocations.city` in `public/locales/{en,ar}/common.json`, rendered by `src/components/landing/OfficeLocations.tsx`). The map query and the street line were already cleaned earlier. Everything else matching "Israel" is legitimate content (Bagrut recognition, visa/embassy FAQ, legal pages, currency wording) and stays untouched.

Change: `city` becomes "Tamra" / "طمرة" (no country); address, phone, email and hours stay as they are.


## 2. Hard data reset

Accounts confirmed in the database (7 real users):

| Keep | Delete |
| --- | --- |
| ranimdwahde3@gmail.com (admin) | team@gmail.com |
| Kheir.adv@gmail.com (team, خير ابو الهيجاء) | partner@gmail.com |
| royan379@gmail.com (Ryan, partner) | student@gmail.com |
| | tsukuyomidomain00@gmail.com |
| | tsukuyomidomain01@gmail.com |

Deletion is done by user id, not name. Note: the admin account currently also carries a stray `student` role row — that stray row is removed, the admin role kept.

Order of work:
1. Read-only inventory query: count rows per table owned by / referencing the five doomed ids, plus all orphan transactional rows.
2. Delete transactional data first (cases and everything hanging off them: submissions, services, snapshots, payments, events, messages, reads, appointments, documents, visa applications/field values, leads, referrals, rewards, commissions, commission transactions, payout requests, notifications, push subscriptions/delivery log, direct threads/messages/participants, activity log, sessions, consent records, invitations, recruit applications, partner links/clicks/offers).
3. Delete profiles + user_roles, then the auth users.
4. Storage: remove document objects belonging to deleted students.
5. Explicitly untouched master tables: `important_contacts`, `schools`, `programs`, `majors`, `major_categories`, `accommodations`, `insurances`, `master_services`, `service_catalog`, `pipeline_statuses`, `eligibility_config`/`thresholds`, `platform_settings`, `permissions`, `role_permissions`, `checklist_items`, `referral_milestones`, `commissions` config, `email_*` tables.
6. Post-reset audit query printed back to you: surviving accounts + row counts for every master table.

Ryan's and Kheir's demo cases, leads and appointments are deleted too — their accounts, roles and passwords are never modified.

## 3. Notification onboarding

The existing Web Push stack is reused as-is. New pieces only:
- `profiles.push_onboarding_state` column (`not_seen` | `dismissed` | `enabled` | `denied` | `unsupported`).
- `NotificationOnboardingDialog` shown once inside the dashboard layout when state is `not_seen`, permission is `default`, and push is supported. Copy is role-aware (student / team / partner / admin wording as you specified). "Enable Notifications" calls the existing subscribe flow on click only; "Maybe Later" writes `dismissed` and re-prompts no earlier than 14 days later. Settings → Notifications remains the manual path.
- Nothing blocks dashboard load; the state read is part of the existing profile fetch.

## 4. Appointment UI

`TeamAppointmentsPage.tsx` already truncates the name in chips, but the detail dialog and the week/day chip rows lose alignment on long Arabic names. Fix: `min-w-0` on every flex name container, single-line clamp with a tooltip (and full name shown in the detail dialog header, wrapping instead of truncating), fixed chip height, actions in a `shrink-0` column, and a mobile check at 360/768/1280 px. No visual redesign.

## 5. Appointment reminders

There is no reminder system today — appointments emit nothing. Building one (single system, no duplicates):
- `appointment_reminders` table: appointment_id, kind (`confirmation` | `t_24h` | `t_1h`), due_at, sent_at, recipient_id. Rows created/refreshed by a trigger on `appointments` insert/update of `scheduled_at`/`team_member_id`; pending rows deleted when the appointment is cancelled, completed, rescheduled away, deleted, or reassigned (new assignee gets fresh rows).
- A `send-appointment-reminders` edge function on a 5-minute pg_cron schedule picks due rows and, per the recipient's existing preferences, emits in-app notification (`emit_notification`), push (existing dispatcher) and an email through the existing transactional queue with a new `appointment-reminder` template. Only the assigned team member is targeted.
- Confirmation fires immediately on creation through the same path.

## 6. Verification

Database audit output, a fresh test account walked through the onboarding modal → permission → subscription → test push → deep link, an appointment created for a team member with the 24h/1h rows inspected and one reminder forced due to confirm all three channels, reschedule/cancel checked for stale reminders, and long-name screenshots at three widths.

## Technical notes

- Deletions run as targeted migrations/SQL scoped by id lists; no unscoped `DELETE FROM`.
- New tables get GRANTs + RLS in the same migration.
- Reminder sending is queue-based, so no dashboard path waits on it.
