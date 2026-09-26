# Verify application + reminder messages (test number 0529402168)

## What I found so far
- The public application does not ask for an email address, so this test covers WhatsApp only.
- The application step itself sends no message; WhatsApp confirmations rely on automatic rules tied to case events and appointments, which send through the approved templates.
- WhatsApp reminders are wired through the appointment notification rules.
- Direct Send is now enabled on the account, so the WhatsApp delivery path is unblocked.

## Steps
1. Confirm Direct Send is switched on in settings and check which WhatsApp templates are approved and synced (application received, appointment confirmation, reminder). Report any that are missing.
2. Submit one real test application with phone 0529402168 (marked "TEST" in the name), then confirm:
   - a WhatsApp message was queued and delivered to +972 52 940 2168,
   - the send log shows the result (sent / blocked and why).
3. Book an office visit on that test application, confirm it as staff, and move its reminder time forward so the 24h/1h reminder fires now; confirm the WhatsApp reminder arrives.
4. Clean up afterwards: archive the test case and appointment so they don't appear in the pipeline or KPIs.

## Notes
- This creates one real test case and real WhatsApp messages to your number — needed to truly verify.
- If Meta still blocks sending ("no permission"), WhatsApp will fail at step 2 and I'll show the exact reason.
