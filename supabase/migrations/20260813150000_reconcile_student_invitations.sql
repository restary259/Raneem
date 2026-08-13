-- ============================================================================
-- Reconcile student invitations with real account state
-- ============================================================================
-- A pending user_invitations row was only ever closed by accept-invitation
-- (the activation-link endpoint). Manual account creation paths
-- (create-student-from-case manual mode, create-student-standalone, and the
-- already-activated invite branch) created an active auth.users + user_roles
-- student account but never touched the invitation, so it stayed
-- status='pending' forever and kept rendering under "Pending invitations" —
-- a contradictory "active account + pending invitation" state.
--
-- This migration adds defense-in-depth:
--   1. A SECURITY DEFINER trigger that closes matching pending student
--      invitations whenever a student role is inserted (covers ANY path that
--      provisions a student role, not only the edge functions).
--   2. A one-time data cleanup that closes existing stale pending student
--      invitations whose email already belongs to an active student account.
--
-- Reconciliation is always pending → accepted (never DELETE). It is idempotent
-- and never weakens RLS.
-- ============================================================================

-- ── 1. Trigger function ─────────────────────────────────────────────────────
-- Fires AFTER INSERT on public.user_roles. The edge functions upsert with
-- onConflict user_id + ignoreDuplicates, so the trigger only fires for a
-- genuine new role row — never for a no-op duplicate. It joins the user's
-- profile email to user_invitations.invited_email and closes every pending
-- student invitation for that email. Updating user_invitations cannot recurse
-- back into user_roles (different table), and the user_invitations
-- update_updated_at trigger is a BEFORE UPDATE row trigger that does not chain.
CREATE OR REPLACE FUNCTION public.reconcile_student_invitations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
BEGIN
  -- Only student role provisioning reconciles student invitations.
  IF NEW.role IS DISTINCT FROM 'student' THEN
    RETURN NEW;
  END IF;

  -- The profile row is the email source of truth (profiles.id is the PK, so at
  -- most one row per user_id). If no profile exists yet (should not happen —
  -- on_auth_user_created creates it), there is nothing to match.
  SELECT lower(email) INTO v_email
  FROM public.profiles
  WHERE id = NEW.user_id
  LIMIT 1;

  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotent: only pending rows flip; accepted/revoked rows are untouched.
  -- accepted_user_id records the account that satisfied the invitation.
  UPDATE public.user_invitations
  SET status = 'accepted',
      accepted_at = now(),
      accepted_user_id = NEW.user_id
  WHERE lower(invited_email) = v_email
    AND invitation_type = 'student'
    AND status = 'pending';

  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reconcile_student_invitations() TO service_role;

DROP TRIGGER IF EXISTS trg_reconcile_student_invitations ON public.user_roles;
CREATE TRIGGER trg_reconcile_student_invitations
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.reconcile_student_invitations();

-- ── 2. Data cleanup (one-time, idempotent) ──────────────────────────────────
-- Close existing stale pending student invitations whose invited email already
-- belongs to an active (non-deactivated) student account. Mirrors the
-- correlation in supabase/diagnostics/account_lifecycle_audit.sql query 7.
-- Only pending → accepted (sets accepted_at, accepted_user_id); never DELETE.

-- Verification SELECT (run separately to preview the count before/after):
-- SELECT count(*) AS stale_pending_student_invitations
-- FROM public.user_invitations i
-- JOIN public.profiles p ON lower(p.email) = lower(i.invited_email)
-- JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'student'
-- WHERE i.status = 'pending'
--   AND i.invitation_type = 'student'
--   AND p.deleted_at IS NULL;

UPDATE public.user_invitations AS i
SET status = 'accepted',
    accepted_at = now(),
    accepted_user_id = p.id
FROM public.profiles AS p
JOIN public.user_roles AS ur
  ON ur.user_id = p.id AND ur.role = 'student'
WHERE lower(i.invited_email) = lower(p.email)
  AND i.invitation_type = 'student'
  AND i.status = 'pending'
  AND p.deleted_at IS NULL;
