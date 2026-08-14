-- ============================================================
-- Remove the "manager" tier (rollback of 20260814120000).
-- ============================================================
-- This reverts the manager pipeline/assignment feature added by
-- 20260814120000_manager_pipeline_partner_apply.sql. It is a full rollback
-- of the manager tier (team_member + profiles.is_manager) but does NOT
-- touch partner self-attribution / ApplyForm / create-case-from-apply logic
-- (those are separate and remain in place). profiles.is_manager is left
-- as a dormant column (the restrict_profiles_write trigger predates the
-- manager migration and still guards it); only the stale true values are
-- reset so no account is treated as a manager.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. Drop the column-restriction trigger + function.
-- ────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_enforce_manager_assign_only ON public.cases;
DROP FUNCTION IF EXISTS public.enforce_manager_assign_only();

-- ────────────────────────────────────────────────────────────
-- 2. Drop the two additive manager RLS policies on cases.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Manager can view active cases" ON public.cases;
DROP POLICY IF EXISTS "Manager can assign cases" ON public.cases;

-- ────────────────────────────────────────────────────────────
-- 3. Drop the team-directory RPC (only the manager pipeline used it).
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.list_team_directory();

-- ────────────────────────────────────────────────────────────
-- 4. Restore get_my_permissions() to its PRE-manager body: only the base
--    role-permission join, no manager UNION branch. Keep SECURITY DEFINER,
--    STABLE, search_path, and the same REVOKE/GRANT. Do NOT drop it — it
--    is shared by every role.
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
  WHERE ur.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────
-- 5. Drop the is_active_manager helper LAST (after get_my_permissions no
--    longer references it).
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.is_active_manager(uuid);

-- ────────────────────────────────────────────────────────────
-- 6. Reset stale manager flags. The profiles.is_manager column and its
--    restrict_profiles_write guard predate the manager migration, so the
--    column is left in place (dormant) to avoid touching that trigger.
--    Resetting to false means no account is treated as a manager anymore.
--    (Currently true for team@gmail.com, kassemdwahdi31@gmail.com.)
-- ────────────────────────────────────────────────────────────
UPDATE public.profiles SET is_manager = false WHERE COALESCE(is_manager, false) = true;

COMMIT;

-- NOTE: profiles.is_manager is intentionally NOT dropped. Dropping it would
-- require editing the restrict_profiles_write trigger (20260810052907),
-- which is a separate, riskier change. The column is now dormant (always
-- false) and no DB object or frontend code reads it after this deploy.
