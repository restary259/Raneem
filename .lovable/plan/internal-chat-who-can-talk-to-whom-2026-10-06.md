# Internal chat: who can talk to whom

## Rule
One relationship gets one conversation. A student talks to their team only through their case chat, never through a second direct chat. The database enforces this as well as the screens.

## Who may message whom

| From | To | How |
|---|---|---|
| Student | Admin | Direct chat |
| Student | Their own team member | Case chat only |
| Team member | Team member | Direct chat (only with team chat enabled, as today) |
| Team member | Admin | Direct chat |
| Team member | Student | Case chat only |
| Admin | Anyone | Direct chat |
| Agent | Admin only | Direct chat |
| Partner / Ambassador | Admin only | Direct chat |

Agents can't message partners, ambassadors or students. Partners and ambassadors can't message students, team members or agents.

## Team dashboard
- The tab row becomes one compact menu: **Inbox [All ▾]**, with All / Teams / Students. "Administration" chats show under All. The unread count stays on each choice.
- It opens on All. Every choice lists chats newest first.
- Student rows only ever open the case chat.

## Admin dashboard
- The same menu: All / Teams / Students / Agents / Partners / Ambassadors.
- Each chat is sorted under the other person's role.

## Student dashboard
- Two entries only: **DARB Administration** (direct) and **My DARB Case — Message your DARB team** (the case chat).
- No button to start a direct chat with a team member.

## Agent, partner and ambassador
- The new-chat picker lists admins only. This matches today's behavior, which gets checked again.

## Reset
- We're still before launch, so every existing chat (direct and case) gets cleared once. Accounts, cases and everything else stay as they are.

## Technical details
- A new migration file for you to deploy yourself:
  - `start_direct_thread` gets rewritten around the table above. It keeps the "team member to team member needs `internal_team_chat_enabled`" rule, allows student to admin, and blocks every other student pair. Agent/partner/ambassador to anyone except an admin raises an error. It uses an empty `search_path` and schema-qualified names.
  - `get_staff_directory` gets the same matrix, so pickers never list someone you aren't allowed to message.
  - The insert policy on `direct_messages` gets re-checked so it requires a valid pair. This blocks sends in old threads that are no longer allowed.
- A separate reset SQL file, run once by you: it deletes the rows in `direct_messages`, `direct_thread_participants`, `direct_threads`, `case_messages` and `case_message_reads`. Nothing else is touched.
- `CaseMessagesInboxPage.tsx`: the filter becomes `all | teams | students` for team members, plus agents/partners/ambassadors for admins. It renders as a Select dropdown (with `'all'` as the sentinel value), and categories come from the other person's role.
- Student messages page: remove any team direct-chat entry, and give the case thread the "My DARB Case" label.
- Locales: new keys in en/ar/he, in both `public/locales` and `src/locales`, kept identical.
- Tests: a role matrix test for the picker filtering, and SQL verification queries for each allowed and blocked pair.
- Checks: typecheck, the i18n parity test, and Playwright on `/team/messages`, `/admin/messages` and `/student/messages`, at mobile size and in Arabic.

## Out of scope
WhatsApp tab, voice calls (beyond following the same pairs), and message storage format.
