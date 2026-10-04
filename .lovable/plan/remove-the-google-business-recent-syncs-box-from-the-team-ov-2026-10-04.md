# Remove the "Google Business / Recent syncs" box from the team overview

## What it is
This box was meant to show automatic background syncs with Google. The seven "Pending" rows are sync requests created on Oct 2 that the background process never picked up, so they will stay "Pending" forever. "Unknown" appears because no health check has ever finished.

You don't need it. The Reviews, Photos, Posts and Profile pages each have their own working Sync button, and that's how your real data arrived.

## Change
- Remove the whole box from the Google Business overview page: the status dot, "Unknown", the "Sync office" button and the "Recent syncs" list.
- Nothing else on the page changes: office, Google listing, primary operator and side manager.
- The seven old stuck sync requests stay in the database untouched, since no data changes were requested. I can send you SQL to clear them if you want.

## Technical details
- `src/pages/team/TeamGoogleBusinessPage.tsx`: delete the `<section>` containing the health status, the `handleSync` button and the `jobs` list (around lines 359–436). Also remove the health/jobs queries, the `handleSync` state and the `SYNC_JOB_STATUS_CLASS` constant if they become unused.
- Unused i18n keys can stay; removing them is optional.
- Run the code check and the related tests, then open `/team/google` in a test browser to confirm the box is gone.
