# Team chat: show "Administration" instead of admin names, and put students in the Students tab

## What changes
- **Administration tab:** a chat with an admin shows as "Administration" with the Darb logo, not the admin's personal name (for example "Raneem" or "Raneem test"). Only admin accounts are listed in this tab.
- **Students tab:** private chats with students, like Tsukuyomi, move here from Administration. They sit next to the students' case chats.
- **Team members tab:** no change.
- Each tab's unread counter counts the chats it actually shows.

Messages and who can chat with whom stay the same. The only change is which tab each chat appears in and how admin chats are named.

## Technical details
- In `src/pages/messages/CaseMessagesInboxPage.tsx`, direct-thread categories come from `otherUserRole`:
  - `team_member` goes to `teams`.
  - `admin` goes to `direct` (Administration).
  - Everything else, such as student, agent or partner, goes to `cases` (Students).
- When `otherUserRole === "admin"`, the title becomes `t("chat.adminLabel")` and the subtitle is hidden. `ThreadList` already shows the Darb logo for that label.
- Recount the unread totals so each one matches its tab: direct = admin threads, cases = case threads plus non-staff direct threads.
- Check: run the typecheck, then take a Playwright screenshot of each tab on `/team/messages`.
