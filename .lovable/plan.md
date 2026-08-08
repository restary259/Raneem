# Darb — Case DOB, Referral UX, Admin Chat, Payout Review

## 1. Team case page — date of birth is unusable

The birth date is three dropdowns (year / month / day) in the case profile form. The day list is built from `daysInMonth(month, year)` and the value is only written through `normalizeDate(day, month, year)`, which throws until all three parts are set. Result: picking month or day first silently does nothing, nothing shows as selected, and the field never fills — so the case cannot be completed.

Fix:
- Hold year / month / day as three independent pieces of local state, so each dropdown shows its own selection immediately and in any order.
- Only compose and store the ISO date when all three are chosen; clamp the day if the user switches to a shorter month (31 Jan → Feb becomes 29/28).
- Keep the day list dependent on month/year, but default to 31 days while the month is still unset.
- Show a friendly inline error for an impossible date instead of dropping the value.
- Keep the existing autosave/draft path so a partly-entered birthday is not lost on refresh.

Verification: pick month → day → year in that order, confirm each shows, save, refresh, confirm the stored date, then advance the case stage.

## 2. Apply page — hide the referral message, keep the tracking

Remove the "Referred by [Partner]" banner and the broken-referral notice from the applicant-facing form. The referral code capture, validation and the partner attribution written on the lead and the case stay exactly as they are — attribution is resolved server side from the code, never from anything the applicant sees or can edit.

Verification: open a partner link, confirm no referral text appears, submit, confirm the new case and lead still carry that partner.

## 3. Admin chat — restructure and restyle

- Order the conversation sidebar as **Direct → Cases → Partners**, as three labelled groups rather than one flat list with filter chips.
- Partner threads are split out of "Direct" by the other participant's role, so partner conversations are their own section.
- Give each category a restrained colour identity (accent bar, avatar tint, small category badge, active-state ring) using existing semantic tokens — colour on indicators and status only, never as page-wide fills.
- Unread counts per category header.

## 4. Admin identity in chat

Your admin profile's name is stored in the database as `a a a`; that value is what chat renders. Fix at the source: update the admin profile's real name to **ADMINISTRATION**, and keep the existing `chatDisplayName` mapping so partners always see the administration label regardless of which admin account replies. No hard-coded names in components.

## 5. New-conversation permissions

No change to who can talk to whom — partners still only reach administration, via the existing server-side staff directory and thread-start functions. The redesigned picker just renders what the server returns.

## 6. Composer — compact, upward menu, no mobile zoom

- Single-line-height input by default that grows as the message grows, up to a capped height; tighter padding, smaller icon buttons, send button aligned to the input's end.
- The `+` menu becomes a proper upward-opening popover anchored to the button, constrained to the viewport, closing on outside click, layered above the message list on both desktop and mobile.
- Inputs and textareas in chat get a 16px minimum text size on mobile so iOS Safari never zooms on focus; page zoom stays available (no viewport lock, no `user-scalable=no`).
- Tap targets on composer controls raised to a comfortable minimum.

## 7. Mobile chat layout

Full-height chat column, list ↔ conversation navigation on narrow screens, messages that wrap without horizontal scroll, composer pinned above the bottom navigation with safe-area padding, no content hidden behind fixed bars.

## 8. Payout review for admins

The payout request card in the admin thread becomes a full review view:
- Partner, amount, status, requested/approved/paid timestamps.
- The list of cases and rewards behind the amount, read from the existing server-side request detail function so the figures are the server's, not the client's.
- **Attachments:** recommended approach — preview whatever the partner attached to the payout message itself (the chat attachment storage already exists, is private, and is permission-checked). Admins get an inline preview for images and PDFs through short-lived signed links, a download option for other types, and a clear "file unavailable" state when the object is missing. No new upload plumbing, no public buckets.
- **Approve** stays a deliberate two-step action with the summary visible.
- **I paid** now opens a confirmation dialog naming the partner and amount, with Cancel and Confirm Payment; only Confirm writes to the backend.
- All state transitions go through the existing server-side payout function, which records status, paid timestamp and the acting admin, so a refresh reflects the database.

## 9. Security and integrity checks

- Confirm only admins can read payout requests, their documents and act on them; confirm partners cannot approve or pay their own request, nor see another partner's request or files.
- Confirm chat, payout and referral all point at the same canonical partner profile record — no duplicate partner identities.
- No new parallel components: the date field, chat list, composer and payout card are each fixed in place rather than duplicated.

## 10. End-to-end test run

Driven through the running app with a real browser session, with screenshots at desktop and narrow-mobile widths:
1. Team → case → enter birthday → save → refresh → persisted → stage advances.
2. Partner referral link → apply → no referral text → submit → attribution present in the backend.
3. Admin chat → Direct/Cases/Partners order → new conversation shows ADMINISTRATION → compact composer → `+` opens upward → mobile has no zoom or clipping.
4. Payout request → review details, cases and attachment → approve → "I paid" → cancel changes nothing → confirm → backend updated → refresh holds.

Each flow is reported as passed only if it was actually exercised.

## Technical notes

- `src/components/cases/CaseProfileForm.tsx` — DOB state split, day clamping, validation messaging.
- `src/pages/ApplyPage.tsx` — remove referral banner and broken-referral notice only.
- `src/pages/messages/CaseMessagesInboxPage.tsx`, `src/components/messages/ThreadList.tsx` — grouped, colour-coded sidebar.
- `src/components/messages/MessageComposer.tsx` — compact layout, dropup popover, mobile font sizing.
- `src/components/messages/PayoutRequestCard.tsx` + a new payout review dialog — cases, attachments, approve, paid confirmation.
- `src/components/messages/DirectMessages.tsx`, `src/pages/messages/PartnerMessagesPage.tsx` — mobile layout.
- Data change: admin profile `full_name` set to ADMINISTRATION.
- Signed-URL reads for payout attachments through the existing private chat-attachment bucket.
