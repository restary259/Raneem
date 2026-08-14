-- Agent case visibility (RLS). The agent role was added by
-- 20260814140000 / 20260814140100 but no SELECT policy on `cases` ever
-- covered it, so an agent could not read ANY case row — including their own
-- self-referrals (cases.partner_id = agent.id created via the agent's
-- /apply?ref=<code> link or dashboard apply form) and cases attributed to the
-- partners/ambassadors in their network. The AgentStudentsPage queries
-- `.from('cases').in('partner_id', [...recruits, ownUid])` directly, so RLS
-- silently returned an empty set and every students tab showed (0).
--
-- This adds a single additive SELECT policy scoped to the agent role:
--   - partner_id = agent          → self-referrals (own apply link)
--   - referred_by = agent         → agent-named referrer
--   - partner_id IN recruits      → cases attributed to a partner/ambassador
--                                    whose profiles.agent_id = agent
-- No existing policy is touched. The has_role() gate keeps this agent-only.

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
    OR partner_id IN (
      SELECT p.id FROM public.profiles p WHERE p.agent_id = auth.uid()
    )
  )
);
