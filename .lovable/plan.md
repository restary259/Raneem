# Phase 5 audit — Chat UX + two broken Edge Functions

Read-only audit. No code changed. Findings first, fix plan per item.

---

## A. Mobile chat height + page zoom (from the screenshot)

**What's wrong**

`src/pages/messages/CaseMessagesInboxPage.tsx:280` sizes the whole chat page with
`h-[calc(100vh-8rem)] min-h-[520px]`.

- `100vh` on iOS Safari is the *large* viewport (URL bar excluded), so the real visible area is smaller — the composer block gets pushed below the fold, which is exactly the dead grey band under "Private staff conversation." in the photo.
- `min-h-[520px]` overrides any shrinking, so when the keyboard opens the layout cannot compress; it overflows and the page scrolls as a whole instead of only the message list.
- The composer stack (textarea box, then a separate row with `+` and send, then the hint line) is three stacked rows, which is tall by design. Real messaging apps put `+`, textarea and send on **one** row.

**Zoom:** `index.html:6` is `width=device-width, initial-scale=1.0, viewport-fit=cover` — no zoom lock. The textarea already uses `text-base` (16px) so iOS focus-zoom is avoided, but pinch/double-tap zoom is still on.

**Fix plan**

1. Chat page shell: `h-[100dvh]` minus header via a CSS var, `min-h-0`, drop `min-h-[520px]` on mobile (keep it from `md:` up). Only the message list scrolls (`flex-1 min-h-0 overflow-y-auto`); header and composer stay pinned.
2. Add `interactive-widget=resizes-content` to the viewport meta so the keyboard shrinks the layout instead of overlaying it, and add `maximum-scale=1, user-scalable=no` to disable pinch/double-tap zoom. Scrolling is untouched by this — it only affects zoom.
3. Add `env(safe-area-inset-bottom)` padding under the composer so the send row clears the iOS home bar.
4. Collapse the composer into a single row on mobile: `+` button — textarea — send button, with the hint line only when there is space (or as a one-line caption). Attachment chips stay above the row.
5. Verify on 390x844 with Playwright, plus desktop, and confirm no other route regresses (the shell change is scoped to the messages pages and `CaseMessages`/`DirectMessages`).

---

## B. Mention / attach-case popup flickers (confirmed, root cause found)

**Component:** `src/components/messages/MessageComposer.tsx`

**Root cause:** the `@`/`#` items live inside a Radix `DropdownMenu` (lines 468-504). On `onSelect`, the handler inserts the character and calls `textRef.focus()` inside `requestAnimationFrame`. Radix then runs its own close routine, which **returns focus to the dropdown trigger button** *after* that frame. The textarea therefore fires `onBlur` (line 392), whose 150 ms timer sets `mentionQuery`/`caseQuery` to `null` — the list that had just appeared disappears. Clicking the textarea again re-focuses without clearing the query, so the second attempt works. That matches the reported symptom exactly.

Secondary weakness: closing the suggestion list on `onBlur` + `setTimeout(150)` is fragile in general (touch devices can beat the timer). A pointer-based outside-click check is the correct mechanism.

**Fix plan**
- Call `event.preventDefault()` in the `onSelect` handlers so Radix does not steal focus back, and move the focus/caret set into the menu's `onCloseAutoFocus` (also `preventDefault`ed).
- Replace the blur timer with: close on `Escape`, on outside `pointerdown` (listener on document, ignoring the popup and the textarea), and on selection — not on blur.
- Add `onMouseDown={e => e.preventDefault()}` on the suggestion buttons so the textarea keeps focus while picking.
- Add a regression test: open `#` from the menu, assert the case list is still mounted after two animation frames.

---

## C. Message editing — already exists

`MessageList.tsx` renders a `Pencil` action gated by `canEditMessage` (`src/lib/chatFormat.ts`), with inline textarea edit; it calls `onEditMessage`, which reaches `edit_case_message` / `edit_direct_message` RPCs (`CaseMessageService.ts:77`, `DirectMessageService.ts:107`). Both functions exist in the database. Own-message-only and the edit window are enforced in `canEditMessage` and again server-side in the RPCs.

UNVERIFIED: whether an "Edited" marker is rendered on every surface, and whether an edit history row is kept. Fix plan: confirm `edited_at` is displayed next to the timestamp in both list variants; no history table is needed for an internal tool beyond `edited_at` unless you want an audit trail — say the word and it becomes an `edited_from` text column written by the RPC.

---

## D. Auto-scroll — currently the "bad" behaviour

`MessageList.tsx:96-98`: a single effect that fires on every `messages.length` change and unconditionally jumps to the bottom. So:
- Opening a thread does land on the newest message (good).
- A message arriving while you read history **does yank you to the bottom** (bad), and loading an older page also re-jumps.

**Fix plan:** track "is near bottom" (`scrollHeight - scrollTop - clientHeight < ~80px`) on the scroll container. Auto-scroll only when near bottom or when the new message is your own; otherwise show a "new messages" pill that scrolls down on tap. Preserve scroll offset when prepending older pages. Use `behavior: 'auto'` on the initial mount and `'smooth'` afterwards.

---

## E. Mobile chat auto-open / blocking content

