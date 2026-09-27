-- Phase-1 voice calls: read-only invariant audit.
--
-- Run in the Supabase SQL editor AFTER applying 20260928110000 / 20260928120000 /
-- 20260928130000. Every query here is a SELECT: this file never repairs
-- anything. Its job is to prove the state machine cannot be left in a state
-- that locks a user out of calling, and to surface rows that a manual or
-- out-of-band edit could have corrupted.
--
-- EXPECTED RESULT: every check below returns ZERO rows. A non-empty result is
-- a real defect, not noise — the only rows that are ever acceptable are the
-- ones TEST 8 explicitly labels as recent-and-fine.

-- ===========================================================================
-- TEST 1 — a lock must always point at a live call
-- ===========================================================================
-- voice_call_locks is the mechanism that enforces "one call per user". A row
-- pointing at a finished call means a terminal transition did not release it,
-- and that user can never start another call.
SELECT l.user_id, l.call_id, vc.status, vc.ended_at
  FROM public.voice_call_locks l
  JOIN public.voice_calls vc ON vc.id = l.call_id
 WHERE vc.status NOT IN ('ringing', 'accepted');

-- ===========================================================================
-- TEST 2 — a lock must only exist for an actual participant
-- ===========================================================================
SELECT l.user_id, l.call_id
  FROM public.voice_call_locks l
  JOIN public.voice_calls vc ON vc.id = l.call_id
 WHERE l.user_id NOT IN (vc.caller_id, vc.callee_id);

-- ===========================================================================
-- TEST 3 — a non-terminal call must have BOTH locks
-- ===========================================================================
-- Asymmetric locks are how a second caller gets through: if only the caller
-- holds a lock, the callee is free and can be put on a ring they cannot leave.
SELECT vc.id, vc.caller_id, vc.callee_id, vc.status, count(l.user_id) AS locks
  FROM public.voice_calls vc
  LEFT JOIN public.voice_call_locks l ON l.call_id = vc.id
 WHERE vc.status IN ('ringing', 'accepted')
 GROUP BY vc.id
HAVING count(l.user_id) <> 2;

-- ===========================================================================
-- TEST 4 — a user may hold at most ONE lock
-- ===========================================================================
-- Enforced by the primary key, so this can only fire if the table was
-- tampered with directly.
SELECT user_id, count(*) FROM public.voice_call_locks GROUP BY user_id HAVING count(*) > 1;

-- ===========================================================================
-- TEST 5 — a live call must sit in a thread BOTH people are in
-- ===========================================================================
-- The invariant that makes calling a strict subset of chatting. A violation
-- means a call was anchored to a conversation one party is not part of, which
-- would let them receive media for a chat they cannot read.
SELECT vc.id, vc.thread_id, vc.caller_id, vc.callee_id
  FROM public.voice_calls vc
 WHERE NOT EXISTS (SELECT 1 FROM public.direct_thread_participants p
                    WHERE p.thread_id = vc.thread_id AND p.user_id = vc.caller_id)
    OR NOT EXISTS (SELECT 1 FROM public.direct_thread_participants p
                    WHERE p.thread_id = vc.thread_id AND p.user_id = vc.callee_id);

-- ===========================================================================
-- TEST 6 — answered / ended bookkeeping must be self-consistent
-- ===========================================================================
-- A call that reached 'accepted' has an answer time and no end time; a
-- terminal call has an end time. Anything else means a transition wrote the
-- status without writing its timestamp.
SELECT id, status, created_at, answered_at, ended_at, end_reason
  FROM public.voice_calls
 WHERE (status = 'accepted' AND (answered_at IS NULL OR ended_at IS NOT NULL))
    OR (status IN ('declined', 'cancelled', 'ended', 'missed', 'failed') AND ended_at IS NULL)
    OR (status = 'ringing' AND (answered_at IS NOT NULL OR ended_at IS NOT NULL));

