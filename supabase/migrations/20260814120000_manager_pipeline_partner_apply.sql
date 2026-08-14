-- ============================================================
-- Manager tier + partner self-attribution support.
-- ============================================================
-- Goals (additive only — never weaken existing policies):
--   1. Make "manager" (a team_member with profiles.is_manager = true) a real,
--      restricted tier: the manager can SEE every active case in the pipeline
--      and ASSIGN each to a team member, but cannot edit case data, delete,
--      manage catalog/programs, or change settings. Admin keeps full access;
--      a normal team_member keeps the existing assigned-only visibility.
--   2. Expose a minimal team-directory RPC so a manager can list team members
--      to assign to (team members cannot SELECT arbitrary user_roles / profiles
--      rows by RLS). Mirrors resolve_profile_names / get_staff_directory.
--
-- "Manager" is NOT a new app_role enum value — it stays a profiles.is_manager
-- flag on a team_member (only one manager is expected). The restrict_profiles_
-- write trigger (20260810052907) already blocks non-admins from setting
-- is_manager, so the flag remains admin-controlled.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. is_active_manager(uid) helper
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_active_manager(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = p_uid
      AND p.deleted_at IS NULL
      AND ur.role = 'team_member'::public.app_role
      AND COALESCE(p.is_manager, false) = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_manager(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_manager(uuid) TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────
-- 2. cases: manager can SELECT all active (non-archived) cases and UPDATE
--    rows (so RLS permits the write). Column-level restriction (assigned_to
--    ONLY) is enforced by the enforce_manager_assign_only() trigger below —
--    PostgreSQL RLS policies do not support a column list on FOR UPDATE.
--    These are ADDITIVE permissive policies — the existing "Team can manage
--    assigned cases" (FOR ALL, assigned_to = self) stays, so a manager who is
--    also assigned a case keeps full team access to that case's *other*
--    columns only via the admin/team path (the manager trigger still applies).
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Manager can view active cases" ON public.cases;
CREATE POLICY "Manager can view active cases"
ON public.cases
FOR SELECT TO authenticated
USING (
  public.is_active_manager(auth.uid())
  AND COALESCE(archived, false) = false
);

-- UPDATE (visibility) — the manager may target active cases. The WITH CHECK
-- re-validates the manager flag so a revoked manager cannot keep assigning.
-- The trigger below guarantees only assigned_to actually changes.
DROP POLICY IF EXISTS "Manager can assign cases" ON public.cases;
CREATE POLICY "Manager can assign cases"
ON public.cases
FOR UPDATE TO authenticated
USING (public.is_active_manager(auth.uid()))
WITH CHECK (public.is_active_manager(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 2b. enforce_manager_assign_only(): a manager (non-admin) may change ONLY
--     assigned_to on a case. Any other column change is rejected. Admins are
--     exempt (they have full access). The comparison strips assigned_to from
--     both rows (via jsonb) so it's column-list-agnostic and survives schema
--     additions. Uses auth.uid() so it works under the SESSION_USER/RLS path.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_manager_assign_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_manager boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW; -- service-role / non-session context: not a manager write
  END IF;
  SELECT public.is_active_manager(v_uid) INTO v_is_manager;

  -- Only restrict managers who are NOT admins (admins keep full access).
  IF v_is_manager
     AND NOT public.has_role(v_uid, 'admin'::public.app_role)
     AND (row_to_json(NEW)::jsonb - 'assigned_to')
       IS DISTINCT FROM (row_to_json(OLD)::jsonb - 'assigned_to')
  THEN
    RAISE EXCEPTION 'Manager may only change the assigned_to column on cases';
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_manager_assign_only() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_manager_assign_only() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_enforce_manager_assign_only ON public.cases;
CREATE TRIGGER trg_enforce_manager_assign_only
BEFORE UPDATE ON public.cases
FOR EACH ROW
EXECUTE FUNCTION public.enforce_manager_assign_only();

-- ────────────────────────────────────────────────────────────
-- 3. Team directory for managers: list team_member id + name only.
--    SECURITY DEFINER so it bypasses the user_roles/profiles RLS that
--    restricts team members to their own rows. Exposes the minimum columns
--    needed to populate an assignee dropdown — no email/phone/PII.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_team_directory()
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
  SELECT p.id, p.full_name
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'team_member'::public.app_role
    AND p.deleted_at IS NULL
  ORDER BY p.full_name;
$$;

REVOKE ALL ON FUNCTION public.list_team_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_team_directory() TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────
-- 4. get_my_permissions: surface the manager-only permissions so the UI can
--    gate the pipeline nav on a clean flag. A manager is a team_member, so it
--    already inherits the team_member permission set (view_cases, assign_cases,
--    view_students, ...). We OR-in the same keys explicitly so a future change
--    to the team_member set never silently removes the manager's assign right.
--    The manager set deliberately EXCLUDES manage_settings, manage_pipeline,
--    manage_team, manage_partners, delete_cases/students/documents.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
  SELECT DISTINCT p.key
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role = ur.role
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = auth.uid()

  UNION

  -- Manager tier (additive): the manager may view + assign cases across the
  -- whole pipeline. These keys already exist in permissions (seeded in
  -- 20260806070949) and are the same ones a manager needs for the pipeline UI.
  SELECT DISTINCT p.key
  FROM public.permissions p
  WHERE public.is_active_manager(auth.uid())
    AND p.key IN ('view_cases', 'assign_cases', 'view_students');
$$;

REVOKE ALL ON FUNCTION public.get_my_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated, service_role;
