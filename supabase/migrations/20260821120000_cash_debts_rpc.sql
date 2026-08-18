-- ═══════════════════════════════════════════════════════════════════════
-- Restore the "Cash Collection Debt" KPI via two SECURITY DEFINER RPCs.
--
-- Background: migration 20260818012648 correctly hardened v_cash_debts by
-- setting security_invoker = true (the view now runs as the viewer and enforces
-- RLS on cases/case_payments/rewards instead of bypassing it) AND revoked
-- direct access from anon/authenticated (service_role only). The revocation
-- broke the two frontend readers that power the "Cash Collection Debt" KPI
-- (src/components/admin/MemberDetailDrawer.tsx, src/pages/team/TeamAnalyticsPage.tsx),
-- which did a direct `.from("v_cash_debts").select()` as the authenticated
-- user — silently returning empty.
--
-- This migration keeps the view revoked from authenticated (the security
-- posture from 20260818012648 is preserved) and exposes the data through two
-- SECURITY DEFINER RPCs that scope server-side:
--   1. get_my_cash_debts()        — team member, own debts only (team_member_id = auth.uid())
--   2. get_member_cash_debts(uuid) — admin only (has_role('admin')), any member
-- The functions run as owner (bypassing the view's security_invoker + table
-- RLS), but the WHERE clause / role check IS the trust boundary. This matches
-- the repo's RPC-first pattern (get_partner_pool_cases, get_my_agent_network,
-- get_student_important_contacts).
--
-- Supersedes the reverted 20260821000000 migration (which re-granted the view
-- to authenticated). DDL is NOT applied by the Vercel build or ci.yml; apply
-- via `supabase db push` or the dashboard SQL editor (admin/service-role only).
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Team member: own debts only ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_cash_debts()
RETURNS TABLE (
  payment_id            uuid,
  case_id               uuid,
  case_reference        text,
  student_name          text,
  amount_owed_to_admin  numeric,
  debt_status           text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT payment_id, case_id, case_reference, student_name,
         amount_owed_to_admin, debt_status
  FROM   public.v_cash_debts
  WHERE  team_member_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_cash_debts() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_cash_debts() TO authenticated;

-- ── 2. Admin: any member's debts (role-checked) ───────────────────────────
CREATE OR REPLACE FUNCTION public.get_member_cash_debts(p_member_id uuid)
RETURNS TABLE (
  payment_id            uuid,
  case_id               uuid,
  case_reference        text,
  student_name          text,
  amount_owed_to_admin  numeric,
  debt_status           text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT cd.payment_id, cd.case_id, cd.case_reference, cd.student_name,
         cd.amount_owed_to_admin, cd.debt_status
  FROM   public.v_cash_debts cd
  WHERE  cd.team_member_id = p_member_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_member_cash_debts(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_member_cash_debts(uuid) TO authenticated;
