-- Phase-1 voice calls: schema, RLS, feature flag, and the authorization
-- predicates every later voice-call function depends on.
--
-- Scope: AUDIO ONLY. No recording, no transcription, no media storage, no
-- group calls. SDP/ICE never touches Postgres -- it rides private Realtime
-- broadcast topics (added in 20260928130000). This table is the server-side
-- AUTHORITY for who may talk to whom and what state a call is in; the browser
-- never decides either.
--
-- Authorization has exactly ONE source of truth: the existing
-- direct_thread_participants relationship. A voice call is "chat, with sound",
-- so the gate is "these two people already have a direct-message thread" plus
-- "both have the feature enabled". Deliberately NO second hard-coded role
-- matrix -- adding one would let chat and calling disagree about who is
-- allowed to talk to whom.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Per-profile feature flag
-- ---------------------------------------------------------------------------
-- Default OFF. Staged rollout: enable per profile from Admin > Members. Admins
-- always have access (has_voice_calls_access below) so the feature is testable
-- before any member flag is flipped -- same posture as
-- internal_team_chat_enabled (20260920130000) and whatsapp_inbox_enabled
-- (20260920122000).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS voice_calls_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.voice_calls_enabled IS
  'Admin-only per-profile gate for WebRTC voice calls. Both parties must be enabled (admins bypass) before a call can start.';

-- ---------------------------------------------------------------------------
-- 2. Calls
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.voice_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Every call is anchored to an existing direct thread. NOT NULL by design:
  -- there is no "cold call" -- you can only ring someone you already talk to.
  thread_id uuid NOT NULL REFERENCES public.direct_threads(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  callee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ringing',
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  ended_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  end_reason text,
  -- Drives the staleness sweep. Bumped by every state change and by the
  -- heartbeat, so cleanup_stale_voice_calls() can end abandoned calls.
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voice_calls_caller_not_callee CHECK (caller_id <> callee_id),
  CONSTRAINT voice_calls_status_check
    CHECK (status IN ('ringing', 'accepted', 'declined', 'cancelled', 'ended', 'missed', 'failed')),
  CONSTRAINT voice_calls_end_reason_check
    CHECK (end_reason IS NULL OR end_reason IN ('hangup', 'declined', 'cancelled', 'missed', 'failed', 'stale'))
);

COMMENT ON TABLE public.voice_calls IS
  'Server-side authority for a voice call. SDP/ICE are NOT stored here -- they ride the private Realtime topic call:<id>.';

