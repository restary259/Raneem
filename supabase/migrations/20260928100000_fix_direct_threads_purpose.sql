-- Restore public.direct_threads.purpose.
--
-- The column exists on the live database and in the generated types, but no
-- migration in this repo ever created it — it was added out of band. Two
-- migrations now write it:
--   20260920130000_team_internal_chat_permission.sql
--       INSERT INTO public.direct_threads (created_by, purpose) VALUES (v_me, 'team_chat')
--   20260923094737_..._start_student_team_member_thread.sql
--       INSERT INTO public.direct_threads (created_by, purpose) VALUES (v_me, 'team_member')
--
-- Why this blocks everything else: `supabase db reset` replays this directory
-- in timestamp order against an empty database, so it currently fails at
-- 20260920130000 with
--   ERROR: column "purpose" of relation "direct_threads" does not exist
-- and no later migration — including the voice-call work — can be verified
-- locally until this is fixed.
--
-- Added nullable with no default, exactly matching the live schema that
-- src/integrations/supabase/types.ts was generated from (`purpose: string | null`
-- on Row, optional + nullable on Insert). NOT NULL DEFAULT would break inserts
-- that omit the column and would disagree with the generated types.
--
-- Deliberately NO CHECK constraint. This column predates its own migration, so
-- values written by code paths that only ever ran against the live database
-- cannot be enumerated from this repo; a CHECK would fail to validate against
-- real rows. The two values this repo writes are 'team_chat' and 'team_member'.

BEGIN;

ALTER TABLE public.direct_threads
  ADD COLUMN IF NOT EXISTS purpose text;

COMMENT ON COLUMN public.direct_threads.purpose IS
  'Why the one-to-one thread exists. Written by this repo as ''team_chat'' (start_team_chat_thread) or ''team_member'' (start_student_team_member_thread); NULL on threads created by start_direct_thread or the payout flow.';

-- Backfill 'team_member'. This one is load-bearing:
-- start_student_team_member_thread only reuses an existing thread when
-- purpose = 'team_member', so a student who already has a one-to-one thread
-- with the staff member handling their case would otherwise be handed a fresh
-- duplicate thread on every visit. Threads are one-to-one by construction
-- (both start functions insert exactly two participants), so requiring exactly
-- one student plus exactly one non-student participant is the precise
-- fingerprint of a thread this function created.
--
-- Threads linked to a payout_requests row are deliberately excluded: they keep
-- their own identity (StudentMessagesPage lists them in a separate tab) and are
-- already reachable through payout_requests.thread_id, and labelling them
-- 'team_member' would merge the two conversations in the student's inbox.
UPDATE public.direct_threads dt
   SET purpose = 'team_member'
 WHERE dt.purpose IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.payout_requests pr WHERE pr.thread_id = dt.id
   )
   AND 1 = (
     SELECT count(*) FROM public.direct_thread_participants p WHERE p.thread_id = dt.id
   )
   AND EXISTS (
     SELECT 1 FROM public.direct_thread_participants p
      WHERE p.thread_id = dt.id
        AND public.has_role(p.user_id, 'student'::app_role)
   )
   AND EXISTS (
     SELECT 1 FROM public.direct_thread_participants p
      WHERE p.thread_id = dt.id
        AND NOT public.has_role(p.user_id, 'student'::app_role)
   );

-- Backfill 'team_chat' for flag-enabled team-member pairs. Informational only:
-- start_team_chat_thread reuses any existing one-to-one thread for the pair
-- regardless of purpose, so this only makes existing data readable.
UPDATE public.direct_threads dt
   SET purpose = 'team_chat'
 WHERE dt.purpose IS NULL
   AND 1 = (
     SELECT count(*) FROM public.direct_thread_participants p WHERE p.thread_id = dt.id
   )
   AND 2 = (
     SELECT count(*) FROM public.direct_thread_participants p
      WHERE p.thread_id = dt.id
        AND public.has_role(p.user_id, 'team_member'::app_role)
   )
   AND (
     SELECT bool_or(COALESCE(pr.internal_team_chat_enabled, false))
       FROM public.direct_thread_participants p
       JOIN public.profiles pr ON pr.id = p.user_id
      WHERE p.thread_id = dt.id
   );

COMMIT;