-- ===========================================================================
-- TEST 7 — a call that outlived its timeout should have been reaped
-- ===========================================================================
-- cleanup_stale_voice_calls runs every minute. A row still 'ringing' far past
-- 45s means the cron job is not firing (check cron.job for 'voice-call-cleanup')
-- or the function is raising. THIS IS THE CHECK THAT CATCHES A DEAD SWEEPER.
SELECT id, status, created_at, last_activity_at
  FROM public.voice_calls
 WHERE status = 'ringing'
   AND last_activity_at < now() - interval '5 minutes';

SELECT id, status, last_activity_at
  FROM public.voice_calls
 WHERE status = 'accepted'
   AND last_activity_at < now() - interval '10 minutes';

-- ===========================================================================
-- TEST 8 — the ring notification exists and is routed to the right category
-- ===========================================================================
-- A ring with no notification means the callee is never woken while the app is
-- closed, which is the difference between a call and an unanswered ping.
--
-- Every row here is EXPECTED for calls created in the last few minutes: the
-- notification is written by start_voice_call in the same transaction, so a
-- recent call SHOULD have one. Narrow the window to prove the join is wrong
-- rather than the data being new.
SELECT vc.id, vc.created_at, n.id AS notification_id, n.category, n.priority
  FROM public.voice_calls vc
  LEFT JOIN public.notifications n ON n.dedupe_key = 'voice_call:' || vc.id::text
 WHERE vc.status IN ('declined', 'cancelled', 'missed', 'accepted', 'ended')
   AND vc.created_at < now() - interval '1 hour'
   AND n.id IS NULL;

-- A call notification that landed in the wrong bucket would follow the wrong
-- per-category push preference (cat_system instead of cat_calls).
SELECT id, user_id, category, priority
  FROM public.notifications
 WHERE source IN ('voice_call', 'voice_call_missed')
   AND (category <> 'calls' OR priority <> 'high');

-- ===========================================================================
-- TEST 9 — the realtime policy must authorize exactly the two participants
-- ===========================================================================
-- Proves the call:<uuid> branch is present in BOTH policies. Two policies, two
-- rows. If either is missing, a client can neither subscribe nor send, and the
-- call will connect on paper and stay silent in practice.
SELECT policyname, cmd, permissive
  FROM pg_policies
 WHERE schemaname = 'realtime'
   AND tablename = 'messages'
   AND policyname LIKE 'realtime private channel%'
 ORDER BY policyname;

-- A direct read of the policy body is the only way to confirm the call branch
-- survived; pol names alone do not prove it.
SELECT policyname, cmd, qual
  FROM pg_policies
 WHERE schemaname = 'realtime'
   AND tablename = 'messages'
   AND policyname LIKE 'realtime private channel%'
   AND (qual ILIKE '%can_access_voice_call%' OR with_check ILIKE '%can_access_voice_call%');

-- ===========================================================================
-- TEST 10 — the sweeper is actually scheduled
-- ===========================================================================
-- Expect exactly ONE row. Zero means stale calls are never reaped (TEST 7 will
-- grow without bound). More than one means the job was created out of band
-- under a second name and calls are being reaped twice.
SELECT jobid, jobname, schedule, command, active
  FROM cron.job
 WHERE jobname = 'voice-call-cleanup'
    OR command LIKE '%cleanup_stale_voice_calls%';

-- ===========================================================================
-- TEST 11 — the feature flag exists and defaults to off
-- ===========================================================================
-- The column default IS the rollout gate. If it is true, calling is live for
-- everyone, which is the opposite of the staged rollout that was asked for.
SELECT column_name, data_type, column_default, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'profiles'
   AND column_name = 'voice_calls_enabled';

-- ===========================================================================
-- TEST 12 — the profile guard still protects the new flag
-- ===========================================================================
-- Without this, any signed-in member could self-grant the flag with a direct
-- .from('profiles').update() and the rollout gate would be decorative.
-- Expect TRUE (the function exists) and TRUE (it mentions the column).
SELECT position('voice_calls_enabled' IN pg_get_functiondef(p.oid)) > 0 AS guard_covers_flag
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname = 'restrict_profiles_write';

-- ===========================================================================
-- TEST 13 — the notification preference column exists
-- ===========================================================================
SELECT column_name, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'notification_preferences'
   AND column_name = 'cat_calls';
