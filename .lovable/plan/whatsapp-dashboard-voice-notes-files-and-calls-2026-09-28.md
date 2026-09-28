# WhatsApp dashboard: voice notes, files, and calls

## Short answers
- **Files (photos, PDFs, videos):** partly there already. Staff can attach a file and send it, and incoming media shows in the chat. The plan checks it works end to end and fixes any gaps.
- **Voice notes:** yes. Record in the dashboard and send as a real WhatsApp voice note. Incoming voice notes play inside the chat.
- **Voice calls:** not possible for now. The WhatsApp connection we use only supports messages and templates, not calls. Meta's calling feature needs a separate setup that our connection doesn't offer. The call button stays for internal chats only, and the WhatsApp screen will not show a call button that can't work.

Both admin (full WhatsApp workspace) and team (inbox only, for members an admin has given access) get the same features.

## What will change
1. **Voice-note button** in the WhatsApp reply box, next to the attach button. Tap to record, then send or cancel. This uses the same recorder already fixed for internal chats.
2. **Sending voice notes:** the recording is converted to a format WhatsApp accepts (OGG/Opus) and sent as a voice message. If the browser records in a format WhatsApp won't take, staff see a clear error, not a silent failure.
3. **Incoming voice notes:** shown as a small playable voice bubble with its length, not as a generic file.
4. **Files both ways:** check photos, videos, PDFs and other documents in both directions. Show the file name, size and type icon. Images open full size, and documents have a download link.
5. **Your phone messages:** files and voice notes you send from the WhatsApp Business app on your phone also appear in the dashboard (they arrive as "echo" messages).
6. **Rules kept:** the 24-hour reply window still applies to voice notes and files. Size limits follow WhatsApp's own caps (audio 16 MB, documents 100 MB, images 5 MB). Failed sends show the reason WhatsApp gives.

## Technical details
- `WhatsAppService.sendWhatsAppMedia` + its server path: add `audio` type (`voice: true` for OGG/Opus); verify gateway media upload (`/media`) and message `type` mapping for image/video/document/audio.
- Recorder: reuse `VoiceMessage`/recording hook; server-side or browser transcode to `audio/ogg; codecs=opus` when the recording is webm/mp4 (Chrome records webm/opus, so the container is re-wrapped; Safari mp4/aac is sent as `audio/mp4` normal audio).
- Webhook: confirm inbound + `smb_message_echoes` media is downloaded through `/media/<id>` → `/media_download` with a streaming size cap, stored in the private bucket, and path persisted; add retry for pending media.
- `MediaBubble`: voice-note variant (duration, compact player), file card with size/icon.
- Admin + team both use `WhatsAppInboxPage`; no role changes.
- Strings in EN/AR/HE (both locale trees for he).
- Tests: send-type mapping, size/MIME validation, bubble rendering; then a live test to 0529402168 (voice note + PDF both ways).
