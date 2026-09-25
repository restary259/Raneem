# Verify the new WhatsApp alert layout and app-icon badge

## Already confirmed
- The new alert rule is live: new WhatsApp alerts are saved with the contact name as the title and only the message as the text.
- The last alert (09:24 UTC) is from before the change, so it still has the old wording. No new message has come in since.

## Verification steps
1. Publish the app, since the updated background worker only reaches phones through the published version.
2. Ask the user to send one WhatsApp message to the DARB number from another phone.
3. Check the saved alert: title = contact name, text = message only.
4. Check the delivery log: the alert was sent to the user's device and included the unread count.
5. The user checks on the iPhone:
   - Lock screen shows "Raneem G Dawahdi" as the title and the message below (iOS still adds "from درب"; that cannot be removed).
   - The درب icon shows a red number. If not: Settings → Notifications → درب → Badges on, then reopen the app once from the Home Screen.
6. If anything fails, read the delivery logs and fix the cause.

## Technical details
- Query `notifications` (source `whatsapp_inbound`) and the push delivery log after the test message.
- Check the `push-dispatch` logs for the `badge` field in the payload.
