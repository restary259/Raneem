# Verify voice notes end-to-end

Current state confirmed: the live chat attachment validator now accepts audio types, and the chat-attachments bucket has no file-type restriction.

## Steps
1. Sign the preview in as a team member and open `/team/messages` (a direct thread and a case thread).
2. Using headless Chromium with a fake microphone (`--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`), hold/tap record for about 3 seconds, stop, and send.
3. Confirm:
   - the upload to the chat-attachments bucket returns 200
   - `send_direct_message` / `send_case_message` return success, not "File type not allowed"
   - the voice bubble appears with a duration and plays (a signed URL loads the audio)
4. Query the newest message row to confirm the attachment has `kind: "voice"`, an `audio/*` mime type, and `durationMs`.
5. Check console and network logs for errors, then share screenshots.

## If something fails
Report the exact failing layer (recording, upload, server validation, or playback) and propose a targeted fix. No changes are made unless something fails.
