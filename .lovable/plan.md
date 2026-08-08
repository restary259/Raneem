# Darb — Chat Phase 5: Receipts, Editing, Mentions, Typing, Mobile

## 1. Read receipts and last seen

- Show a delivery/read state under each of my own messages: single check when sent, double check when every other participant has read it, and a small "seen by ..." line on the last read message.
- Reading uses the read markers that already exist per conversation (`case_message_reads`, `direct_thread_participants.last_read_at`) — no new message-level rows, so it stays fast.
- New read-only RPC `get_thread_read_state(kind, id)` returns each participant's `last_read_at` plus their name, so a viewer can only see receipts for conversations they already have access to.
- The conversation header shows the other person's "last seen" ("online now" / "last seen 12:40" / "last seen yesterday"), derived from the live presence channel with a fallback to their last read marker.
- Receipts refresh over the existing realtime subscription; the header last-seen updates from presence events only.

## 2. Editing messages

- Authors can edit their own text messages for 15 minutes after sending; attachments and document requests are not editable.
- Edited messages show an "edited" label with the edit time on hover.
- Server-side: `edited_at` and `original_body` columns plus `edit_case_message` / `edit_direct_message` RPCs that enforce author-only and the time window. Editing is blocked once a document request has been fulfilled.
- Deleting is out of scope for this round.

## 3. Mentions

- Typing `@` in the composer opens a picker of people who can see that conversation (case: assignee, admins, student when the message is shared; direct: thread participants).
- Mentions render as a highlighted chip; mentioning someone always notifies them in-app and by email even if the thread is otherwise quiet, unless the thread is muted.
- Stored as a `mentions` array on the message so notification fan-out and highlighting stay reliable if a name changes.
- Students are only mention-able on shared (non-internal) messages, so an internal note can never notify a student.

## 4. Typing indicator

- Animated three-dot bubble at the bottom of the conversation with "<name> is typing...".
- Uses a realtime broadcast on the conversation channel (nothing written to the database), throttled to one signal per 3 seconds and auto-clearing after 5 seconds of silence.

## 5. Messages tab on every dashboard

- Admin and Team already have Messages. Add:
  - **Student** — `/student/messages`: their own case conversation only (internal notes stay hidden), with the unread badge in the sidebar and mobile nav.
  - **Partner / Ambassador** — `/partner/messages`: direct conversations with admins only (same rule as team members).
- Same inbox surface for all roles, with the thread list hidden for students since they only ever have one conversation.

## 6. Mobile layout

- Match the team dashboard's mobile pattern across the messaging surface: full-height single-pane, thread list first, tapping a conversation slides to the conversation with a back arrow, header pinned, composer pinned above the bottom nav with safe-area padding.
- Fix the composer sitting under the bottom nav and the double scrollbar on small screens.
- **Team mobile bottom nav**: replace "Students" with "Messages" — final order: My work, Cases, Messages, Appointments. Students stays reachable from the sidebar/menu.
- Add the unread count badge to the Messages item in the mobile nav for every role.

## 7. Performance pass

- One realtime channel per open conversation instead of separate message/read/presence subscriptions; tear down properly on unmount.
- Load the most recent 50 messages with "load older" on scroll-up rather than the whole history.
- Memoize message grouping and avoid re-rendering the whole list when only presence or typing changes.
- Batch and cache signed attachment URLs instead of requesting one per render.
- Debounce the thread-list search and stop refetching the full thread list on every incoming message.
- Target: conversation opens under 300 ms on a warm cache, no visible jank when typing.

## Technical notes

- Migration adds: `edited_at`, `original_body`, `mentions uuid[]` on `case_messages` and `direct_messages`; RPCs `edit_case_message`, `edit_direct_message`, `get_thread_read_state`; grants and policies scoped to `authenticated` with existing access helpers (`can_access_case_thread`, `is_direct_thread_member`).
- Frontend touches `MessageList`, `MessageComposer`, `ThreadList`, `CaseMessagesInboxPage`, `CaseMessageService`, `DirectMessageService`, `NotificationService`, `MobileBottomNav`, `DashboardLayout`, `PartnerDashboardLayout`, `App.tsx` routes.
- Mention notifications reuse the existing `notify-new-message` function and email template with a mention variant.
- All new strings added to both Arabic and English dashboard locale files; unit tests for edit-window, mention parsing, and receipt state logic.
