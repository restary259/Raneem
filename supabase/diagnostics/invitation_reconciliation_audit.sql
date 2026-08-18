-- ============================================================================
-- INVITATION RECONCILIATION AUDIT (READ-ONLY — NO DELETES / UPDATES / INSERTS)
-- ============================================================================
-- Run this in the Supabase SQL editor (or psql) to find "stuck" invitations:
-- user_invitations rows that are still status='pending' even though the
-- invited email already belongs to an active (non-deactivated) account holding
-- the invitation's intended role. The account is live while the invitation
-- keeps rendering under "Pending invitations" — a contradictory state.
--
-- Reconciliation (pending → accepted, never DELETE) is handled automatically
-- by:
--   * trg_reconcile_student_invitations  (20260813150000 — student roles)
--   * trg_reconcile_staff_invitations    (20260826000000 — partner/ambassador/
--                                        agent/team roles, incl. one-time
--                                        cleanup of existing stuck rows)
--   * the reconcilePendingInvitations edge-function helper
-- Run query 1 BEFORE and AFTER applying 20260826000000: the stuck rows must
-- disappear (closed, not deleted). Anything still listed afterwards needs a
-- manual look.
-- ============================================================================

-- 1. Stuck pending invitations for ALL types (student included — general
--    audit). The invitation_type → role mapping mirrors the two
--    reconciliation triggers.
SELECT
  i.id,
  i.invitation_type,
  i.intended_role,
  i.invited_email,
  i.created_at,
  i.expires_at,
  p.id          AS account_id,
  p.deleted_at  AS account_deleted_at
FROM public.user_invitations i
JOIN public.profiles p
  ON lower(p.email) = lower(i.invited_email)
JOIN public.user_roles ur
  ON ur.user_id = p.id
 AND ur.role = CASE i.invitation_type
                 WHEN 'student' THEN 'student'
                 WHEN 'partner' THEN 'social_media_partner'
                 WHEN 'ambassador' THEN 'ambassador'
                 WHEN 'agent' THEN 'agent'
                 WHEN 'team' THEN 'team_member'
               END
WHERE i.status = 'pending'
  AND i.invitation_type IN ('student', 'partner', 'ambassador', 'agent', 'team')
  AND p.deleted_at IS NULL
ORDER BY i.created_at DESC;

-- 2. Per-type count (quick before/after signal around the cleanup migration)
-- SELECT i.invitation_type, count(*) AS stuck_pending_invitations
-- FROM public.user_invitations i
-- JOIN public.profiles p
--   ON lower(p.email) = lower(i.invited_email)
-- JOIN public.user_roles ur
--   ON ur.user_id = p.id
--  AND ur.role = CASE i.invitation_type
--                  WHEN 'student' THEN 'student'
--                  WHEN 'partner' THEN 'social_media_partner'
--                  WHEN 'ambassador' THEN 'ambassador'
--                  WHEN 'agent' THEN 'agent'
--                  WHEN 'team' THEN 'team_member'
--                END
-- WHERE i.status = 'pending'
--   AND i.invitation_type IN ('student', 'partner', 'ambassador', 'agent', 'team')
--   AND p.deleted_at IS NULL
-- GROUP BY i.invitation_type
-- ORDER BY i.invitation_type;

-- 3. Pending invitations whose email matches a DEACTIVATED account (NOT closed
--    by reconciliation on purpose — an admin must reactivate or re-invite).
-- SELECT i.id, i.invitation_type, i.invited_email, p.id AS account_id, p.deleted_at
-- FROM public.user_invitations i
-- JOIN public.profiles p
--   ON lower(p.email) = lower(i.invited_email)
-- JOIN public.user_roles ur
--   ON ur.user_id = p.id
--  AND ur.role = CASE i.invitation_type
--                  WHEN 'student' THEN 'student'
--                  WHEN 'partner' THEN 'social_media_partner'
--                  WHEN 'ambassador' THEN 'ambassador'
--                  WHEN 'agent' THEN 'agent'
--                  WHEN 'team' THEN 'team_member'
--                END
-- WHERE i.status = 'pending'
--   AND i.invitation_type IN ('student', 'partner', 'ambassador', 'agent', 'team')
--   AND p.deleted_at IS NOT NULL
-- ORDER BY i.created_at DESC;
