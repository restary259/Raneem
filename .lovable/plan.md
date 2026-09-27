# Ringing, call history in chat, busy handling, no self-calls

## What is and isn't possible
A website or installed web app cannot take over the phone like WhatsApp or Discord do (full-screen ring on the lock screen, ringing in silent mode). Those apps use native phone features that websites can't reach. What we can do:
- **App open:** a looping ringtone plus vibration (Android) and a full-screen incoming-call card with Accept and Decline.
- **App closed or phone locked:** a high-priority push notification "Incoming call from X". Tapping it opens the call screen. It plays the normal notification sound once, not a continuous ring.
- **Caller side:** a "ringing…" tone plays until the other person answers, declines, or 30 seconds pass (then the call counts as missed).

## Call history in the chat
When a call ends, a small line is added to that conversation, like WhatsApp:
- "Voice call · 03:12" (answered, with how long it lasted)
- "Missed call", "Declined call", or "Cancelled call"
Both people see it, in Arabic and English. It is posted once, by the server, so it never doubles.

## Already on a call / busy
- The server already allows only one call per person. We make that clear in the app: calling someone who is busy shows "X is on another call, try again later" and no ring is sent.
- If you're already on a call, the call button is disabled.
- If a second call arrives while you're on one, it's declined automatically as "busy". The caller sees the busy message and your current call keeps going.
- Students calling team members follow the same rules.

## No calling yourself
The server already blocks this. The call button will also be hidden in any conversation where the other person is you, and in threads that only contain you.

## Technical details
- New migration:
  - `log_call_message(call_id)`: a SECURITY DEFINER helper that inserts one `direct_messages` row (`kind='call'`, metadata `{status, duration_s}`). It is called from `end_voice_call`, `decline_voice_call`, `cancel_voice_call` and `cleanup_stale_voice_calls`. Idempotent via a `call_logged` flag on `voice_calls`.
  - `start_voice_call`: when the callee is locked, raise a distinct `CALLEE_BUSY` code (and `CALLER_BUSY` for the caller) instead of the shared message.
  - Push: make sure the ring notification is sent with `urgency: high`, `requireInteraction` and a `call` tag, and that clicking it opens `/…/messages?call=<id>`.
- `VoiceCallContext`: ringtone and ringback audio (a small generated tone file), `navigator.vibrate` pattern, stop on any state change, map the busy codes to translated messages, and expose `inCall` so buttons can be disabled.
- `service-worker.js`: handle the `call` tag (renotify, vibrate, actions Accept/Decline) and focus or open the app on click.
- Message renderers (`MessageList`/bubble): render `kind='call'` as a centered system line with a phone icon.
- `VoiceCallButton`: hide when `peerId === me`; disable when `inCall`.
- Add i18n keys to en and ar. Verify with a typecheck, tests, and SQL checks (busy, self, a log row appears once).
