# Chat: email delivery, live presence badges, and completeness checklist

## What I verified first

- The `notify-new-message` function is deployed and is called whenever a case or direct message is sent.
- It looks for an email provider key (`RESEND_API_KEY`). That key is **not** configured in this project — only `EXCHANGE_RATE_API_KEY` and the managed AI key exist. No other function in the project sends real email either.
- Result: **message emails are currently not being delivered.** The function runs, picks the right recipients, respects mute and the per-user email toggle, and then logs "skipped: no provider" instead of sending.
- Presence already works inside the messages area only: online dots appear in the thread list, message avatars, and the conversation header. It does not appear anywhere else in the app.

## 1. Make message emails actually send (and prove it)

- Set up the email provider for the project and store its key as a backend secret.
- Set the sender to a verified Darb domain address (e.g. `notifications@darb.agency`); until the domain is verified, send from the provider's shared test sender so delivery can be proven immediately.
- Add an admin-only "Send test email" button in the messages notification settings popover: it calls the function in test mode and emails the signed-in admin, then shows success or the exact provider error.
- Log every attempt (recipient, thread, provider status) so failures are visible instead of silent.
- Keep the existing safeguards: muted threads never email, internal notes never email students, per-user email toggle respected, and one email per recipient per thread per 10 minutes.
- Verify end to end: send a message from one account, confirm the second account receives the email with the correct subject, preview text and deep link back to the thread.

## 2. Live "online" badge across the app

Reuse the existing presence channel so one connection powers everything:

- Header: small green dot on the current user's avatar plus an "Online" label.
- Admin > Team page: green/grey dot and "Online / Last seen" text per member.
- New direct message picker: online dot next to each admin/manager.
- Case detail: online dot next to the assigned team member and the student.
- Typing indicator inside an open conversation ("… is typing"), which uses the same channel.
- Away state: dot turns amber after 5 minutes without activity, grey when the tab is closed.

## 3. Recommended checklist for this internal chat tool

Delivered already:
- Unified inbox (case threads + direct threads), search, filter chips, unread counts
- Grouped bubbles, day separators, avatars, timestamps
- Internal notes (staff-only) vs shared messages
- Attachments up to 15 MB with progress, image/PDF preview, type and size validation
- Structured document requests with pending/fulfilled status
- Per-thread mute, in-app and email notification toggles
- Team members can only message admins and designated managers
- Arabic/English throughout, RTL-correct

Recommended next (proposed priority order):
1. Reliable email + test button (section 1)
2. Presence and typing indicators everywhere (section 2)
3. Read receipts — "seen by" on the last message of a thread
4. Message search inside a conversation, not just across threads
5. Edit within 15 minutes and delete with an audit trail (nothing silently disappears)
6. Reply/quote a specific message, and @mentions that always notify even in a muted thread
7. Pin important messages to the top of a case thread
8. Attach a message to the case timeline in one click (turn a chat message into a case event)
9. Quick replies / saved templates for repeated staff answers
10. Bulk actions in the inbox: mark all read, archive resolved threads
11. Desktop browser notifications with a per-user opt-in
12. Retention and export: keep chat under the existing 3-year policy, admin export of a case conversation to PDF

## Technical notes

- Files touched: `supabase/functions/notify-new-message/index.ts` (provider + test mode + logging), `src/pages/messages/CaseMessagesInboxPage.tsx` (test button), `src/hooks/useOnlineUsers.ts` (away state, typing), plus small presence additions in the header, `src/pages/admin/AdminTeamPage.tsx`, and `src/pages/team/CaseDetailPage.tsx`.
- Presence stays realtime-only; nothing is written to the database for online status.
- Items 3-12 of the checklist are not built in this pass unless you pick some — say which numbers you want and they get added to this plan.
