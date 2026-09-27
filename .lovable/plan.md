# Voice notes: end-to-end findings and next step

## What the data shows (checked today)
- Recording and upload work. Six voice files (webm/opus, 0.8–1.8 KB) reached chat file storage between 12:28 and 12:29 UTC, in two direct threads.
- Sending fails. There are zero voice messages saved in either direct or case chats. The same recording was uploaded 3–4 times, which is what a failed send followed by retries looks like.
- The server check now accepts voice notes. It allows webm/mp4/ogg audio with a whole-number duration up to 5 minutes, and the recorder sends a whole-number duration. So the 12:28 failures were most likely hit before the updated check was applied. That is unconfirmed, because the read-only tools can't run the check directly.
- Leftover issue: every failed send leaves its uploaded file behind in storage, with no message pointing to it.

## Plan (after approval)
1. Run a live test in the preview: sign in as a team member, open a direct thread, record about 3 seconds with a fake microphone, and send. Repeat in a case thread.
2. Capture the exact response from the send step, then confirm the saved message row has `kind: voice`, the mime type and the duration, and that playback loads.
3. If sending still fails, fix only the failing layer, guided by the exact error.
4. When a send fails, remove the uploaded file so storage doesn't collect orphans. Also clean up the six orphaned test files.