-- One live call per user, enforced by the PK on voice_call_locks.user_id.
-- A ring that finds the callee already locked is rejected, so a user can never
-- be in two ringing calls at once.
CREATE TABLE IF NOT EXISTS public.voice_call_locks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  call_id uuid NOT NULL REFERENCES public.voice_calls(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.voice_call_locks IS
  'At most one non-terminal call per user. Rows are inserted by start_voice_call and deleted by every terminal transition, in the same transaction.';

-- Ringing lookups ("is anyone calling me?"), the "call this thread" button, and
-- the staleness sweep. Partial on non-terminal so terminal history stays cheap.
CREATE INDEX IF NOT EXISTS idx_voice_calls_callee_active
  ON public.voice_calls (callee_id, created_at DESC)
  WHERE status IN ('ringing', 'accepted');

CREATE INDEX IF NOT EXISTS idx_voice_calls_caller_created
  ON public.voice_calls (caller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_calls_thread_created
  ON public.voice_calls (thread_id, created_at DESC);

-- cleanup_stale_voice_calls() scans exactly this predicate every minute.
CREATE INDEX IF NOT EXISTS idx_voice_calls_stale
  ON public.voice_calls (last_activity_at)
  WHERE status IN ('ringing', 'accepted');

CREATE INDEX IF NOT EXISTS idx_voice_call_locks_call
  ON public.voice_call_locks (call_id);

-- ---------------------------------------------------------------------------
-- 3. Grants + RLS
-- ---------------------------------------------------------------------------
-- Clients get SELECT on the call row and NOTHING else. Every mutation is a
-- SECURITY DEFINER RPC that validates the transition server-side, so a caller
-- cannot hand-insert a call, flip its status, or release another user's lock.
-- This is the same RPC-only-write shape as direct_threads/direct_messages.

ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_call_locks ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.voice_calls TO authenticated;
GRANT SELECT ON public.voice_call_locks TO authenticated;
GRANT ALL ON public.voice_calls TO service_role;
GRANT ALL ON public.voice_call_locks TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Authorization predicates
-- ---------------------------------------------------------------------------
-- Read helpers are SECURITY DEFINER so the RLS policies below can call them
-- without recursing through voice_calls' own policy.

-- Admins always have access so the feature is testable before any member flag
-- is enabled. Everyone else needs voice_calls_enabled on a live profile.
CREATE OR REPLACE FUNCTION public.has_voice_calls_access(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user IS NOT NULL
    AND (
      public.has_role(p_user, 'admin'::app_role)
      OR COALESCE(
        (SELECT p.voice_calls_enabled
           FROM public.profiles p
          WHERE p.id = p_user
            AND p.deleted_at IS NULL),
        false
      )
    )
$$;

REVOKE ALL ON FUNCTION public.has_voice_calls_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_voice_calls_access(uuid) TO authenticated, service_role;

-- "These two may talk." Requires: two distinct live profiles, the feature
-- enabled for BOTH, and an existing shared direct thread.
--
-- The thread requirement is what makes the audio surface a strict subset of the
-- chat surface. It also means the student DM gate, the payout-thread carve-out
-- and the team-member flag are all inherited automatically: if a student cannot
-- message someone, they cannot call them either.
CREATE OR REPLACE FUNCTION public.can_communicate_directly(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_a IS NOT NULL
    AND p_b IS NOT NULL
    AND p_a <> p_b
    AND public.has_voice_calls_access(p_a)
    AND public.has_voice_calls_access(p_b)
    -- Both profiles exist and are not soft-deleted.
    AND EXISTS (
      SELECT 1
      FROM public.profiles pa
      JOIN public.profiles pb ON pb.id = p_b AND pb.deleted_at IS NULL
      WHERE pa.id = p_a AND pa.deleted_at IS NULL
    )
    -- They already share a direct thread. Because direct threads are one-to-one
    -- by construction, a single joined pair is the whole proof.
    AND EXISTS (
      SELECT 1
      FROM public.direct_thread_participants p1
      JOIN public.direct_thread_participants p2
        ON p2.thread_id = p1.thread_id
      WHERE p1.user_id = p_a
        AND p2.user_id = p_b
    )
$$;

REVOKE ALL ON FUNCTION public.can_communicate_directly(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_communicate_directly(uuid, uuid) TO authenticated, service_role;

-- "May this user see this call." Deliberately does NOT require the feature
-- flag: a user whose admin just revoked the flag must still be able to see
-- (and hang up) a call they are already in, otherwise revocation would strand
-- them in a ringing/accepted call they cannot leave.
CREATE OR REPLACE FUNCTION public.can_access_voice_call(p_call_id uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.voice_calls vc
    WHERE vc.id = p_call_id
      AND (vc.caller_id = p_user OR vc.callee_id = p_user)
  )
$$;

REVOKE ALL ON FUNCTION public.can_access_voice_call(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_voice_call(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Participants read their calls" ON public.voice_calls;
CREATE POLICY "Participants read their calls"
ON public.voice_calls FOR SELECT TO authenticated
USING (public.can_access_voice_call(id, auth.uid()));

-- Locks are readable so the client can tell "am I already in a call" without an
-- extra RPC, but they expose no other user's data: a user only ever sees their
-- own row. The call_id it points at is a call they are a participant of.
DROP POLICY IF EXISTS "Users read their own call lock" ON public.voice_call_locks;
CREATE POLICY "Users read their own call lock"
ON public.voice_call_locks FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies for authenticated on either table: all
-- writes go through the SECURITY DEFINER RPCs in 20260928120000.

-- ---------------------------------------------------------------------------
-- 5. keep the profile guard strict for the new flag
-- ---------------------------------------------------------------------------
-- restrict_profiles_write is recreated VERBATIM from the current live
-- definition (20260920122000) with one addition: voice_calls_enabled.
-- Without this a member could grant themselves the flag with a direct
-- .from('profiles').update() and the rollout gate would mean nothing.

CREATE OR REPLACE FUNCTION public.restrict_profiles_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_jwt_role text;
BEGIN
  BEGIN
    v_jwt_role := current_setting('request.jwt.claims', true)::json->>'role';
  EXCEPTION WHEN others THEN
    v_jwt_role := NULL;
  END;

  IF public.has_role(auth.uid(), 'admin')
     OR v_jwt_role = 'service_role'
     OR session_user IN ('service_role', 'postgres', 'supabase_admin')
  THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.commission_amount := 0;
    NEW.student_status := 'not_applied';
    NEW.visa_status := 'not_applied';
    NEW.must_change_password := false;
    NEW.case_id := NULL;
    NEW.linked_case_id := NULL;
    NEW.deleted_at := NULL;
    NEW.iban_confirmed_at := NULL;
    NEW.is_manager := false;
    NEW.referral_code_enabled := false;
    NEW.apply_form_enabled := false;
    NEW.whatsapp_inbox_enabled := false;
    NEW.voice_calls_enabled := false;
    NEW.deactivated_by := NULL;
    NEW.deactivated_reason := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.commission_amount IS DISTINCT FROM OLD.commission_amount THEN
      RAISE EXCEPTION 'Non-admin users cannot change commission_amount';
    END IF;
    IF NEW.student_status IS DISTINCT FROM OLD.student_status THEN
      RAISE EXCEPTION 'Non-admin users cannot change student_status';
    END IF;
    IF NEW.visa_status IS DISTINCT FROM OLD.visa_status THEN
      RAISE EXCEPTION 'Non-admin users cannot change visa_status';
    END IF;
    IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
      RAISE EXCEPTION 'Non-admin users cannot change must_change_password';
    END IF;
    IF NEW.case_id IS DISTINCT FROM OLD.case_id THEN
      RAISE EXCEPTION 'Non-admin users cannot change case_id';
    END IF;
    IF NEW.linked_case_id IS DISTINCT FROM OLD.linked_case_id THEN
      RAISE EXCEPTION 'Non-admin users cannot change linked_case_id';
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'Non-admin users cannot change deleted_at';
    END IF;
    IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
      RAISE EXCEPTION 'Non-admin users cannot change referral_code';
    END IF;
    IF NEW.referral_code_enabled IS DISTINCT FROM OLD.referral_code_enabled THEN
      RAISE EXCEPTION 'Non-admin users cannot change referral_code_enabled';
    END IF;
    IF NEW.apply_form_enabled IS DISTINCT FROM OLD.apply_form_enabled THEN
      RAISE EXCEPTION 'Non-admin users cannot change apply_form_enabled';
    END IF;
    IF NEW.whatsapp_inbox_enabled IS DISTINCT FROM OLD.whatsapp_inbox_enabled THEN
      RAISE EXCEPTION 'Non-admin users cannot change whatsapp_inbox_enabled';
    END IF;
    IF NEW.voice_calls_enabled IS DISTINCT FROM OLD.voice_calls_enabled THEN
      RAISE EXCEPTION 'Non-admin users cannot change voice_calls_enabled';
    END IF;
    IF NEW.is_manager IS DISTINCT FROM OLD.is_manager THEN
      RAISE EXCEPTION 'Non-admin users cannot change is_manager';
    END IF;
    IF NEW.deactivated_by IS DISTINCT FROM OLD.deactivated_by
       OR NEW.deactivated_reason IS DISTINCT FROM OLD.deactivated_reason THEN
      RAISE EXCEPTION 'Non-admin users cannot change account deactivation fields';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Non-admin users cannot change the profile id';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Non-admin users cannot change email';
    END IF;
    IF NEW.iban_confirmed_at IS DISTINCT FROM OLD.iban_confirmed_at THEN
      RAISE EXCEPTION 'Non-admin users cannot change iban_confirmed_at';
    END IF;
    IF OLD.iban_confirmed_at IS NOT NULL AND (
         NEW.iban IS DISTINCT FROM OLD.iban
      OR NEW.bank_name IS DISTINCT FROM OLD.bank_name
      OR NEW.bank_branch IS DISTINCT FROM OLD.bank_branch
      OR NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number
    ) THEN
      RAISE EXCEPTION 'Confirmed bank details can only be changed by an admin';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

-- Belt and braces for an out-of-order re-run of an older migration: re-assert
-- the trigger itself, not just the function body (same posture as
-- 20260901000000_reassert_clear_must_change_password.sql).
DROP TRIGGER IF EXISTS restrict_profiles_write ON public.profiles;
CREATE TRIGGER restrict_profiles_write
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.restrict_profiles_write();

COMMIT;
