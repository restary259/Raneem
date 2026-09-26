# Verify application + reminder messages (test number 0529402168)

## What I found so far
- The public application does not ask for an email address, so no "application received" email can be sent today.
- The application step itself sends no email; WhatsApp confirmations rely on automatic rules tied to case events and appointments, which only send once the matching WhatsApp template is approved by Meta.
- Reminder emails exist (24h / 1h). WhatsApp reminders are wired through the appointment notification rules, again dependent on approved templates.

## Steps
1. Check which WhatsApp templates are currently approved and synced (application received, appointment confirmation, reminder). Report any that are missing — those cannot send until Meta approves them.
2. Submit one real test application with phone 0529402168 (marked "TEST" in the name), then confirm:
   - a WhatsApp message was queued and delivered to +972 52 940 2168,
   - the send log shows the result (sent / blocked and why).
3. Book an office visit on that test application, confirm it as staff, and move its reminder time forward so the 24h/1h reminder fires now; confirm both the WhatsApp and the email reminder arrive.
4. Email: because the form has no email field, I will either (a) add an optional email field to step 1 and send an "application received" email, or (b) test email only on reminders using an email added to the test case by staff. You choose in the approval.
5. Clean up afterwards: archive the test case and appointment so they don't appear in the pipeline or KPIs.

## Notes
- This creates one real test case and real notifications to your number — needed to truly verify.
- If Meta still blocks sending ("no permission"), WhatsApp will fail at step 2 and I'll show the exact reason.
- Which email address should receive the test emails?
