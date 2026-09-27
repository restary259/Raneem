-- Phase-1 voice calls: the server-side state machine.
--
-- Everything that MUTATES a call lives here, and nothing else can. The tables
-- in 20260928110000 grant authenticated users SELECT only, so these functions
-- are the single trust boundary between "the browser decided something" and
-- "a call exists".
--
-- Rules this file enforces:
--   * The actor is always auth.uid(). No function takes an "act as" argument,
--     so a client cannot ring, answer, or hang up on someone else's behalf.
--   * Every transition is conditional on the CURRENT status, so a replayed or
--     retried request can never walk a call backwards or double-apply. A
--     transition that is already done RAISEs rather than silently succeeding,
--     because the client needs to know its view was stale.
--   * Terminal transitions release BOTH locks in the same transaction, so a
--     user can never be left locked out of future calls by a half-finished
--     hangup.
--   * A call can only exist inside a thread both people already share
--     (can_communicate_directly, from 20260928110000).
--
-- SDP and ICE are NOT handled here. They ride the private Realtime broadcast
-- topic call:<id>; the client can re-read this state at any time to recover
-- from a reload, which is why get_active_voice_call() exists.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Ring
-- ---------------------------------------------------------------------------
-- The callee becomes the WebRTC OFFERER when they accept. That matters: iOS
-- only grants microphone access inside a user gesture, and the accept button
-- IS the gesture. The caller has already acquired the mic to ring, so this
-- ordering costs nothing and removes the most common mobile failure mode.

