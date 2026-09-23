# WhatsApp — where it stands, and what is left

Checked against the live data today, not only the code.

## Done since the audit

- Appointment bookings no longer crash the case (the broken automation line is fixed).
- One bad incoming message can no longer block the whole inbox; failures are set aside instead, and the quarantine is currently empty (0 stuck).
- Names of people who write in are captured again.
- The follow-up scheduler now asks staff for every blank in a template.
- Staff can now see Delivery health, take or hand back a chat, record a marketing-consent decision, and tag a contact.

## What is left, in order

### 1. No template is approved — this blocks the most value
All 3 message templates are still PENDING with WhatsApp. Until at least one is approved, DARB can only reply inside 24 hours of someone writing first. Appointment confirmations, reminders, payment notices and every campaign stay dormant no matter how good the code is. This is a submission-and-waiting task with Meta, not a code task.

Work: review the 3 pending ones, submit the missing everyday ones (appointment confirm / remind / reschedule, documents missing, payment reminder, payment received, welcome, re-engagement), and show their real approval state on the Templates screen.

### 2. 16 outgoing messages still show the wrong tick
16 messages sent from the WhatsApp phone show as "sent" while 16 delivery receipts sit unmatched. I could not confirm the cause from the data alone — the receipts carry ids that match no stored message. Diagnosing that is the first step of this item, then fixing the matching and clearing the backlog.

### 3. Nobody owns the inbox yet
19 conversations, 1 assigned. The controls now exist; what is missing is the working habit and a nudge: show unowned chats first, and let an advisor be reminded when a chat sits unowned.

### 4. 17 of 19 contacts still have no name
New contacts get names now, but the older ones stay as phone numbers until they write again. Work: a short "name this contact" prompt in the inbox so staff can clear the backlog as they go.

### 5. Campaigns still have an audience of zero
No contact has granted marketing consent. The control now exists; what is missing is the easy path — record consent from the chat in one tap, and count a reply to a campaign link as opt-in.

### 6. WhatsApp is not connected to the student pipeline
Only 2 of 19 contacts are linked to a case. Nothing a student does on WhatsApp moves their case forward, and "which campaign produced this student" still cannot be answered.

### 7. One number only
A second number (admissions, Germany office, a campaign number) cannot be added without changes to how numbers, templates, campaigns and permissions are stored.

### 8. Smaller gaps
- Hebrew is missing on the WhatsApp screens; they silently show English.
- The AI draft limit resets whenever the server restarts.
- Two RLS-enabled tables have no access rules, and a large number of database functions are callable by any signed-in user. Most of this predates WhatsApp, but it should be reviewed.

## Recommended next piece of work

Items 1 and 2 together: get templates submitted and approved (the long pole, start it now because it waits on Meta), and fix the wrong delivery ticks while that approval is pending. Items 3–5 are quick follow-ons once staff start using the new controls daily.

## Technical notes

- `whatsapp_pending_statuses`: 16 rows, none join to `whatsapp_messages.provider_message_id`; 16 outbound rows sit at `delivery_status = 'sent'`, all recent phone-app echoes. Diagnose whether echo inserts store a different id than the status callback carries before changing the drain trigger.
- Linter: 157 issues — 2 RLS-enabled-no-policy, 9 anon-executable SECURITY DEFINER, 146 authenticated-executable SECURITY DEFINER. Needs a scoped review, not a blanket revoke.
- No `public/locales/he/whatsapp.json`; the namespace falls back to English.
- Multiple numbers would need a number registry plus routing in `whatsapp-connector`, which currently holds a single gateway/key pair.
