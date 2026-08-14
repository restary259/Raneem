-- Fix infinite RLS recursion caused by 20260814183000_agent_cases_select_rls.sql.
--
-- The agent cases SELECT policy used an inline subquery:
--   partner_id IN (SELECT p.id FROM public.profiles p WHERE p.agent_id = auth.uid())
-- But `profiles` has its own RLS policy ("Assigned team can view student
-- profiles") that reads `cases`:
--   EXISTS (SELECT 1 FROM cases c WHERE c.student_user_id = profiles.id ...)
-- So evaluating the cases policy evaluates the profiles policy which evaluates
-- the cases policy → "infinite recursion detected in policy for relation
-- cases" (42P17). Every cases read for an agent (including the students page)
-- errored out.
--
-- Fix: move the recruit-membership check into a SECURITY DEFINER function that
-- reads profiles.agent_id WITHOUT RLS, breaking the cycle. The policy then
-- calls the function instead of touching `profiles` directly. This is the
-- standard Supabase pattern for mutual RLS recursion.

CREATE OR REPLACE FUNCTION public.agent_owns_recruit(p_recruit uuid, p_agent uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_recruit
      AND p.agent_id = p_agent
      AND p.deleted_at IS NULL
  )
$$;

REVOKE ALL ON FUNCTION public.agent_owns_recruit(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agent_owns_recruit(uuid, uuid) TO authenticated;

-- Replace the policy: drop the recursive one and recreate using the
-- SECURITY DEFINER helper. No other cases policy is touched.
DROP POLICY IF EXISTS "Agents can view network and self-referral cases" ON public.cases;

CREATE POLICY "Agents can view network and self-referral cases"
ON public.cases
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'agent'::app_role)
  AND (
    partner_id = auth.uid()
    OR referred_by = auth.uid()
    OR public.agent_owns_recruit(partner_id, auth.uid())
  )
);
