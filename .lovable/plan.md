# Apply the Phase 4 Google delegation update

## What's live now
- Phase 3 (connecting offices to Google locations) is already in the database.
- Phase 4 (Primary + Side Manager delegation) is not: the list of "my Google offices" for team members doesn't exist yet.

## Steps
1. Apply `20261001180000_office_google_delegation.sql` from the project, unchanged. The pasted text repeats the file twice, so I won't use the paste.
   - It adds two new permissions: managing supported content, and removing a side manager.
   - Team members get a notification when they're made Primary or Side Manager, or removed.
   - A Google operator can't be moved to a different office while they still hold the role.
   - Team members get a "my Google offices" list.
   - No data is deleted and nothing is posted to Google.
2. Run the read-only check (`office_google_phase4_deploy_verify.sql`) and report each result.
3. Fix any security warnings that come from this update, and list any others without changing them.

## Technical details
- The file is newer than Phase 3's timestamp, so its version of `authorize_google_office_action` takes effect.
- The verification script only reads data. It runs after the migration succeeds.
