-- ============================================================================
-- Reconcile staff (partner/ambassador/agent/team) invitations with account state
-- ============================================================================
-- accept-invitation could create the auth user + role + profile but fail
-- before flipping user_invitations.status to 'accepted', leaving a
-- contradictory state: the account active (visible in the admin members
-- directory via the profiles × user_roles join) while the invitation stayed
-- status='pending' forever and every retry re-failed. The student-only
-- reconciliation (20260813150000) never fired for staff roles.
--
-- This migration generalizes the student pattern to the four staff roles:
--   1. A SECURITY DEFINER trigger that closes matching pending
--      partner/ambassador/agent/team invitations whenever the corresponding
--      role row is inserted into user_roles (covers ANY provisioning path,
--      not only the edge functions). The student trigger is untouched —
--      student invitations stay owned by trg_reconcile_student_invitations.
--   2. A one-time idempotent data cleanup that closes existing stale pending
--      staff invitations whose email already belongs to an active
--      (non-deactivated) account holding the mapped role. This is what closes
--      the currently-stuck partner invitation without manual SQL.
--   3. Cosmetic: get_invitation_preview now resolves the recruiter name via
--      agent_id / inviter_id (current code never sets master_partner_id, so
--      agent-invited recruits previously saw no recruiter name on /activate).
--
-- Reconciliation is always pending → accepted (never DELETE), idempotent,
-- touches no RLS, and updates a different table than the trigger's own
-- (no recursion).
-- ============================================================================

-- ── 1. Trigger function ─────────────────────────────────────────────────────
-- Fires AFTER INSERT on public.user_roles. The edge functions upsert with
-- onConflict user_id + ignoreDuplicates, so the trigger only fires for a
-- genuine new role row — never for a no-op duplicate. Role → invitation_type
-- mapping: social_media_partner → 'partner', ambassador → 'ambassador',
-- agent → 'agent', team_member → 'team'. Any other role (student, admin) is
-- out of scope and returns early.
CREATE OR REPLACE FUNCTION public.reconcile_staff_invitations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_type text;
BEGIN
  v_type := CASE NEW.role
              WHEN 'social_media_partner' THEN 'partner'
              WHEN 'ambassador' THEN 'ambassador'
              WHEN 'agent' THEN 'agent'
              WHEN 'team_member' THEN 'team'
              ELSE NULL
            END;
  IF v_type IS NULL THEN
    RETURN NEW;
  END IF;

  -- The profile row is the email source of truth (profiles.id is the PK, so
  -- at most one row per user_id). If no profile exists yet (should not
  -- happen — on_auth_user_created creates it), there is nothing to match.
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
    AND invitation_type = v_type
    AND status = 'pending';

  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reconcile_staff_invitations() TO service_role;

DROP TRIGGER IF EXISTS trg_reconcile_staff_invitations ON public.user_roles;
CREATE TRIGGER trg_reconcile_staff_invitations
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.reconcile_staff_invitations();

-- ── 2. Data cleanup (one-time, idempotent) ──────────────────────────────────
-- Close existing stale pending staff invitations whose invited email already
-- belongs to an active (non-deactivated) account holding the mapped role.
-- Only pending → accepted (sets accepted_at, accepted_user_id); never DELETE.

-- Verification SELECT (run separately to preview the count before/after):
-- SELECT i.invitation_type, count(*) AS stale_pending_invitations
-- FROM public.user_invitations i
-- JOIN public.profiles p ON lower(p.email) = lower(i.invited_email)
-- JOIN public.user_roles ur
--   ON ur.user_id = p.id
--  AND ur.role = CASE i.invitation_type
--                  WHEN 'partner' THEN 'social_media_partner'
--                  WHEN 'ambassador' THEN 'ambassador'
--                  WHEN 'agent' THEN 'agent'
--                  WHEN 'team' THEN 'team_member'
--                END
-- WHERE i.status = 'pending'
--   AND i.invitation_type IN ('partner', 'ambassador', 'agent', 'team')
--   AND p.deleted_at IS NULL
-- GROUP BY i.invitation_type;

UPDATE public.user_invitations AS i
SET status = 'accepted',
    accepted_at = now(),
    accepted_user_id = p.id
FROM public.profiles AS p
JOIN public.user_roles AS ur ON ur.user_id = p.id
WHERE lower(i.invited_email) = lower(p.email)
  AND ur.role = CASE i.invitation_type
                  WHEN 'partner' THEN 'social_media_partner'
                  WHEN 'ambassador' THEN 'ambassador'
                  WHEN 'agent' THEN 'agent'
                  WHEN 'team' THEN 'team_member'
                END
  AND i.invitation_type IN ('partner', 'ambassador', 'agent', 'team')
  AND i.status = 'pending'
  AND p.deleted_at IS NULL;

-- ── 3. Preview fix: recruiter name via agent_id / inviter_id ────────────────
-- Identical to the current body except recruiter_name resolves through
-- COALESCE(master_partner_id, agent_id, inviter_id): master_partner_id is
-- kept first for any legacy rows that have it, while current invitations
-- carry agent_id (agent-invited recruits) or inviter_id.
CREATE OR REPLACE FUNCTION public.get_invitation_preview(p_token text)
RETURNS TABLE(
  state text,
  invitation_type text,
  invited_email text,
  masked_email text,
  recruiter_name text,
  case_reference text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_hash text;
  v_inv public.user_invitations%ROWTYPE;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  v_hash := encode(extensions.digest(btrim(p_token), 'sha256'), 'hex');

  SELECT * INTO v_inv FROM public.user_invitations WHERE token_hash = v_hash;

  IF v_inv.id IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    CASE
      WHEN v_inv.status = 'accepted' THEN 'accepted'
      WHEN v_inv.status = 'revoked' THEN 'revoked'
      WHEN v_inv.expires_at < now() THEN 'expired'
      ELSE 'valid'
    END,
    v_inv.invitation_type,
    CASE WHEN v_inv.status = 'pending' AND v_inv.expires_at >= now()
         THEN v_inv.invited_email ELSE NULL END,
    regexp_replace(v_inv.invited_email, '^(.).*(.)@', '\1***\2@'),
    COALESCE(
      (SELECT p.full_name FROM public.profiles p WHERE p.id = v_inv.master_partner_id),
      (SELECT p.full_name FROM public.profiles p WHERE p.id = v_inv.agent_id),
      (SELECT p.full_name FROM public.profiles p WHERE p.id = v_inv.inviter_id)
    ),
    (SELECT c.case_reference FROM public.cases c WHERE c.id = v_inv.case_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_invitation_preview(text) TO anon, authenticated, service_role;
