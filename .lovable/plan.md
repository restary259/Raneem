# Database tidy-up (voice calls untouched)

## What changes
1. **Internal voice calls stay exactly as they are.** The voice-call cleanup task keeps running every minute. Nothing about calling, ringing or ending calls changes.
2. **The Google Business queue runs every 5 minutes instead of every minute.** A Google update (a review reply, post or photo) can now take up to 5 minutes to go out instead of 1. It still goes out automatically.
3. **Old internal logs clear themselves.** Once a day, the two background logs (saved web-call replies and scheduled-task history) delete entries older than 7 days. This removes about 35 MB today and stops the logs from growing again. No customer, case, student or payment data is touched.

## What it saves
- The database storage stops growing from logs, and the bulk of today's log space is freed.
- The database stays on all day, because the live site and the voice calls need it. So the hourly cost stays about the same. This is a tidy-up, not a big credit saving.

## Technical details
- The change is one new migration file with a fresh timestamp. Per project rules it is **manual deploy**: I write the file here and send you the SQL, and you deploy it.
  - It runs `cron.alter_job` on `google-business-worker-drain` to change the schedule to `*/5 * * * *`. The job's command stays as it is.
  - It adds a daily job `cleanup-internal-logs` at `15 3 * * *` with two bounded deletes:
    - `DELETE FROM net._http_response WHERE created < now() - interval '7 days'`
    - `DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'`
- `voice-call-cleanup` and all other jobs are not modified.
- Before writing the file, I'll check the current command for the drain job and confirm the column names on both log tables.
- After you deploy, I'll check the job list to confirm the new schedule and that the cleanup job exists. Once it has run, I'll also check the log table sizes.
- I'll add an `AGENTS.md` rule: background log tables keep 7 days through the daily cleanup job.
