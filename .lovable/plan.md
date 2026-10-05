# Team chat: split chats into separate tabs and remove "All"

## What changes
In the Messages chat list, the filter buttons become separate categories in this order:

```text
[ Administration ] [ Team members ] [ Students ] [ Unread ]
```

- **All is removed.** The list always shows one category at a time.
- **Administration** shows direct chats with admins and other staff who aren't team members. These are the chats the current "Direct" filter shows.
- **Team members** shows chats with other team members. It only appears for people allowed to use team chat, as today.
- **Students** is the old "Cases" group under a new name. It shows each student's case chat.
- **Unread** stays as it is.
- Each button keeps its unread counter. Students gets a counter too.
- The page opens on Administration. Starting a new chat with an admin opens Administration. Starting one with a team member opens Team members.
- The chat list shows a single flat list for the chosen category, with no section headers.
- The section names change everywhere chats are grouped: "Direct" becomes "Administration" and "Cases" becomes "Students". This is in Arabic, English and Hebrew.

Chats and messages don't change. Who can see which chat stays the same.

## Technical details
- `src/pages/messages/CaseMessagesInboxPage.tsx`:
  - `Filter = "direct" | "teams" | "cases" | "unread"`, with a default of `"direct"`.
  - Add the case filter rule `filter === "cases" && item.category !== "cases"`.
  - The filters array is direct, teams (conditional), cases with `caseUnread`, then unread.
  - `openTeamChatWith` sets `"teams"` and `openDirectWith` sets `"direct"`. Pass `grouped={false}`.
- Locales: `chat.section.direct` becomes Administration / الإدارة / הנהלה. `chat.section.cases` becomes Students / الطلاب / סטודנטים. `chat.filter.teams` becomes Team members / أعضاء الفريق / חברי צוות. Update both the `public/locales` and the bundled locale files and keep them identical.
- Check: run the typecheck, then take Playwright screenshots of `/team/messages` showing each tab.
