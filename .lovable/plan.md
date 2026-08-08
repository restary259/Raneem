# Darb — Messaging Overhaul (Phase 3)

## Where the tab is today

The Messages page already exists for admin at `/admin/messages` and is listed in the admin sidebar under the "Work" group (between "Applications" and "Finance"), plus a "المراسلات" button in the dashboard header. It is easy to miss because it sits mid-list inside a long grouped sidebar and the header button is icon-sized. This plan makes it unmissable and rebuilds the chat surface.

## 1. Make Messages impossible to miss

- Pin **المراسلات / Messages** to the top of the admin sidebar (own section, above "Work"), with a live unread count badge.
- Enlarge the header Messages button (label always visible on desktop) and keep the red unread dot.
- Add a **Messages** queue card to the Admin Command Center: unread count, last 3 senders, "Open inbox" action.
- Keep the same treatment for the Team sidebar so both roles match.

## 2. Chat quality checklist (internal management tool)

Everything below is what "perfect" means here; each item is built in this phase unless marked Later.

Conversation list
- [ ] Two-pane desktop layout, full-height, no page scroll; single-pane with back button on mobile
- [ ] Unified list with filter chips (All / Cases / Direct / Unread) instead of buried tabs
- [ ] Per-thread: avatar with initials, participant name + role, case reference, last message preview, relative time
- [ ] Unread bold + count pill; threads sorted by latest activity
- [ ] Search by person, case reference, or message text

Message thread
- [ ] Sticky thread header: name, role, case link ("Open case"), participants
- [ ] Day separators (اليوم / أمس / date) and consecutive-message grouping by sender
- [ ] Own vs other alignment with high-contrast bubbles from design tokens; internal notes visually distinct (amber "داخلي" tag)
- [ ] Read receipts ("تمت القراءة") and per-message timestamps in en-US digits
- [ ] Typing indicator via realtime presence
- [ ] Auto-scroll to newest, "jump to latest" button, "new messages" divider at first unread
- [ ] Optimistic send with failed-send retry; Enter to send, Shift+Enter newline
- [ ] Empty state, loading skeletons, RTL-correct throughout
- [ ] Message actions: copy, delete own message (soft delete) — Later: edit, reply-quote, reactions

Files and requests
- [ ] Attach files: drag-and-drop, paste, or picker (PDF, images, docx, xlsx; 15MB cap; MIME allow-list)
- [ ] Image thumbnails inline, other files as a file card with size + download
- [ ] Signed-URL downloads only (private bucket, no public links)
- [ ] **Document requests**: staff can send a structured "طلب مستند" message (title + note + optional due date). Recipient sees an Upload button in the bubble; uploading fulfils the request and flips it to "تم الاستلام"
- [ ] Requests appear in the case attention panel and log a case timeline event

Notifications
- [ ] In-app notification row on every new message you did not send (bell + toast when the app is open)
- [ ] Sidebar/header unread badges stay in sync in realtime
- [ ] Per-thread mute toggle
- [ ] Browser push for staff who enabled it (existing PWA push subscriptions)
- [ ] Later: email digest for messages unread after 24h

Safety
- [ ] Server-side authorship, visibility, and participation checks (no client-trusted fields)
- [ ] Students never see internal notes or staff direct threads
- [ ] Attachment access enforced by storage RLS mirroring thread membership

## 3. Technical work

Database / storage
- Private storage bucket `chat-attachments`, path `{thread_type}/{thread_id}/{uuid}-{filename}`, with RLS on `storage.objects` allowing read/write only to case participants (via existing case access helper) or direct-thread members (`is_direct_thread_member`).
- Add to `case_messages` and `direct_messages`: `attachments jsonb default '[]'` (name, path, mime, size), `kind text default 'text'` (`text` | `request`), `request_status text`, `deleted_at timestamptz`.
- Extend `send_case_message` / `send_direct_message` RPCs to accept attachments + kind, validating MIME/size metadata server-side; add `fulfil_document_request(p_message_id, p_attachment)`.
- Trigger on insert into both message tables → insert `notifications` rows for the other participants (skip muted threads).
- New `message_thread_mutes` table (user_id, thread_type, thread_id) with owner-only RLS + grants.

Frontend
- New `src/components/messages/` primitives: `ThreadList`, `ThreadHeader`, `MessageBubble`, `MessageComposer`, `AttachmentPicker`, `DocumentRequestCard`, shared by case, direct, case-detail, and student views.
- `ChatAttachmentService.ts` for upload + signed URL fetch.
- Rewrite `CaseMessagesInboxPage.tsx` as the two-pane shell using the new primitives; `CaseMessages.tsx` and `DirectMessages.tsx` become thin wrappers.
- Realtime: message inserts, read receipts, and presence typing channel per thread.
- All strings via `t()` in `dashboard.json` (ar + en), dates/numbers in `en-US` digits, ₪ untouched.

Verification
- Unit tests for grouping, unread math, attachment validation, and request state machine.
- Playwright: admin↔team chat with file upload, document request → fulfil, unread badge, student cannot see internal notes.

## Order of work

1. Navigation + Command Center discoverability
2. Storage bucket, schema, RPC, notification trigger
3. Chat primitives + two-pane inbox rebuild
4. Attachments and document requests
5. Notifications, mutes, typing, read receipts
6. Tests and final audit
