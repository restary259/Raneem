# Deploy the four voice-call migrations

## Verification result (done)

- The uploaded SQL is **byte-identical** to the four migration files already in the repo:
  1. `20260928100000_fix_direct_threads_purpose.sql`
  2. `20260928110000_voice_calls.sql`
  3. `20260928120000_voice_call_rpcs.sql`
  4. `20260928130000_voice_call_signaling.sql`
- Checked against the live database: **none of the four are applied** (not in the migration ledger). `direct_threads.purpose` exists (added out of band), but the `voice_calls` / `voice_call_locks` tables, the `voice_calls_enabled` profile flag, all 13 voice-call functions, and the cleanup cron job do **not** exist yet.
- Live data check: `direct_threads` has 2 rows (1 with `purpose = NULL`, 1 already `team_member`) — migration 1's backfill will only touch the NULL one if it matches the student+staff fingerprint.
- Cross-checked the call functions: the RPCs enforce caller = signed-in user, one call per person, calls only inside an existing shared chat thread, and all writes go through server-side functions (no direct table writes). The admin toggle (`VoiceCallsToggle`) writes `profiles.voice_calls_enabled`, which only exists after migration 2 — so the toggle is broken until this deploys.

## What I will do

1. **Apply migration 1** (`fix_direct_threads_purpose`): adds the `purpose` column safely (`IF NOT EXISTS`, so the existing live column is untouched) and backfills thread purposes.
2. **Apply migration 2** (`voice_calls`): creates the two call tables, the per-person on/off flag (default off, admin-only), read rules, and the permission helpers.
3. **Apply migration 3** (`voice_call_rpcs`): the call state machine — ring, answer, decline, cancel, hang up, heartbeat, and the stale-call sweeper.
4. **Apply migration 4** (`voice_call_signaling`): lets the two call participants use a private realtime channel, routes "incoming call" push notifications, and schedules the every-minute cleanup job.
5. **Verify after deploy**: run the 13 read-only checks from `supabase/diagnostics/voice_call_invariants.sql` (locks consistent, cron scheduled, flag defaults off, realtime policies carry the call branch) and report the results.

## Notes / risks

- Migration 4 recreates the private realtime channel rules — it preserves the existing typing/presence rules and adds the call rule; verified identical to the live definitions plus the new branch.
- Migration 4 needs the cron extension (present by default); if it errors there, everything else still stands and I'll report it.
- This is **backend only**. No call button appears in the app yet — the browser calling UI is a separate follow-up. After this deploy, calling is possible only for people an admin enables (admins can test immediately).
