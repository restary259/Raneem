# Fix voice recording and cancellation crash

## Confirmed diagnosis
- The mic is implemented as **press-and-hold**. A normal click releases immediately, so the recorder stops as soon as it starts. That exactly matches the reported behavior.
- The “unsupported audio” message can come from two separate checks: browser recording support before recording, or the produced file type after stopping. The current code accepts only exact MIME strings; browsers can append codec parameters or vary their reported audio type.
- The live backend now accepts supported voice audio, and files have reached storage, but no voice-message row was saved. The failure is between recording/upload and final message creation.
- Cancellation and recorder shutdown share asynchronous stop/reset paths. A late `stop` event can run after cancellation or unmount and update a recorder that was already reset, which can break the chat page.

## Changes
1. Replace press-and-hold with reliable tap controls: first tap starts recording; visible Send, Stop/Preview, and Cancel controls finish it. Keep keyboard access.
2. Normalize the browser-produced MIME type before validation and file creation while preserving only backend-approved webm/mp4/ogg formats.
3. Make stop/cancel/unmount idempotent: one terminal action per recording; ignore stale `dataavailable`/`stop` events; never update state after cancellation or unmount.
4. Ensure failed sends remove the uploaded file and leave a retryable local preview without breaking the page.
5. Add focused tests for tap-to-record, immediate cancel, cancel-before-permission-resolves, unsupported browser, MIME normalization, and failed send cleanup.
6. Run `npm test` and `npm run build`, then perform a live direct-chat record/send/playback check and confirm the saved SQL row.

## Existing validation baseline
- `npm test`: failed — 3 failed, 1,461 passed, 1 skipped.
  - Two failures in `PublicOfficeBooking.test.tsx`.
  - One i18n failure: missing `case.application.office` and `nav.offices` in Arabic and English.
- `npm run build`: passed (exit 0).

Those unrelated existing failures will be reported but not fixed as part of the voice-note work.
