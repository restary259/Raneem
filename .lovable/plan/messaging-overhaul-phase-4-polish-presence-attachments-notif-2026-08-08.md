# Messaging Overhaul — Phase 4: Polish, Presence, Attachments, Notifications dont stack chat box and people on top of each others also remove case caht if it not attached to any thing 

## What I could inspect

I tried to capture live screenshots of `/admin/messages`, but the admin area is behind the Two-Factor Verification gate, so the browser session stops at the 2FA card and the chat surface cannot be photographed from here. The audit below is therefore based on the actual chat source (`CaseMessagesInboxPage`, `ThreadList`, `MessageList`, `MessageComposer`, `CaseMessages`, `DirectMessages`, `ChatAttachmentService`, `NotificationService`) plus the AR/EN `dashboard.json` files. I will re-attempt screenshots after the changes on a route reachable without 2FA (`/team/messages`) and include before/after images in the delivery.

## Audit findings

Visual / UI

- Thread list rows and message bubbles use flat `bg-muted` / `bg-accent`; the selected thread is barely distinguishable from hover, and unread rows have no weight difference.
- Timestamps in the thread list render only a date (`toLocaleDateString`), so today's messages show a date instead of a time.
- Filter chips, badges, and the header use three different sizes of tiny text (`text-[10px]`, `text-[11px]`, `text-xs`), which reads noisy.
- Internal notes are not visually separated enough from shared messages.
- Avatars are initials-only, monochrome, with no role color and no presence indicator.
- The composer sits in a plain bordered block; the send button, toggles, and hint line compete for attention.

Attachments

- No upload progress at all — a single global spinner on the paperclip button; multi-file uploads give no per-file feedback.
- No image or PDF preview: every attachment is a generic chip that opens a new tab.
- Validation exists (`validateAttachmentFile`) but errors surface as one generic toast without the file name, limit, or allowed types.
- A failed upload silently aborts the remaining files in the loop (the `try` wraps the whole batch).
- No way to retry or cancel an in-flight upload.

Presence

- No presence anywhere. Nothing shows who is currently online.

Direct-message scope

- `get_staff_directory()` returns all staff, so team members can start a thread with any other team member. The requirement is that team members may only see and message admins (and admin-designated managers).

Notifications

- `notifications` table and `NotificationService` exist, but nothing writes a notification for a new chat message or a document-request update.
- No email on new messages; per-thread mute exists (`message_thread_mutes`) but only affects the UI toggle — nothing consumes it.
- No per-user notification settings (in-app vs email, digest off/on).

Translations

- AR and EN `chat` / `messagesInbox` blocks are key-for-key identical, so nothing is missing today. New keys added in this phase must land in both files.

## Plan

### 1. UI and color pass (chat surface only)

- Rework thread rows: stronger selected state (primary-tinted surface + start border), bold title + accent dot for unread, relative time (`today → HH:mm`, this week → weekday, older → date, always `en-US` digits).
- Normalize typography to two sizes; unify badges; role-colored avatar rings using semantic tokens only (no hardcoded colors, light-mode only).
- Message bubbles: own vs other contrast pass, internal notes get an amber-tinted surface with a lock chip, day separators as centered pills.
- Composer: single rounded surface, quieter secondary toggles, primary send button, compact hint line.

### 2. Live presence badge

- Subscribe to a shared Supabase Realtime presence channel (`presence:staff`) on login from the dashboard layout; track `{ user_id, role }`.
- Expose `useOnlineUsers()` and render a green online dot on avatars in the thread list, chat header, and staff picker; "last seen" text is out of scope.

### 3. Team → admin/manager-only directory

- Add an admin-managed `is_manager` flag on `profiles` (admin-only writable, enforced by the existing profiles write trigger).
- Update `get_staff_directory()`: admins keep the full list; team members receive only admins plus profiles flagged `is_manager`. `start_direct_thread` keeps its server-side rule.
- Add a manager toggle in the existing admin team management screen.

### 4. Attachment UX

- Per-file upload state (queued / uploading with percentage / done / failed) rendered as chips with a progress bar; one failure no longer aborts the rest.
- Retry and remove per file; cancel in-flight.
- Client validation messages naming the file, its size, the 15 MB limit, and allowed types.
- Inline previews: image thumbnails (signed URL, lazy) and a PDF chip with a page icon that opens in an in-app dialog viewer; other types keep the current chip.

### 5. Notifications

- Database trigger on `case_messages` and `direct_messages` inserts creates `notifications` rows for every other thread participant, skipping muted threads and the author.
- A trigger on document-request fulfilment notifies the requester.
- New edge function `notify-new-message` (JWT-verified, service-role): sends the email through the existing branded-email path, respecting mute and per-user settings, with a short debounce so a burst of messages produces one email.
- Per-user notification settings (in-app on/off, email on/off) stored on `profiles`, surfaced in a settings popover in the messages header; per-thread mute stays where it is and now genuinely suppresses both channels.
- Header bell badge consumes the same `notifications` rows in realtime.

### 6. Translations and verification

- Add all new strings to both `public/locales/en/dashboard.json` and `public/locales/ar/dashboard.json`, plus a script check that the two `chat` / `messagesInbox` blocks stay key-identical.
- Run unit tests, typecheck, and a Playwright pass on `/team/messages` with before/after screenshots.

## Technical notes

- Migrations: `profiles.is_manager`, notification preference columns, `get_staff_directory()` replacement, message-notification triggers. All new/changed tables keep GRANTs and RLS intact.
- Presence uses Realtime presence only — no new table, no writes.
- Attachment progress uses XHR-based upload against the storage endpoint (the JS client does not expose progress), keeping the private `chat-attachments` bucket and its RLS path layout unchanged.
- No changes outside the messaging surface, the staff-directory RPC, and the notification plumbing.

## Open assumption

There is no `manager` role in the app (roles are admin, team_member, social_media_partner, student, ambassador). This plan implements "manager" as an admin-set flag on existing team members. If you meant something else, say so and I will adjust before building.