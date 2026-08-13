-- ============================================================================
-- ACCOUNT LIFECYCLE AUDIT (READ-ONLY — NO DELETES / UPDATES / INSERTS)
-- ============================================================================
-- Run this in the Supabase SQL editor (or psql) to inspect data created by the
-- old account-lifecycle flows. It only SELECTs. Nothing here modifies data.
--
-- Background: approve-partner-recruit used to pre-create the auth user + role
-- before sending the durable invitation, so accept-invitation rejected the
-- activation link ("email already belongs to an account"). After the fix,
-- accept-invitation adopts an already-provisioned identity for the SAME role,
-- so most of these recruits self-heal when they (or a resend) open a pending
-- invite. This script helps you find the rows to watch or re-invite.
-- ============================================================================

-- 1. Duplicate profile rows per email (profiles.email has NO unique constraint)
SELECT lower(email) AS email, count(*) AS profiles, array_agg(id::text) AS ids
FROM public.profiles
WHERE email IS NOT NULL
GROUP BY lower(email)
HAVING count(*) > 1
ORDER BY profiles DESC;

-- 2. Profiles whose auth identity is missing (orphaned application profiles)
SELECT p.id, p.email, p.full_name, p.deleted_at
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE u.id IS NULL;

-- 3. Auth identities with no profile row (should not exist: trigger on insert)
SELECT u.id, u.email, u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 4. Identities that somehow hold more than one role (pre one-role-per-user)
SELECT user_id, array_agg(role::text) AS roles
FROM public.user_roles
GROUP BY user_id
HAVING count(*) > 1;

-- 5. Approved recruit applications still awaiting activation
--    (status approved, no created_user_id -> brand-new account pending invite)
SELECT id, email, full_name, master_partner_id, reviewed_at, created_at
FROM public.partner_recruit_applications
WHERE status = 'approved' AND created_user_id IS NULL
ORDER BY reviewed_at DESC;

-- 6. Approved recruit applications whose created_user_id no longer holds the
--    social_media_partner role (pre-provisioned by the old flow, then deactivated
--    or role changed)
SELECT a.id, a.email, a.created_user_id, p.deleted_at
FROM public.partner_recruit_applications a
LEFT JOIN public.user_roles ur
  ON ur.user_id = a.created_user_id AND ur.role = 'social_media_partner'
LEFT JOIN public.profiles p ON p.id = a.created_user_id
WHERE a.status = 'approved'
  AND a.created_user_id IS NOT NULL
  AND ur.user_id IS NULL
ORDER BY a.reviewed_at DESC;

-- 7. Pending invitations where the invited email already belongs to an identity
--    of the SAME intended role -> these are the self-healing cases after deploy.
--    A resend refreshes their token if expired.
SELECT i.id, i.invited_email, i.invitation_type, i.intended_role::text,
       i.expires_at, i.created_at,
       p.id AS existing_user_id, ur.role AS existing_role, p.deleted_at
FROM public.user_invitations i
JOIN public.profiles p ON lower(p.email) = lower(i.invited_email)
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE i.status = 'pending'
  AND ur.role = i.intended_role
ORDER BY i.expires_at ASC;

-- 8. Pending invitations whose invited email belongs to a DIFFERENT role
--    (real conflicts — need a different email, or deactivate/reactivate first)
SELECT i.id, i.invited_email, i.invitation_type, i.intended_role::text,
       p.id AS existing_user_id, ur.role AS existing_role, p.deleted_at
FROM public.user_invitations i
JOIN public.profiles p ON lower(p.email) = lower(i.invited_email)
JOIN public.user_roles ur ON ur.user_id = p.id
WHERE i.status = 'pending'
  AND ur.role IS DISTINCT FROM i.intended_role
ORDER BY i.expires_at ASC;

-- 9. Cases linked to a student_user_id whose user no longer has the student role
SELECT c.id, c.case_reference, c.student_user_id, ur.role, p.deleted_at
FROM public.cases c
LEFT JOIN public.user_roles ur ON ur.user_id = c.student_user_id
LEFT JOIN public.profiles p ON p.id = c.student_user_id
WHERE c.student_user_id IS NOT NULL
  AND (ur.role IS NULL OR ur.role <> 'student')
ORDER BY c.created_at DESC;
