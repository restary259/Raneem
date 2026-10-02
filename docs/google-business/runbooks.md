# DARB × Google Business — Runbooks

Each runbook: **Detection → Action → Recovery → Verification**.

## 1. Google connection lost / OAuth refresh failing

**Detection.** `admin_google_integration_health` shows `connection_status` not
`connected`, or `error_code = AUTH` on recent sync jobs. `admin_google_attention_offices`
lists affected offices.

**Action.** Admin → Google Business Integration → Reconnect (`GOOGLE_RECONNECT`).
Do not touch per-office mappings — they survive a reconnect.

**Recovery.** Existing mappings are preserved; health is refreshed by the next
`HEALTH` reconciliation.

**Verification.** Reconnect proves **both** independently:
`connection_status = connected` **and** Pub/Sub `pubsub_status = connected`.
A successful OAuth alone does not prove event delivery.

## 2. Pub/Sub event pipeline broken

**Detection.** `admin_google_integration_health` → `pending_events` climbing
while `last_event_processed_at` stalls; `dead_letter_count` > 0.

**Action.** Inspect `admin_list_google_dead_letters`. For a transient cause
(Google 5xx, a bad deploy), fix the cause then
`admin_retry_google_business_event`. The retry resets the event to `RECEIVED`
and re-routes it through the normal (idempotent) path.

**Recovery.** Dead letters drain as retried events process.

**Verification.** `admin_google_event_timeline` shows the retried events
reaching `PROCESSED`; `dead_letter_count` returns to 0.

## 3. Mapping wrong / a Google location is 2 offices

**Detection.** `audit_google_business_integrity` →
`duplicate_location_mapping` > 0. (The DB also blocks a second office claiming
an already-mapped location.)

**Action.** Admin remaps/unsets the incorrect office via
`GOOGLE_REMAP_LOCATION`. Historical events keep their originally recorded
office; only new events use the current mapping.

**Verification.** The duplicate check returns 0; a test event routes to the
intended office.

## 4. Sync failure / stuck job

**Detection.** `audit_google_business_integrity` → `stuck_sync_jobs` > 0, or
`google_business_sync_jobs.status = 'FAILED'`.

**Action.** Stale `RUNNING` jobs are auto-recovered every 5 minutes by
`cron_recover_stale_google_sync_jobs` (re-queue if attempts remain, else fail).
For a persistent failure, fix the cause and request a scoped sync
(`requestOfficeGoogleSync`) or a `FULL` sync.

**Verification.** No `RUNNING` job older than an hour; the office audit shows
`SyncJobs` and `StuckJobs` ok.

## 5. Review incident (wrong reply / duplicate notification)

**Detection.** A user reports a wrong or missing reply.

**Action.** The reply audit is in `google_business_activity`; the review's own
`darb_reply_status` is DARB's lifecycle, kept separate from Google's raw
`reply_state`. Correct the reply through the normal review flow.

**Verification.** `audit_google_business_integrity` shows no duplicate/orphan
reviews; the review appears once and the notification count is consistent.

## 6. Security incident (suspected cross-office access)

**Detection.** Alert on `audit_google_business_integrity` high-severity checks,
or anomalous `google_business_activity`.

**Action.** Flip the global kill switch
(`admin_set_google_business_settings(p_global_enabled => false)`) — this stops
all live Google work while cached data stays readable. Investigate, then resume.

**Verification.** The security harness (`office_google_phase10_behavior_verify.sql`)
and the RLS matrix both pass; offices unaffected by the incident resume.

## 7. Production deployment

**Order (compatibility-safe).** database → backend → workers → frontend. Never
deploy a frontend expecting an API that does not exist yet.

**Verification.** After deploy: run
`supabase/diagnostics/office_google_phase10_deploy_verify.sql` (must read
ALL CHECKS PASSED), then the smoke test in `production-readiness.md`.

## 8. Rollback

1. **Disable Google writes first**
   (`admin_set_google_business_settings(p_write_enabled => false)`) — safer than
   letting a bad build keep mutating live profiles.
2. Roll back the application.
3. Database rollback only if a migration must be reverted (migrations are
   MANUAL DEPLOY; prefer forward-fix with a newer timestamp).
4. Re-enable writes once verified.

## 9. Disaster recovery

Simulate each loss and confirm the recovery path:

| Loss | Recovery |
|---|---|
| Google connection | Reconnect; mappings + cached data intact |
| Database | Restore from backup to non-production, run integrity checks, then promote |
| Pub/Sub subscription | Recreate (the stream itself is a transport, not storage); reconciliation backfills |
| Worker | Jobs re-queued by stale recovery; the worker is stateless |
| Frontend | Redeploy; PWA must not cache Google OAuth or private data |

**Backup/restore test** is required before go-live: back up → restore to a
non-production database → run `audit_google_business_integrity` and verify RLS,
mappings, reviews, posts, media, performance and audit rows.