CREATE OR REPLACE FUNCTION public.start_voice_call(
  p_callee_id uuid,
  p_thread_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $start_voice_call$
DECLARE
  v_me uuid := auth.uid();
  v_callee uuid := p_callee_id;
  v_thread uuid;
  v_call uuid;
  v_caller_name text;
  v_link text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_callee IS NULL OR v_callee = v_me THEN
    RAISE EXCEPTION 'Pick another person to call';
  END IF;

  -- One predicate answers "may we talk at all": both profiles live, both have
  -- the feature enabled, and they already share a direct thread.
  IF NOT public.can_communicate_directly(v_me, v_callee) THEN
    RAISE EXCEPTION 'You cannot call this person';
  END IF;

  -- Serialise concurrent starts. Two locks are taken in a DETERMINISTIC order
  -- (ascending uuid) so that A rings B while B rings A cannot deadlock.
  -- Without this, both transactions could pass the "are they free?" check and
  -- then race on the voice_call_locks primary key.
  PERFORM pg_advisory_xact_lock(hashtextextended(LEAST(v_me, v_callee)::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(GREATEST(v_me, v_callee)::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.voice_call_locks
    WHERE user_id IN (v_me, v_callee)
  ) THEN
    RAISE EXCEPTION 'One of you is already on another call';
  END IF;

  -- Resolve the shared thread. An explicit thread must genuinely be shared by
  -- both of them, otherwise a client could anchor a call to a third party's
  -- conversation and read its existence.
  IF p_thread_id IS NOT NULL THEN
    SELECT 1 INTO v_thread
    FROM public.direct_thread_participants p1
    JOIN public.direct_thread_participants p2
      ON p2.thread_id = p1.thread_id
    WHERE p1.thread_id = p_thread_id
      AND p1.user_id = v_me
      AND p2.user_id = v_callee
    LIMIT 1;

    IF v_thread IS NULL THEN
      RAISE EXCEPTION 'That conversation is not shared with this person';
    END IF;
  ELSE
    SELECT p1.thread_id INTO v_thread
    FROM public.direct_thread_participants p1
    JOIN public.direct_thread_participants p2
      ON p2.thread_id = p1.thread_id
    WHERE p1.user_id = v_me
      AND p2.user_id = v_callee
    LIMIT 1;

    IF v_thread IS NULL THEN
      RAISE EXCEPTION 'You need an existing conversation before you can call';
    END IF;
  END IF;

  INSERT INTO public.voice_calls (thread_id, caller_id, callee_id, status)
  VALUES (v_thread, v_me, v_callee, 'ringing')
  RETURNING id INTO v_call;

  -- PK on voice_call_locks.user_id is the real enforcement of "one call per
  -- user"; the advisory locks above only make the friendly error message
  -- correct, this INSERT is what actually refuses the second call.
  INSERT INTO public.voice_call_locks (user_id, call_id)
  VALUES (v_me, v_call), (v_callee, v_call);

  -- Wake the callee even when the app is closed. High priority so quiet hours
  -- do not swallow a ringing phone; the link is role-aware because there is no
  -- single /messages route in this app.
  SELECT COALESCE(NULLIF(full_name, ''), 'Someone') INTO v_caller_name
  FROM public.profiles WHERE id = v_me;

  v_link := CASE
    WHEN public.has_role(v_callee, 'admin'::app_role) THEN '/admin/messages?call=' || v_call::text
    WHEN public.has_role(v_callee, 'team_member'::app_role) THEN '/team/messages?call=' || v_call::text
    WHEN public.has_role(v_callee, 'agent'::app_role) THEN '/agent/messages?call=' || v_call::text
    WHEN public.has_role(v_callee, 'social_media_partner'::app_role) THEN '/partner/messages?call=' || v_call::text
    WHEN public.has_role(v_callee, 'ambassador'::app_role) THEN '/partner/messages?call=' || v_call::text
    ELSE '/student/messages?call=' || v_call::text
  END;

  INSERT INTO public.notifications
    (user_id, title, body, title_en, title_ar, body_en, body_ar,
     source, category, priority, link, dedupe_key)
  VALUES
    (v_callee,
     'Incoming voice call',
     v_caller_name || ' is calling you',
     'Incoming voice call',
     'مكالمة صوتية واردة',
     v_caller_name || ' is calling you',
     v_caller_name || ' يتصل بك',
     'voice_call',
     'calls',
     'high',
     v_link,
     'voice_call:' || v_call::text)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN v_call;
END;
$start_voice_call$;

REVOKE ALL ON FUNCTION public.start_voice_call(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_voice_call(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Shared terminal transition
-- ---------------------------------------------------------------------------
-- One implementation of "this call is over" so decline / cancel / hangup /
-- stale-sweep cannot drift apart on the details that matter: the status map and
-- the lock release.
--
-- The call row is taken FOR UPDATE so a concurrent accept cannot interleave and
-- leave a lock behind on an already-answered call.
--
-- Internal: revoked from authenticated, callable only by the SECURITY DEFINER
-- functions in this file (which run as the owner).

CREATE OR REPLACE FUNCTION public.finish_voice_call(
  p_call_id uuid,
  p_actor uuid,
  p_end_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $finish_voice_call$
DECLARE
  v_status text;
  v_caller uuid;
  v_callee uuid;
BEGIN
  SELECT status, caller_id, callee_id
    INTO v_status, v_caller, v_callee
  FROM public.voice_calls
  WHERE id = p_call_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Call not found';
  END IF;

  -- Already terminal: releasing locks is idempotent, so a cleanup sweep that
  -- races a hangup does not error. Callers that need "did it change?" check the
  -- status before calling.
  IF v_status NOT IN ('ringing', 'accepted') THEN
    DELETE FROM public.voice_call_locks WHERE call_id = p_call_id;
    RETURN;
  END IF;

  -- The terminal STATUS is driven by the end reason, which each caller already
  -- knows, and only falls back to "who stopped it" for the generic 'hangup'
  -- path. Keying off the reason (not the actor) is what lets the cron sweep
  -- pass a NULL actor and still record a ring that timed out as 'missed'.
  UPDATE public.voice_calls
     SET status = CASE
           WHEN v_status = 'accepted' THEN 'ended'
           WHEN p_end_reason = 'missed' THEN 'missed'
           WHEN p_end_reason = 'declined' THEN 'declined'
           WHEN p_end_reason = 'cancelled' THEN 'cancelled'
           WHEN p_end_reason = 'stale' THEN 'ended'
           -- 'hangup' on a still-ringing call: whoever dropped it decides how it
           -- is recorded, so the other side sees decline vs cancel correctly.
           WHEN p_actor = v_callee THEN 'declined'
           WHEN p_actor = v_caller THEN 'cancelled'
           ELSE 'ended'
         END,
         ended_at = now(),
         ended_by = p_actor,
         end_reason = p_end_reason,
         last_activity_at = now()
   WHERE id = p_call_id;

  DELETE FROM public.voice_call_locks WHERE call_id = p_call_id;
END;
$finish_voice_call$;

REVOKE ALL ON FUNCTION public.finish_voice_call(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Answer
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_voice_call(p_call_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $accept_voice_call$
DECLARE
  v_me uuid := auth.uid();
  v_status text;
  v_caller uuid;
  v_callee uuid;
  v_thread uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT status, caller_id, callee_id, thread_id
    INTO v_status, v_caller, v_callee, v_thread
  FROM public.voice_calls
  WHERE id = p_call_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Call not found';
  END IF;

  IF v_callee <> v_me THEN
    RAISE EXCEPTION 'Only the person being called can answer';
  END IF;

  IF v_status <> 'ringing' THEN
    RAISE EXCEPTION 'This call is no longer ringing';
  END IF;

  -- The sweeper runs every minute, so a client that accepts between sweeps can
  -- find a ring that is already past the timeout. Answer it anyway if nobody
  -- has marked it missed yet: the person IS there, which is the whole point.
  UPDATE public.voice_calls
     SET status = 'accepted',
         answered_at = now(),
         last_activity_at = now()
   WHERE id = p_call_id;

  RETURN jsonb_build_object(
    'id', p_call_id,
    'thread_id', v_thread,
    'caller_id', v_caller,
    'callee_id', v_callee,
    'status', 'accepted'
  );
END;
$accept_voice_call$;

REVOKE ALL ON FUNCTION public.accept_voice_call(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_voice_call(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Decline / cancel
-- ---------------------------------------------------------------------------
-- Separate from end_voice_call so the client's intent is explicit and the error
-- the other party gets is accurate ("declined" vs "cancelled").

CREATE OR REPLACE FUNCTION public.decline_voice_call(p_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $decline_voice_call$
DECLARE
  v_me uuid := auth.uid();
  v_status text;
  v_callee uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT status, callee_id INTO v_status, v_callee
  FROM public.voice_calls WHERE id = p_call_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Call not found';
  END IF;
  IF v_callee <> v_me THEN
    RAISE EXCEPTION 'Only the person being called can decline';
  END IF;
  IF v_status <> 'ringing' THEN
    RAISE EXCEPTION 'This call is no longer ringing';
  END IF;

  PERFORM public.finish_voice_call(p_call_id, v_me, 'declined');
END;
$decline_voice_call$;

REVOKE ALL ON FUNCTION public.decline_voice_call(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_voice_call(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_voice_call(p_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $cancel_voice_call$
DECLARE
  v_me uuid := auth.uid();
  v_status text;
  v_caller uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT status, caller_id INTO v_status, v_caller
  FROM public.voice_calls WHERE id = p_call_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Call not found';
  END IF;
  IF v_caller <> v_me THEN
    RAISE EXCEPTION 'Only the caller can cancel';
  END IF;
  IF v_status <> 'ringing' THEN
    RAISE EXCEPTION 'This call is no longer ringing';
  END IF;

  PERFORM public.finish_voice_call(p_call_id, v_me, 'cancelled');
END;
$cancel_voice_call$;

REVOKE ALL ON FUNCTION public.cancel_voice_call(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_voice_call(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Hang up
-- ---------------------------------------------------------------------------
-- The single "leave this call" entry point. Works from both ringing and
-- accepted so the client does not have to branch; finish_voice_call maps the
-- status correctly either way.

CREATE OR REPLACE FUNCTION public.end_voice_call(p_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $end_voice_call$
DECLARE
  v_me uuid := auth.uid();
  v_status text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.can_access_voice_call(p_call_id, v_me) THEN
    RAISE EXCEPTION 'You are not part of this call';
  END IF;

  SELECT status INTO v_status
  FROM public.voice_calls WHERE id = p_call_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Call not found';
  END IF;
  IF v_status NOT IN ('ringing', 'accepted') THEN
    RAISE EXCEPTION 'This call has already ended';
  END IF;

  PERFORM public.finish_voice_call(p_call_id, v_me, 'hangup');
END;
$end_voice_call$;

REVOKE ALL ON FUNCTION public.end_voice_call(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_voice_call(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Heartbeat
-- ---------------------------------------------------------------------------
-- The client beats roughly every 30s while connected. last_activity_at is what
-- cleanup_stale_voice_calls() reads, so a phone that loses network mid-call is
-- reaped instead of holding a lock forever.

CREATE OR REPLACE FUNCTION public.heartbeat_voice_call(p_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $heartbeat_voice_call$
DECLARE
  v_me uuid := auth.uid();
  v_status text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.can_access_voice_call(p_call_id, v_me) THEN
    RAISE EXCEPTION 'You are not part of this call';
  END IF;

  SELECT status INTO v_status
  FROM public.voice_calls WHERE id = p_call_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Call not found';
  END IF;

  -- Heartbeat is a keep-alive, not a transition. A terminal call ignores it
  -- rather than raising, so a beat that races a hangup is harmless.
  IF v_status = 'accepted' THEN
    UPDATE public.voice_calls
       SET last_activity_at = now()
     WHERE id = p_call_id;
  END IF;
END;
$heartbeat_voice_call$;

REVOKE ALL ON FUNCTION public.heartbeat_voice_call(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.heartbeat_voice_call(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Reads / recovery
-- ---------------------------------------------------------------------------
-- get_active_voice_call() is the reload safety net: on mount the provider asks
-- "am I already in something?" and, if so, rejoins the call:<id> topic and
-- renegotiates instead of leaving the user talking to nobody.

CREATE OR REPLACE FUNCTION public.get_active_voice_call()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $get_active_voice_call$
  -- Runs as the owner, so can_access_voice_call (also SECURITY DEFINER) is
  -- applied explicitly rather than relying on voice_calls' own RLS: a
  -- SECURITY DEFINER function bypasses the RLS of the table it selects from.
  SELECT jsonb_build_object(
           'id', vc.id,
           'thread_id', vc.thread_id,
           'caller_id', vc.caller_id,
           'callee_id', vc.callee_id,
           'status', vc.status,
           'created_at', vc.created_at,
           'answered_at', vc.answered_at,
           'ended_at', vc.ended_at,
           'ended_by', vc.ended_by,
           'end_reason', vc.end_reason,
           'last_activity_at', vc.last_activity_at
         )
    FROM public.voice_calls vc
   WHERE (vc.caller_id = auth.uid() OR vc.callee_id = auth.uid())
     AND vc.status IN ('ringing', 'accepted')
   ORDER BY vc.created_at DESC
   LIMIT 1
$get_active_voice_call$;

REVOKE ALL ON FUNCTION public.get_active_voice_call() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_voice_call() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_voice_call(p_call_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $get_voice_call$
  SELECT jsonb_build_object(
           'id', vc.id,
           'thread_id', vc.thread_id,
           'caller_id', vc.caller_id,
           'callee_id', vc.callee_id,
           'status', vc.status,
           'created_at', vc.created_at,
           'answered_at', vc.answered_at,
           'ended_at', vc.ended_at,
           'ended_by', vc.ended_by,
           'end_reason', vc.end_reason,
           'last_activity_at', vc.last_activity_at
         )
    FROM public.voice_calls vc
   WHERE vc.id = p_call_id
     AND public.can_access_voice_call(vc.id, auth.uid())
$get_voice_call$;

REVOKE ALL ON FUNCTION public.get_voice_call(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_voice_call(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Stale sweep
-- ---------------------------------------------------------------------------
-- Ringing that nobody answers becomes 'missed'; a connected call whose client
-- stopped beating becomes 'ended'. Without this, a phone that goes to sleep
-- mid-call keeps its lock and the user can never start another one.
--
-- Timeouts are multiples of the 30s client heartbeat:
--   ringing  -> 45s  (about 1.5 missed beats of ringing UI)
--   accepted -> 120s (about 4 missed beats; survives one dropped request)

CREATE OR REPLACE FUNCTION public.cleanup_stale_voice_calls()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $cleanup_stale_voice_calls$
DECLARE
  v_call record;
  v_count integer := 0;
BEGIN
  -- FOR UPDATE SKIP LOCKED: a sweep that is still running when the next one
  -- fires must not block on rows a live hangup is already changing.
  FOR v_call IN
    SELECT id, callee_id, caller_id, status
    FROM public.voice_calls
    WHERE status IN ('ringing', 'accepted')
      AND last_activity_at < now() - (
        CASE WHEN status = 'ringing' THEN interval '45 seconds' ELSE interval '120 seconds' END
      )
    ORDER BY last_activity_at
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.finish_voice_call(
      v_call.id,
      NULL,
      CASE WHEN v_call.status = 'ringing' THEN 'missed' ELSE 'stale' END
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$cleanup_stale_voice_calls$;

REVOKE ALL ON FUNCTION public.cleanup_stale_voice_calls() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_voice_calls() TO service_role;

COMMIT;
