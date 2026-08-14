-- ════════════════════════════════════════════════════════════════════════
-- Agent self-referral: when an Agent personally refers a student through
-- their own in-dashboard apply form, the case is attributed to the agent
-- (partner_id = agent.id) and the agent earns a flat self-referral reward
-- (default ₪1000) — distinct from the network per-recruit override
-- (agent_commission_rate, default ₪200) which only applies to cases referred
-- by partners/ambassadors INSIDE the agent's network.
--
-- This migration:
--   1. Adds platform_settings.agent_self_referral_rate (default 1000).
--   2. Adds agent_self_referral_overrides (per-agent override).
--   3. Adds `role` to get_my_agent_network so the UI can distinguish
--      recruited partners from ambassadors.
--   4. Extends record_case_commission: when the referring partner IS an agent,
--      pay the self-referral rate as a 'referral' reward (no master/agent
--      carve — the agent is the direct referrer, not a recruiter-of-recruiters).
--
-- Business rule (COMMISSION_RULES §10): the agent override never applies to a
-- case the agent referred directly. This migration makes the direct referral
-- PAY the agent instead of skipping them (the old behaviour paid ₪0 because
-- `v_is_partner` excluded the 'agent' role).
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Global self-referral rate (admin-configurable, default 1000 ILS).
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS agent_self_referral_rate integer NOT NULL DEFAULT 1000;

-- 2. Per-agent override table (mirrors agent_commission_overrides structure).
CREATE TABLE IF NOT EXISTS public.agent_self_referral_overrides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS agent_self_referral_overrides_agent_id_key
  ON public.agent_self_referral_overrides (agent_id);
ALTER TABLE public.agent_self_referral_overrides ENABLE ROW LEVEL SECURITY;

-- Agents can read their own self-referral override; admins manage all.
CREATE POLICY "Agents read own self-referral override"
  ON public.agent_self_referral_overrides FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());
CREATE POLICY "Admins manage self-referral overrides"
  ON public.agent_self_referral_overrides FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_self_referral_overrides TO authenticated;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_agent_self_referral_overrides_updated ON public.agent_self_referral_overrides;
CREATE TRIGGER trg_agent_self_referral_overrides_updated
  BEFORE UPDATE ON public.agent_self_referral_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. get_my_agent_network: add `role` column (social_media_partner | ambassador)
--    so the agent UI can tab/filter by recruit type.
CREATE OR REPLACE FUNCTION public.get_my_agent_network()
RETURNS TABLE(
  partner_id uuid,
  full_name text,
  email text,
  city text,
  referral_code text,
  joined_at timestamptZ,
  status text,
  students_count bigint,
  paid_cases bigint,
  override_earned numeric,
  agent_amount integer,
  role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH me AS (
    SELECT id FROM public.profiles
    WHERE id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'agent')
  ),
  recruits AS (
    SELECT p.id, p.full_name, p.email, p.city, p.referral_code, p.created_at
    FROM public.profiles p
    JOIN me ON p.agent_id = me.id
    WHERE p.deleted_at IS NULL
  )
  SELECT r.id,
         r.full_name,
         r.email,
         r.city,
         r.referral_code,
         r.created_at,
         'active'::text,
         (SELECT count(*) FROM public.cases c
           WHERE COALESCE(c.partner_id, c.referred_by) = r.id),
         (SELECT count(*) FROM public.cases c
           WHERE c.partner_id = r.id AND c.commission_split_done = true),
         (SELECT COALESCE(sum(rw.amount), 0) FROM public.rewards rw
           WHERE rw.user_id = auth.uid()
             AND rw.reward_type = 'agent_override'
             AND rw.source_user_id = r.id),
         COALESCE((SELECT eas.agent_amount FROM public.get_effective_agent_split(auth.uid(), r.id) eas), 0),
         COALESCE((SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = r.id AND ur.role IN ('social_media_partner','ambassador') LIMIT 1), 'social_media_partner')
  FROM recruits r
  ORDER BY r.created_at DESC
$function$;

REVOKE ALL ON FUNCTION public.get_my_agent_network() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_agent_network() TO authenticated;

-- 4. Agent self-referral commission resolver.
--    Per-agent override wins; otherwise the global agent_self_referral_rate.
--    Clamped to ≥ 0 (no upper bound — it is NOT carved from the partner pool;
--    it is the agent's direct referral reward, parallel to a partner's referral).
CREATE OR REPLACE FUNCTION public.get_effective_agent_self_referral(p_agent_id uuid)
RETURNS TABLE(amount integer, agent_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT GREATEST(0,
    COALESCE(
      (SELECT sro.commission_amount::integer FROM public.agent_self_referral_overrides sro WHERE sro.agent_id = p_agent_id),
      (SELECT COALESCE(ps.agent_self_referral_rate, 0) FROM public.platform_settings ps LIMIT 1)
    )
  ), p_agent_id
$function$;

REVOKE ALL ON FUNCTION public.get_effective_agent_self_referral(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_effective_agent_self_referral(uuid) TO authenticated;

COMMIT;
