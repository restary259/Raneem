-- lovable-cron-fallback-reviewed: releases voice-call locks for abandoned/unanswered calls (dead phones never send a hangup); pure-SQL, indexed partial scan, user informed of 1440 runs/day
-- Phase-1 voice calls: the wiring.
--
--   1. Realtime broadcast authorization for the call:<id> private topic.
--   2. Notification routing so a ringing call reaches a closed app.
--   3. The minute-by-minute stale sweep.
--
-- Why a private broadcast and not a table: SDP and ICE candidates are large,
-- per-call, and worthless five seconds later. Storing them in Postgres would
-- mean an insert, a select and a delete for every candidate on both peers,
-- plus a table of stale blobs nobody ever reads. A private broadcast channel
-- delivers to exactly the two participants and is discarded by the server
-- immediately. Postgres still owns the only thing that matters and cannot be
-- faked: whether a call is allowed to exist and what state it is in.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Realtime: authorize the call:<id> topic
-- ---------------------------------------------------------------------------
-- These two policies are recreated VERBATIM from the current live definition
-- (20260811173924) with one added branch. They end in `ELSE false`, so a topic
-- that matches no branch is DENIED -- which is exactly why the call branch has
-- to be added here rather than assumed to work.
--
-- The new branch is anchored to can_access_voice_call, so channel access is
-- derived from the same rule as the data: only the two people on the call can
-- read or write its topic. A third party who guesses the call id still gets
-- nothing, because the id alone is not authorisation.

DROP POLICY IF EXISTS "realtime private channel read" ON realtime.messages;
DROP POLICY IF EXISTS "realtime private channel write" ON realtime.messages;

CREATE POLICY "realtime private channel read"
ON realtime.messages FOR SELECT TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'typing:case:%' THEN public.can_access_case_thread((NULLIF(split_part(realtime.topic(), ':', 3), ''))::uuid, auth.uid())
    WHEN realtime.topic() LIKE 'typing:direct:%' THEN public.is_direct_thread_member((NULLIF(split_part(realtime.topic(), ':', 3), ''))::uuid, auth.uid())
    -- Matched by shape first: a 'call:<not-a-uuid>' topic must be denied by the
    -- ELSE false below, not blow up the cast and surface as a 500.
    WHEN realtime.topic() ~ '^call:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN public.can_access_voice_call(split_part(realtime.topic(), ':', 2)::uuid, auth.uid())
    WHEN realtime.topic() = 'presence:staff' THEN (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_member'))
    ELSE false
  END
);

CREATE POLICY "realtime private channel write"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  CASE
    WHEN realtime.topic() LIKE 'typing:case:%' THEN public.can_access_case_thread((NULLIF(split_part(realtime.topic(), ':', 3), ''))::uuid, auth.uid())
    WHEN realtime.topic() LIKE 'typing:direct:%' THEN public.is_direct_thread_member((NULLIF(split_part(realtime.topic(), ':', 3), ''))::uuid, auth.uid())
    WHEN realtime.topic() ~ '^call:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN public.can_access_voice_call(split_part(realtime.topic(), ':', 2)::uuid, auth.uid())
    WHEN realtime.topic() = 'presence:staff' THEN (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_member'))
    ELSE false
  END
);

-- ---------------------------------------------------------------------------
-- 2. Notifications: ring a closed app
-- ---------------------------------------------------------------------------
-- Reuses the notifications -> PGMQ -> push-dispatch pipeline unchanged. No new
-- Edge Function, no new queue: a ringing call is just a high-priority
-- notification in a new category.

