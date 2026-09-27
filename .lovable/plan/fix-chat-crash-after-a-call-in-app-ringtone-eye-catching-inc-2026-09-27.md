# Fix chat crash after a call + in-app ringtone + eye-catching incoming-call alert

## What the audit found

- **The call history was saved correctly.** Both test calls exist in the database ("answered, 12s" and "cancelled"), so the saved messages are not the problem.
- **Most likely cause of the crash: a clashing live-update link in the chat list.** The Messages screen opens its live-update link under one fixed name ("messages-inbox"). If you leave the chat and come back quickly (for example right after a call ends), the new screen tries to reuse the old link before it has fully closed. The backend then refuses with "cannot add postgres_changes callbacks", and the section shows "This section encountered a problem". The Offices page had exactly the same fault earlier, and it was fixed the same way. The WhatsApp inbox uses the same fixed-name pattern too.
- **Second fault in the error logs:** "Maximum update depth exceeded", coming from page navigation. Something keeps changing the page address in a loop. The most likely source is the full-screen chat flag or the call screen reacting to the end of a call. This needs to be confirmed while reproducing the crash.
- **Wrong call label:** a finished call is saved as "answered", but the backend's call statuses are named differently, and any status the label doesn't recognise falls back to "Missed call". The history line needs to match the saved values exactly: answered, declined, cancelled, missed and failed.
- **Weak ring:** the in-app ring is a quiet synthetic beep, and the incoming-call card uses neutral colours, so it's easy to miss.

## What will change

1. **Stop the crash**
   - Give the Messages screen's live-update link (and the WhatsApp inbox's) a unique name each time the screen opens, and close it properly on exit. This is the same fix used for the Offices page.
   - Find and break the navigation loop, so the page address only changes when it actually needs to.
   - Make sure the call screen resets cleanly after a call ends, without changing any other screen.
   - Record the exact error the chat's error screen catches, so any future crash can be identified.
2. **In-app ringtone**
   - Play a real, clear, looping ringtone (a bundled audio file) while a call is coming in and the app is open. The synthetic beep stays only as a backup.
   - The caller hears a separate ringing tone while waiting.
   - Both sounds stop straight away when the call is accepted, declined, cancelled or missed, or after 30 seconds.
   - Phones block sound until you've tapped the app once, so sound is unlocked on your first tap in the app.
   - Android also vibrates. iPhone cannot vibrate from a website.
3. **Very visible incoming-call alert**
   - A full-screen overlay in bold DARB colours: a brand gradient background, a large pulsing avatar ring, the caller's name in large text, "Incoming voice call…", and big round green Accept and red Decline buttons.
   - It shows on top of everything, including the chat and navigation bars. It works on phone and desktop, and in Arabic (right-to-left) and English.
   - The browser tab title flashes "📞 Incoming call" and the app icon badge updates, so you can spot the call from another tab.
4. **Call history line:** show "Voice call · 00:12", "Missed call", "Declined call" or "Cancelled call" correctly.

## Technical details

- `src/pages/messages/CaseMessagesInboxPage.tsx`: channel name `messages-inbox:${crypto.randomUUID()}` via ref; await `removeChannel` on cleanup. Same in `WhatsAppInboxPage.tsx`.
- Reproduce with Playwright (team-member session) by opening a thread → leaving → reopening to capture the boundary error; add the `console.error` of the caught error in the section error boundary.
- Inspect `useChatFullscreen` and `VoiceCallContext` effects for navigate/setState on every render (the logs point to a router transition loop); guard them with value-equality checks.
- `VoiceCallContext.tsx`: new `public/sounds/ringtone.mp3` + `ringback.mp3` played via a reused `HTMLAudioElement` (`loop`), with a fallback to the existing `startTone`; unlock on first `pointerdown`; `document.title` flash interval while phase is `incoming`.
- New `IncomingCallOverlay` component (portal, `z-[100]`, semantic brand tokens + gradient, `animate-ping` ring, and reduced-motion respected).
- `MessageList.tsx` `CallLogLine`: map `answered|ended` → duration line, plus explicit declined/cancelled/missed/failed.
- New en+ar keys `voiceCall.incomingTitle`, `voiceCall.incomingSub`, `voiceCall.log.failed` (parity test).
- Verify: `bun x tsgo`, focused tests, i18n parity, and a Playwright reopen-chat check.
