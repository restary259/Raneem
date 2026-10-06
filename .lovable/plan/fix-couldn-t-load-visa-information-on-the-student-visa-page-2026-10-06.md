# Fix "Couldn't load visa information" on the student Visa page

## Cause (checked against the live database)
The new place where visa answers are stored hasn't been created yet. In the live database, the `student_visa_info` table doesn't exist and none of its 4 functions exist. The page tries to read from that table, the read fails, and the form shows "Couldn't load visa information."

## Fix
1. Apply `docs/manual-sql/20261006150000_student_visa_info.sql` to the database exactly as written, using the migration tool.
   - It only adds things: a new table, read permissions, and the save, submit and review actions.
   - Nothing existing is changed or deleted.
2. Check the live database afterwards:
   - the table exists and has its read rule;
   - all 4 functions exist;
   - signed-in users can use them and signed-out visitors cannot.
3. Open the Visa page signed in as Tsukuyomi:
   - confirm the 9-step form appears;
   - fill in step 1 and reload, and check it resumes at step 2.

## Not changed
No code changes are needed, because the page already reads from the new table. Applying the file is the only step.

## Rollback
The change only adds a new table. If the page code is ever reverted, the table can stay in place without affecting anything.
