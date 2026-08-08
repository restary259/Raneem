# Chat: mention a case file with `#`

## Current state

Chat mentions are people-only. Typing `@` opens a picker of thread participants/staff, the chosen name is inserted as `@Name`, ids are stored in `mentions`, and `splitMentions` highlights them. There is no way to reference a case file inside a message.

## What to add

A second trigger, `#`, that references a case. Typing `#` plus any part of a case reference or student name opens a picker; choosing one inserts the case reference token (e.g. `#DRB-2026-0012`) into the message. In the message list that token renders as a clickable chip that opens the case detail page.

Scope: staff only (admin, team). Students and partners keep the `@` people mention only — they must not be able to search the case list.

## Behaviour details

- Trigger only at the start of a word, same rule as `@`, so hashtags inside words or URLs don't open the picker.
- Picker shows case reference + student name + status, max 6 results, keyboard Tab/Escape like the people picker.
- Cases without a reference fall back to a short id token so every case is linkable.
- Clicking a case chip navigates to the case detail route for the viewer's role (`/admin/cases/:id` or `/team/cases/:id`).
- Chips are styled distinctly from `@` mentions (case-file look, not person look) and work in both LTR and RTL.
- Existing messages are unaffected; rendering is purely client-side over the stored body text.

## Technical notes

- New security-definer RPC `search_cases_for_mention(p_query text)` returning id, case_reference, full_name, status, limited to 8 rows. Admin/manager sees all cases, team members see cases assigned to them; anyone else gets an empty set. Granted to `authenticated` only.
- `src/lib/chatFormat.ts`: add `MentionableCase` type and `activeCaseQuery` / `applyCaseMention` helpers mirroring the existing `@` helpers, plus extend segment splitting to emit a third segment type for case tokens (`{ text, kind: 'text' | 'person' | 'case', caseId? }`) while keeping the current person behaviour intact.
- `MessageComposer.tsx`: debounced RPC lookup on the active `#` query, a second picker list, and a `#` toolbar button next to the existing `@` button. Only rendered when the caller passes the new `allowCaseMentions` flag.
- `MessageList.tsx`: render case segments as a `Link`/button chip; needs the viewer role to build the route.
- Wire `allowCaseMentions` from the staff chat surfaces (`CaseMessages.tsx`, `DirectMessages.tsx`, admin/team message pages); leave student and partner surfaces off.
- Translations for the new picker label, button aria-label and empty state in `public/locales/{en,ar}/dashboard.json`.
- Unit tests for the new chatFormat helpers alongside the existing chat format tests.

## Files

- `src/lib/chatFormat.ts`
- `src/components/messages/MessageComposer.tsx`
- `src/components/messages/MessageList.tsx`
- `src/components/messages/DirectMessages.tsx`
- `src/components/cases/CaseMessages.tsx`
- `src/services/CaseMessageService.ts` (case search wrapper)
- `public/locales/en/dashboard.json`, `public/locales/ar/dashboard.json`
- One database migration for `search_cases_for_mention`
