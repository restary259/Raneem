-- ════════════════════════════════════════════════════════════════════════
-- Agent backend fixes (2026-08-14):
--   1. get_my_agent_network now returns agent_amount (the effective per-recruit
--      override) so the agent network page is ONE query, not 1 + N
--      get_effective_agent_split round trips.
--   2. agent_relationships (created in 20260814140100 but never written) is
--      now a real audit trail: a trigger on profiles.agent_id keeps it in sync,
--      a trigger on user_roles closes the ordering gap (profile-with-agent_id
--      created before the recruit role is granted), and existing recruits are
--      backfilled. Detaching a recruit deactivates (never deletes) the link.
--   3. user_roles guard: a person who belongs to an agent's network can never
--      be granted the 'agent' role — closes the enforce_agent_graph gap where
--      the profiles trigger only fires on agent_id changes, not role changes.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────────────────────────────────────
-- 1. get_my_agent_network: add agent_amount (bulk split).
--    Same columns as before plus one new one, resolved by the SAME
--    get_effective_agent_split the page's per-recruit loop used.
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_agent_network()
RETURNS TABLE(
  partner_id uuid,
  full_name text,
  email text,
  city text,
  referral_code text,
  joined_at timestamptz,
  status text,
  students_count bigint,
  paid_cases bigint,
  override_earned numeric,
  agent_amount integer
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
         COALESCE((SELECT eas.agent_amount FROM public.get_effective_agent_split(auth.uid(), r.id) eas), 0)
  FROM recruits r
  ORDER BY r.created_at DESC
$function$;

REVOKE ALL ON FUNCTION public.get_my_agent_network() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_agent_network() TO authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- 2. agent_relationships audit trail.
--    sync_agent_relationship_row(p_agent_id, p_user_id) is the single writer:
--    deactivates stale links for the recruit, then upserts the live one with
--    the role and the effective commission (resolved server-side, matching the
--    commission carve). p_agent_id IS NULL detaches (active = false), keeping
--    history. Called by the profiles.agent_id trigger AND the user_roles
--    trigger so the row appears no matter which happens first.
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_agent_relationship_row(p_agent_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_amount integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  IF p_agent_id IS NULL THEN
    UPDATE public.agent_relationships
    SET active = false
    WHERE recruited_user_id = p_user_id AND active = true;
    RETURN;
  END IF;

  -- A recruit belongs to exactly one agent at a time: deactivate any older
  -- link (e.g. after an admin reassigns the recruit to another agent).
  UPDATE public.agent_relationships
  SET active = false
  WHERE recruited_user_id = p_user_id
    AND agent_id IS DISTINCT FROM p_agent_id
    AND active = true;

  SELECT role::text INTO v_role FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;

  -- Only partners/ambassadors can belong to an agent's network.
  IF v_role IS NOT NULL AND v_role IN ('social_media_partner', 'ambassador') THEN
    SELECT COALESCE(eas.agent_amount, 0) INTO v_amount
    FROM public.get_effective_agent_split(p_agent_id, p_user_id) eas;

    INSERT INTO public.agent_relationships (
      agent_id, recruited_user_id, recruited_role, commission_amount_ils, agreement_status, active
    )
    VALUES (p_agent_id, p_user_id, v_role, v_amount, 'configured', true)
    ON CONFLICT (agent_id, recruited_user_id)
      WHERE recruited_user_id IS NOT NULL AND active = true
    DO UPDATE SET
      recruited_role = EXCLUDED.recruited_role,
      commission_amount_ils = EXCLUDED.commission_amount_ils,
      agreement_status = 'configured',
      active = true;
  ELSE
    -- The recruit no longer holds a recruitable role (e.g. downgraded to
    -- team_member): the relationship becomes inactive, keeping history.
    UPDATE public.agent_relationships
    SET active = false
    WHERE recruited_user_id = p_user_id AND active = true;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_agent_relationship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_agent_relationship_row(NEW.agent_id, NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_agent_relationship ON public.profiles;
CREATE TRIGGER trg_sync_agent_relationship
  AFTER INSERT OR UPDATE OF agent_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_agent_relationship();

-- Covers the path where the profile (with agent_id) is created before the
-- recruit's partner/ambassador role is granted (accept-invitation ordering).
CREATE OR REPLACE FUNCTION public.sync_agent_relationship_on_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
BEGIN
  SELECT agent_id INTO v_agent_id FROM public.profiles WHERE id = NEW.user_id;
  IF v_agent_id IS NOT NULL THEN
    PERFORM public.sync_agent_relationship_row(v_agent_id, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_agent_relationship_on_role ON public.user_roles;
CREATE TRIGGER trg_sync_agent_relationship_on_role
  AFTER INSERT OR UPDATE OF role ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_agent_relationship_on_role();

-- Backfill existing agent → recruit links into the audit trail (idempotent).
INSERT INTO public.agent_relationships (
  agent_id, recruited_user_id, recruited_role, commission_amount_ils, agreement_status, active
)
SELECT p.agent_id,
       p.id,
       (SELECT role::text FROM public.user_roles ur WHERE ur.user_id = p.id LIMIT 1),
       (SELECT COALESCE(eas.agent_amount, 0) FROM public.get_effective_agent_split(p.agent_id, p.id) eas),
       'configured',
       true
FROM public.profiles p
WHERE p.agent_id IS NOT NULL
  AND p.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id AND ur.role IN ('social_media_partner', 'ambassador')
  )
ON CONFLICT (agent_id, recruited_user_id)
  WHERE recruited_user_id IS NOT NULL AND active = true
DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────
-- 3. user_roles guard: no multi-level agent chaining.
--    enforce_agent_graph (profiles trigger) fires when agent_id changes, but
--    a user could be granted the 'agent' role AFTER already belonging to an
--    agent's network — that trigger never fires. This closes the gap: granting
--    the agent role to a profile with agent_id set is rejected.
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_agent_graph_on_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'agent' AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.user_id AND p.agent_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'An agent cannot belong to another agent''s network';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_agent_graph_on_role ON public.user_roles;
CREATE TRIGGER trg_enforce_agent_graph_on_role
  BEFORE INSERT OR UPDATE OF role ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_agent_graph_on_role();

COMMIT;
