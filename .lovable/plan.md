# DARB WhatsApp template pack + automation catalog

## Goal
Get a full set of Arabic message templates that Meta will approve, and make sure the app can actually use each one after approval.

## What I checked in the code
- The app already recognises 22 message purposes (the list in your table).
- Automatic sends are triggered by 7 case events: appointment booked, appointment moved, payment received, application submitted, enrollment paid, document requested, student account created. Appointment reminders are scheduled 24 hours before.
- **Two gaps affect the pack:**
  1. The automation only picks templates with **no blanks** (no `{{1}}` fields). A template like "Hello {{1}}, your appointment is on {{2}}" would be approved by Meta but never sent automatically.
  2. There is **no "appointment moved" purpose**. A moved appointment re-sends the plain confirmation, so a "rescheduled" template would never be used.

## Part 1 — The template pack (a document, no app change)
A ready-to-paste pack for WhatsApp Manager covering all 22 purposes: exact name, category, language, Arabic text, sample values for each blank, and optional buttons.
- The 12 launch templates you listed come first, written to Meta's Utility rules: only about an existing booking, case, or payment; no promotion; no "test" wording.
- Re-engagement stays out of Utility. It becomes one **Marketing** template sent only to contacts who gave consent.
- Two versions for the automated ones:
  - **Version A (works today):** no blanks, so the current automation can send it as soon as Meta approves.
  - **Version B (better):** with the student's name, date, and time. Needs Part 2.
- Saved as a downloadable file.

## Part 2 — Let the automation fill in blanks (app change, needs your OK)
- Fill each blank from the case: student name, appointment date and time in Berlin time, amount due, missing document name, school name.
- If a blank can't be filled, the message isn't sent and the problem shows in Delivery health (never sent with an empty blank).
- Add an "appointment moved" purpose so moves send the reschedule template, with the confirmation as fallback.
- Hook up the purposes that are recognised but not triggered yet: payment instructions, payment reminder, document received, application update, next steps.

## Part 3 — Templates screen
- Each of the 22 purposes shows its template and Meta status: none, pending, approved, or rejected.
- Clearly flag the purposes that the automation needs but still have no approved template.

## Recommendation
Do Part 1 now and submit Version A of the 12 launch templates today, since Meta approval is the slowest step. Build Part 2 while approval is pending, then submit the Version B templates.

## Technical notes
- `queue_whatsapp_case_event_automation()` filters `components::text NOT LIKE '%{{%'`, `category='UTILITY'`, `language_code LIKE 'ar%'`, `approval_status='APPROVED'`, `is_active`. Part 2 removes the no-placeholder filter and adds a per-purpose parameter resolver (payload + case/appointment join); unresolved parameter → failed task with `last_error`.
- Add `appointment_rescheduled` to `PURPOSES` in `whatsapp-connector` and to the event map, falling back to `appointment_confirmation`.
- Template names in Meta must match `whatsapp_templates.name`; `sync_templates` picks up status, and the webhook handles `template_status` updates.
- Migrations are applied manually; en and ar translation keys are added together.