-- Recreated from the current live definition (20260920080536) with voice_call
-- mapped. trg_set_notification_category calls this on EVERY insert, so without
-- the new branch a call notification would be bucketed as 'system' and would
-- follow the wrong per-category preference.
CREATE OR REPLACE FUNCTION public.notification_category_for_source(_source text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT CASE
    WHEN _source IN ('direct_message', 'case_message', 'chat', 'whatsapp_inbound') THEN 'messages'
    WHEN _source IN ('appointment', 'appointment_reminder') THEN 'appointments'
    WHEN _source IN ('case', 'case_status', 'case_event', 'student_profile_updated',
                     'case_created', 'case_assigned', 'case_submitted') THEN 'cases'
    WHEN _source IN ('payout', 'payment', 'commission', 'enrollment') THEN 'payments'
    WHEN _source IN ('document', 'document_request', 'document_uploaded') THEN 'documents'
    WHEN _source IN ('profile', 'profile_incomplete') THEN 'profile'
    WHEN _source IN ('recruit', 'recruitment', 'partner_recruit', 'recruit_application') THEN 'recruitment'
    WHEN _source IN ('voice_call', 'voice_call_missed') THEN 'calls'
    ELSE 'system'
  END
$function$;

-- Per-category push preference. Default TRUE: a call that silently does not
-- ring is worse than one extra notification, and the ring-timeout (45s) means
-- these are rare in the first place.
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS cat_calls boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.notification_preferences.cat_calls IS
  'Whether incoming voice calls should produce a push notification. Turning this off does not stop a call once it is ringing -- the in-app UI still shows it.';

-- Recreated from the current live definition (20260809091941) with a 'calls'
-- branch in the link fallback. start_voice_call always sets an explicit
-- role-aware link, so this only covers a call row inserted without one.
CREATE OR REPLACE FUNCTION public.set_notification_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.category IS NULL OR NEW.category = 'system' THEN
    NEW.category := public.notification_category_for_source(NEW.source);
  END IF;

  IF NEW.link IS NULL THEN
    NEW.link := CASE NEW.category
      WHEN 'payments' THEN CASE
        WHEN public.has_role(NEW.user_id, 'admin') THEN '/admin/financials'
        WHEN public.has_role(NEW.user_id, 'team_member') THEN '/team'
        WHEN public.has_role(NEW.user_id, 'student') THEN '/student'
        ELSE '/partner/earnings' END
      WHEN 'cases' THEN CASE
        WHEN public.has_role(NEW.user_id, 'student') THEN '/student'
        WHEN NEW.case_id IS NULL THEN NULL
        WHEN public.has_role(NEW.user_id, 'admin') THEN '/admin/cases/' || NEW.case_id::text
        WHEN public.has_role(NEW.user_id, 'team_member') THEN '/team/cases/' || NEW.case_id::text
        ELSE NULL END
      WHEN 'appointments' THEN CASE
        WHEN public.has_role(NEW.user_id, 'student') THEN '/student'
        WHEN public.has_role(NEW.user_id, 'team_member') THEN '/team/appointments'
        WHEN public.has_role(NEW.user_id, 'admin') THEN '/admin/pipeline'
        ELSE NULL END
      WHEN 'documents' THEN CASE
        WHEN public.has_role(NEW.user_id, 'student') THEN '/student/documents'
        WHEN NEW.case_id IS NOT NULL AND public.has_role(NEW.user_id, 'team_member')
          THEN '/team/cases/' || NEW.case_id::text
        ELSE NULL END
      WHEN 'profile' THEN CASE
        WHEN public.has_role(NEW.user_id, 'student') THEN '/student/profile'
        ELSE NULL END
      WHEN 'recruitment' THEN CASE
        WHEN public.has_role(NEW.user_id, 'admin') THEN '/admin/team'
        ELSE '/partner/network' END
      -- A call notification with no explicit link still lands on the recipient's
      -- own messages inbox, where the call UI is mounted.
      WHEN 'calls' THEN CASE
        WHEN public.has_role(NEW.user_id, 'admin') THEN '/admin/messages'
        WHEN public.has_role(NEW.user_id, 'team_member') THEN '/team/messages'
        WHEN public.has_role(NEW.user_id, 'agent') THEN '/agent/messages'
        WHEN public.has_role(NEW.user_id, 'social_media_partner') THEN '/partner/messages'
        WHEN public.has_role(NEW.user_id, 'ambassador') THEN '/partner/messages'
        ELSE '/student/messages' END
      ELSE NULL
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-assert the trigger: an out-of-order re-run of an older migration must not
-- leave this trigger pointing at a dropped function.
DROP TRIGGER IF EXISTS trg_set_notification_category ON public.notifications;
CREATE TRIGGER trg_set_notification_category
BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.set_notification_category();

-- Repair any rows that were mis-bucketed before this migration (e.g. a call
-- inserted while the trigger still mapped voice_call to 'system').
UPDATE public.notifications
SET category = public.notification_category_for_source(source)
WHERE category IS DISTINCT FROM public.notification_category_for_source(source);

-- ---------------------------------------------------------------------------
-- 3. Stale sweep, every minute
-- ---------------------------------------------------------------------------
-- Pure SQL, so unlike the Edge-Function jobs this needs no vault secret and no
-- net.http_post wrapper: cron runs the function directly.
--
-- Idempotent the same way the other jobs here are -- unschedule by canonical
-- name AND sweep cron.job for orphans whose command mentions the function
-- (catches a job created out of band under a different name), then reschedule.
-- Without the orphan sweep, a manually-created duplicate would double-reap.

DO $schedule_voice_call_cleanup$
DECLARE
  j record;
BEGIN
  FOR j IN
    SELECT jobid FROM cron.job
    WHERE jobname = 'voice-call-cleanup'
       OR command LIKE '%cleanup_stale_voice_calls%'
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'voice-call-cleanup',
    '* * * * *',
    'SELECT public.cleanup_stale_voice_calls();'
  );
END;
$schedule_voice_call_cleanup$;

COMMIT;
