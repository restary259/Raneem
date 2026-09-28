# Audit: GitHub SQL migrations and database changes vs live database

## Result
Everything from the recent GitHub changes is already live in the database. **No further deploy is needed.**

Checked against the live database (not just the change log):

| GitHub change | Live? |
|---|---|
| Voice notes in chat + validator hotfix | Yes: audio uploads are accepted |
| Direct thread purpose fix | Yes |
| Student "my team member" chat send fix | Yes: students can write in their team-member thread |
| Voice calls: tables, call actions, signaling, cleanup job | Yes: cleanup job scheduled |
| Offices: tables, save, team list, start-a-booking, booking checks | Yes |
| Bank details shared to admin through chat (secure) | Yes |
| Bank account holder name | Yes: column exists and the chat share includes it |

## Why some GitHub files look "not deployed"
Many GitHub files are not listed by their own names in the database history, because they were applied through the Lovable tools, which record their own names. What counts is what exists in the live database, and all of it matches.

Five older office helper actions from the first multi-office drafts do not exist live. Later versions replaced them on purpose, and nothing in the app calls them. Re-running those older files now would bring back behaviour that was already replaced and could break booking. **They should stay as they are.**

## Plan
1. No database changes.
2. Optional cleanup: add a short note at the top of the replaced office files so nobody runs them again by mistake. Tell me if you want this.
