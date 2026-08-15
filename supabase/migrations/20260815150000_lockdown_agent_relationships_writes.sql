-- Lock down direct writes to agent_relationships.
--
-- SECURITY FIX: The original "Agents manage own relationships" policy was
-- FOR ALL with WITH CHECK (agent_id = auth.uid()), and the table had
-- GRANT SELECT, INSERT, UPDATE, DELETE TO authenticated. This let any
-- authenticated agent bypass the trigger-based write path and directly
-- INSERT/UPDATE rows via the PostgREST API, setting arbitrary
-- commission_amount_ils, agreement_status, recruited_role, or
-- recruited_user_id — effectively self-approving inflated payouts.
--
-- The sole intended writer is the SECURITY DEFINER function
-- sync_agent_relationship_row(), invoked by DB triggers on
-- profiles.agent_id and user_roles. It computes commission_amount_ils
-- server-side via get_effective_agent_split() and hard-codes
-- agreement_status='configured'. SECURITY DEFINER functions run as the
-- owner and bypass RLS, so restricting the policy does not affect them.
--
-- This migration:
--   1. Replaces the agent FOR ALL policy with FOR SELECT (read-only).
--   2. Revokes INSERT, UPDATE, DELETE from authenticated (keeps SELECT).
--   3. Leaves the admin FOR ALL policy unchanged.

-- 1. Replace the permissive agent policy with a SELECT-only policy.
DROP POLICY IF EXISTS "Agents manage own relationships" ON public.agent_relationships;
CREATE POLICY "Agents manage own relationships"
  ON public.agent_relationships FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

-- 2. Revoke direct DML from authenticated; the SECURITY DEFINER trigger
--    function (sync_agent_relationship_row) remains the sole writer.
REVOKE INSERT, UPDATE, DELETE ON public.agent_relationships FROM authenticated;
GRANT SELECT ON public.agent_relationships TO authenticated;

-- 3. Admin policy is unchanged (already FOR ALL, admin-only).
--    No action needed — "Admins manage all agent relationships" stays as-is.
