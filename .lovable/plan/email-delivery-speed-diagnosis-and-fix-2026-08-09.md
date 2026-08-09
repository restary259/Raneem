# Email delivery speed — diagnosis and fix

## What I verified in the live project (before planning)

- The immediate wake mechanism **already exists and already works**. Two triggers (`email_queue_wake_auth`, `email_queue_wake_transactional`) fire on insert into the pgmq queue tables. They call the queue worker over HTTP right away using the service-role key stored in the vault (the vault secret exists), and they also arm a 5-second `process-email-queue` cron as backup.
- The cron job is created on demand and removes itself when both queues are empty. That is why you only see `admin-weekly-digest` — the absence of `process-email-queue` in `cron.job` is expected while the queues are idle, not a bug.
- Timing evidence from the send log: an email queued at 19:27:57.15 had its first send attempt at 19:27:58.2 — about **1 second**. So enqueue → worker start is not the delay.
- The real problem: every recent send failed. First attempt returned `400 missing_unsubscribe`, and every retry after that returned `409 run_failed — "This email send already failed. Send again with a new idempotency key."` The worker retried 5 times over ~2.5 minutes and then dropped the message into the DLQ. From the outside this looks like "very slow / never arrives".
- The worker code in the repo does have a permanent-failure path, but the deployed behaviour retried a 400 anyway, which means the deployed copy is behind the repo copy.
- Two smaller defects found: the `409 run_failed` class is not treated as permanent (5 wasted retries + a 2.5 min delay before the DLQ), and the worker writes `status: 'rate_limited'` into `email_send_log`, a value the table's CHECK constraint rejects, so rate-limit events are silently not recorded.
- Reliability gap: if the trigger's HTTP call fails (two 502s are recorded) and no further email is enqueued, nothing re-arms the worker, so a queued message can sit until the next enqueue.

## What will change

### 1. Treat "already failed / new idempotency key required" as permanent
In the queue worker, classify HTTP 409 with `run_failed` (and the "send again with a new idempotency key" message) as a permanent failure. Such a message goes straight to the DLQ with a clear reason instead of burning 5 retries. Genuine transient errors (5xx, network) keep the existing retry-then-DLQ behaviour untouched.

### 2. Redeploy the worker
Redeploy `process-email-queue` (and `send-transactional-email` unchanged, to be certain the running copy matches the repo) so the permanent-failure handling that already exists in the code is actually live. The `unsubscribe_token` fix you made stays exactly as it is.

### 3. Safety-net sweep so nothing gets stuck
Add one low-frequency cron job (every 5 minutes) that calls the existing `email_queue_dispatch()` function. That function already checks whether the queues are empty, respects the rate-limit cooldown, and calls the same single worker — so this is a wake-up, not a second competing worker. It only matters when the instant trigger's HTTP call failed. Normal path stays: enqueue → instant trigger → worker within ~1 second.

### 4. Allow rate-limit events to be logged
Extend the `email_send_log` status CHECK constraint to include `rate_limited` so throttling is visible instead of silently discarded.

### 5. Verify with real sends
- Send the `email-test` template and the `student-invite` template to a real inbox.
- Confirm in the send log that `pending → sent` happens within a few seconds.
- Confirm exactly one `sent` row per message (no duplicates) — the unique index on `message_id where status='sent'` plus the pre-send guard covers the race.
- Force one deliberate failure to confirm retries and DLQ still behave, then confirm suppression is still honoured.
- Report the measured enqueue-to-sent latency.

## Technical notes

- Files to change: `supabase/functions/process-email-queue/index.ts` (409 classification only).
- Database migration required: yes, two small items — the `email_send_log` status constraint, and the 5-minute safety-net cron entry (the cron insert carries project-specific values, so it is applied as a direct statement rather than a shared migration).
- No secrets go anywhere near frontend code; the worker keeps reading the service-role key from the vault as it does today.
- Queue, retry, DLQ, idempotency, suppression and duplicate protection are all preserved. The queue remains the source of truth; the trigger only wakes the worker.
- Nothing manual is required from you afterwards.

## Confirm before I run the live tests

I will send the two test emails to `tsukuyomidomain00@gmail.com` unless you name a different address.