`CaseMessagesInboxPage.tsx:392-449` uses one grid where the thread list and the conversation panel each carry `md:flex` and are toggled by a selected-thread state — so on mobile a selected thread replaces the list full-screen. Nothing auto-selects a thread on mount that I can see, so it should not cover a page unprompted.

UNVERIFIED (needs a device run, and the page is behind the admin 2FA gate in the sandbox): whether deep links or the notification bell auto-select a thread and leave the user with no visible back affordance. Fix plan: verify with Playwright at 390px; guarantee an explicit back button on the mobile conversation view and no auto-selection unless a `?thread=` param is present.

---

## F. "Record Appointment Outcome" edge function error (priority)

**Traced path:** `AppointmentOutcomeModal.tsx:51` → `supabase.functions.invoke('record-appointment-outcome')` → function is deployed and boots cleanly (a live probe returns a well-formed `401 {"error":"Invalid token"}`, and `deno check` passes) → auth via anon client + `getUser()` → role check on `user_roles` → `parseBody` zod schema → ownership check → updates.

**What I can confirm**

- The function is *not* crashing on boot and *not* mis-imported.
- Every column it writes exists (`appointments.outcome`, `outcome_notes`, `outcome_recorded_at`, `outcome_recorded_by`, `rescheduled_to`; `cases.is_no_show`), and `log_activity(p_actor_id, p_actor_name, p_action, p_entity_type, p_entity_id, p_metadata)` matches the call signature.
- The case-stage trigger `enforce_case_stage_transition` short-circuits for `service_role`, so the status write is not blocked.
- **The error the user sees is almost certainly a non-2xx that is rendered opaquely.** `supabase.functions.invoke` reports every non-2xx as `Edge Function returned a non-2xx status code`; the modal does `throw new Error(resp.error.message)` and never reads `error.context`, so a real `403 "This appointment is not assigned to you"`, `400` validation failure, or `401` surfaces as a generic "Edge Function error". The most likely trigger: the appointment's `team_member_id` is not the caller and the case `assigned_to` is not the caller (403), or `new_scheduled_at` failing `z.string().datetime()`.
- One real latent bug: `.from("profiles").select(...).single()` throws-as-error when the caller has no `profiles` row; combined with the un-checked writes, some outcomes silently do nothing while still returning `success: true`.

UNVERIFIED: the exact status code, because the Cloud log reader returns no entries for this function and the admin UI is behind 2FA in the sandbox.

**Fix plan**
1. Read the real body in the client: use `FunctionsHttpError` / `error.context.text()` in `AppointmentOutcomeModal` (and everywhere else that invokes functions) and show the server's message.
2. Add `console.log` at each gate in the function (role check, ownership, validation) so the log reader has something to show.
3. Check `error` on every `update`/`insert`/`rpc` in the function and return a 4xx/5xx with the Postgres message instead of a false `success: true`.
4. Use `maybeSingle()` for the profile lookup.
5. Reproduce with a real team-member token against a real appointment, capture the status, then fix the actual gate (most likely: allow any admin/team member with case visibility, or fix the datetime format sent by the modal — `datetime-local` has no timezone).

## G. "Create Student Account & Send Invite" edge function error (priority)

**Traced path:** `CaseInviteStudent.tsx:46` / `SubmitNewStudentPage.tsx:578` → `create-student-from-case` → deployed and booting (same live probe: clean `401`, `deno check` passes) → `getUser(token)` → admin/team role check → zod body (`case_id`, `student_email`, `student_full_name`, optional `student_phone`) → case fetch → non-admin must own the case → `createInvitation` → `send-transactional-email`.

**Most likely root causes, in order**

1. **The Phase 1 conflict check.** We added a guard that rejects when the email already belongs to another user/case — it returns a 4xx that the client renders as a bare "Edge Function error" because `functions.invoke` hides the body. Re-inviting a student whose email already exists reproduces this.
2. **Zod rejection.** `student_phone` goes through `phoneField`; Israeli numbers entered as `05x-xxx xxxx` or `+972…` may fail the pattern, returning 400. `personName` may also reject names with digits/punctuation.
3. **Ownership 403** when a team member opens a case that is not `assigned_to` them.
4. Downstream `send-transactional-email` failure is *not* fatal (it is caught and logged), so the email is not the cause of the button error.

UNVERIFIED: which of the four fires, for the same logging reason as F.

**Fix plan**
1. Same client-side change: surface `error.context.text()` so the actual message ("email already in use", "invalid phone", "case not assigned to you") reaches the user in Arabic/English.
2. Normalise the phone before validation (strip spaces/dashes, accept `05x` and `+9725x`) and loosen `personName` to allow Arabic/Hebrew letters, hyphens and apostrophes.
3. Return structured error codes (`EMAIL_IN_USE`, `NOT_ASSIGNED`, `INVALID_PHONE`) and map them to translated toasts.
4. Log each gate; re-run with a live team-member token and confirm 200 + invitation row + email queued.

---

## Order of work when approved

1. F and G (actively broken) — error surfacing + logging first, then the real fix once the status is captured.
2. B (mention popup) — small, isolated.
3. A (mobile chat height + zoom lock) — visual verification at 390x844 and desktop.
4. D (smart auto-scroll), then C/E verification.
