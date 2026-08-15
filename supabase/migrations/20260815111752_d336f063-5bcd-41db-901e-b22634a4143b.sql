CREATE OR REPLACE FUNCTION public.is_active_agent(p_uid uuid)
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
      AND p.deactivated_at IS NULL
      AND ur.role = 'agent'::public.app_role
  )
$$;

REVOKE ALL ON FUNCTION public.is_active_agent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_agent(uuid) TO authenticated, service_role;

-- Recruit must also still be an active (non-deactivated) profile
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
      AND p.deactivated_at IS NULL
  )
$$;

DROP POLICY IF EXISTS "Agents can view network and self-referral cases" ON public.cases;
CREATE POLICY "Agents can view network and self-referral cases"
ON public.cases FOR SELECT
TO authenticated
USING (
  public.is_active_agent(auth.uid())
  AND (
    partner_id = auth.uid()
    OR referred_by = auth.uid()
    OR public.agent_owns_recruit(partner_id, auth.uid())
    OR public.agent_owns_recruit(referred_by, auth.uid())
  )
);