-- ════════════════════════════════════════════════════════════════════════
-- Agent role foundation: relationship model, commission config, RLS, network
-- RPC, chat/directory/payout role gates, restrict_profiles_write guard.
--
-- An Agent is a first-class role (app_role 'agent', added by
-- 20260814140000_add_agent_role_enum.sql) that recruits and manages Partners
-- and Ambassadors. The Agent is the PARENT of the partners/ambassadors they
-- recruit — linked via profiles.agent_id (mirrors profiles.master_partner_id).
--
-- Agent commission is a FLAT admin-set amount (agent_commission_rate in
-- platform_settings, with an optional per-agent override), CARVED OUT OF THE
-- SAME ₪1000 partner pool — never extra money. This mirrors the master-partner
-- override (COMMISSION_RULES.md §8–9). Agent rewards use the SAME 20-day payout
-- lock as every other reward and flow through the existing payout machinery.
--
-- Everything here is ADDITIVE: no existing policy is weakened, no existing
-- table is dropped. Agent does NOT inherit team_member permissions.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────────────────────────────────────
-- 1. profiles.agent_id — the Agent ↔ recruit parent link.
--    Mirrors profiles.master_partner_id (self-ref FK, ON DELETE SET NULL).
-- ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_agent ON public.profiles(agent_id);

-- Enforce the agent parent graph: an agent cannot recruit themselves; a
-- recruit's agent must actually be an agent; an agent cannot itself have an
-- agent_id (no multi-level chaining). Mirrors enforce_master_partner_graph().
CREATE OR REPLACE FUNCTION public.enforce_agent_graph()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.agent_id IS NOT NULL THEN
    IF NEW.agent_id = NEW.id THEN
      RAISE EXCEPTION 'A user cannot be their own agent';
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = NEW.agent_id AND ur.role = 'agent') THEN
      -- the recruit's parent must be an agent
      NULL;
    ELSE
      RAISE EXCEPTION 'Recruiter must be an agent';
    END IF;
    -- An agent cannot itself have a parent agent (no multi-level chaining).
    IF EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = NEW.id AND ur.role = 'agent') THEN
      RAISE EXCEPTION 'An agent cannot belong to another agent''s network';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_agent_graph ON public.profiles;
CREATE TRIGGER trg_enforce_agent_graph
  BEFORE INSERT OR UPDATE OF agent_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_agent_graph();

-- ────────────────────────────────────────────────────────────────────────
-- 2. restrict_profiles_write — guard agent_id as admin-only settable, exactly
--    like master_partner_id / is_manager. Recreate the trigger function with
--    the agent_id checks added (the body is otherwise identical to the live
--    definition from 20260810052907).
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.restrict_profiles_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role text;
BEGIN
  BEGIN
    v_jwt_role := current_setting('request.jwt.claims', true)::json->>'role';
  EXCEPTION WHEN others THEN
    v_jwt_role := NULL;
  END;

  IF public.has_role(auth.uid(), 'admin')
     OR v_jwt_role = 'service_role'
     OR session_user IN ('service_role', 'postgres', 'supabase_admin')
  THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.commission_amount := 0;
    NEW.student_status := 'not_applied';
    NEW.visa_status := 'not_applied';
    NEW.must_change_password := false;
    NEW.case_id := NULL;
    NEW.linked_case_id := NULL;
    NEW.deleted_at := NULL;
    NEW.iban_confirmed_at := NULL;
    NEW.is_master_partner := false;
    NEW.master_partner_id := NULL;
    NEW.is_manager := false;
    NEW.agent_id := NULL;
    NEW.deactivated_at := NULL;
    NEW.deactivated_by := NULL;
    NEW.deactivated_reason := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.commission_amount IS DISTINCT FROM OLD.commission_amount THEN
      RAISE EXCEPTION 'Non-admin users cannot change commission_amount';
    END IF;
    IF NEW.student_status IS DISTINCT FROM OLD.student_status THEN
      RAISE EXCEPTION 'Non-admin users cannot change student_status';
    END IF;
    IF NEW.visa_status IS DISTINCT FROM OLD.visa_status THEN
      RAISE EXCEPTION 'Non-admin users cannot change visa_status';
    END IF;
    IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
      RAISE EXCEPTION 'Non-admin users cannot change must_change_password';
    END IF;
    IF NEW.case_id IS DISTINCT FROM OLD.case_id THEN
      RAISE EXCEPTION 'Non-admin users cannot change case_id';
    END IF;
    IF NEW.linked_case_id IS DISTINCT FROM OLD.linked_case_id THEN
      RAISE EXCEPTION 'Non-admin users cannot change linked_case_id';
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'Non-admin users cannot change deleted_at';
    END IF;
    IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
      RAISE EXCEPTION 'Non-admin users cannot change referral_code';
    END IF;
    IF NEW.referral_code_enabled IS DISTINCT FROM OLD.referral_code_enabled THEN
      RAISE EXCEPTION 'Non-admin users cannot change referral_code_enabled';
    END IF;
    IF NEW.is_master_partner IS DISTINCT FROM OLD.is_master_partner THEN
      RAISE EXCEPTION 'Non-admin users cannot change is_master_partner';
    END IF;
    IF NEW.master_partner_id IS DISTINCT FROM OLD.master_partner_id THEN
      RAISE EXCEPTION 'Non-admin users cannot change master_partner_id';
    END IF;
    IF NEW.is_manager IS DISTINCT FROM OLD.is_manager THEN
      RAISE EXCEPTION 'Non-admin users cannot change is_manager';
    END IF;
    IF NEW.agent_id IS DISTINCT FROM OLD.agent_id THEN
      RAISE EXCEPTION 'Non-admin users cannot change agent_id';
    END IF;
    IF NEW.deactivated_at IS DISTINCT FROM OLD.deactivated_at
       OR NEW.deactivated_by IS DISTINCT FROM OLD.deactivated_by
       OR NEW.deactivated_reason IS DISTINCT FROM OLD.deactivated_reason THEN
      RAISE EXCEPTION 'Non-admin users cannot change account deactivation fields';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Non-admin users cannot change the profile id';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Non-admin users cannot change email';
    END IF;
    IF NEW.iban_confirmed_at IS DISTINCT FROM OLD.iban_confirmed_at THEN
      RAISE EXCEPTION 'Non-admin users cannot change iban_confirmed_at';
    END IF;
    IF OLD.iban_confirmed_at IS NOT NULL AND (
         NEW.iban IS DISTINCT FROM OLD.iban
      OR NEW.bank_name IS DISTINCT FROM OLD.bank_name
      OR NEW.bank_branch IS DISTINCT FROM OLD.bank_branch
      OR NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number
    ) THEN
      RAISE EXCEPTION 'Confirmed bank details can only be changed by an admin';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- The trigger name is unchanged; the existing BEFORE INSERT OR UPDATE trigger
-- re-binds to the new function body automatically.

-- ────────────────────────────────────────────────────────────────────────
-- 3. Commission config: platform_settings.agent_commission_rate + the per-agent
--    override table (mirrors partner_commission_overrides / master_override_amount).
-- ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS agent_commission_rate integer NOT NULL DEFAULT 200;

-- Extend the commission-allocation guard so the agent rate is also non-negative
-- and never exceeds the partner pool (same invariant as the master rate).
CREATE OR REPLACE FUNCTION public.validate_commission_allocation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.partner_commission_rate, 0) < 0
     OR COALESCE(NEW.master_partner_override_rate, 0) < 0
     OR COALESCE(NEW.agent_commission_rate, 0) < 0 THEN
    RAISE EXCEPTION 'Commission amounts cannot be negative';
  END IF;
  IF COALESCE(NEW.master_partner_override_rate, 0) > COALESCE(NEW.partner_commission_rate, 0) THEN
    RAISE EXCEPTION 'Master partner share (%) cannot exceed the partner pool (%)',
      NEW.master_partner_override_rate, NEW.partner_commission_rate;
  END IF;
  IF COALESCE(NEW.agent_commission_rate, 0) > COALESCE(NEW.partner_commission_rate, 0) THEN
    RAISE EXCEPTION 'Agent commission rate cannot exceed the partner pool',
      NEW.agent_commission_rate, NEW.partner_commission_rate;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.agent_commission_overrides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_commission_overrides_agent_id_key
  ON public.agent_commission_overrides (agent_id);

ALTER TABLE public.agent_commission_overrides ENABLE ROW LEVEL SECURITY;

-- An agent can read their own override row (so their dashboard shows the rate).
CREATE POLICY IF NOT EXISTS "Agents can read own override"
  ON public.agent_commission_overrides FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

-- Admins manage all agent overrides (commission configuration is admin-managed).
CREATE POLICY IF NOT EXISTS "Admins manage agent overrides"
  ON public.agent_commission_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_agent_overrides_updated ON public.agent_commission_overrides;
CREATE TRIGGER trg_agent_overrides_updated
  BEFORE UPDATE ON public.agent_commission_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_commission_overrides TO authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- 4. agent_relationships — the Agent ↔ recruit link + per-link agreement.
--    Modeled on partner_commission_overrides semantics (flat ILS). This is the
--    audit trail of who recruited whom and at what agreed rate; the live
--    effective rate is resolved by get_effective_agent_split().
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_relationships (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recruited_user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recruited_role        TEXT NOT NULL CHECK (recruited_role IN ('social_media_partner','ambassador')),
  commission_amount_ils INTEGER NOT NULL DEFAULT 0,
  agreement_status      TEXT NOT NULL DEFAULT 'configured',
  active                BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active relationship per (agent, recruit).
CREATE UNIQUE INDEX IF NOT EXISTS agent_relationships_agent_recruit_key
  ON public.agent_relationships (agent_id, recruited_user_id)
  WHERE recruited_user_id IS NOT NULL AND active = true;

CREATE INDEX IF NOT EXISTS idx_agent_relationships_agent ON public.agent_relationships(agent_id);

ALTER TABLE public.agent_relationships ENABLE ROW LEVEL SECURITY;

-- An agent can read/insert their own relationships. The recruited_user_id and
-- commission are admin-authoritative (the agent only creates the link to track
-- their network; the actual commission is computed server-side).
DROP POLICY IF EXISTS "Agents manage own relationships" ON public.agent_relationships;
CREATE POLICY "Agents manage own relationships"
  ON public.agent_relationships FOR ALL TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage all agent relationships" ON public.agent_relationships;
CREATE POLICY "Admins manage all agent relationships"
  ON public.agent_relationships FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_agent_relationships_updated ON public.agent_relationships;
CREATE TRIGGER trg_agent_relationships_updated
  BEFORE UPDATE ON public.agent_relationships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_relationships TO authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- 5. user_invitations.agent_id — carry agent attribution through activation,
--    mirroring master_partner_id (set by createInvitation, stamped on the
--    profile by accept-invitation).
-- ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_invitations
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────────────────
-- 6. get_effective_agent_split(p_agent_id, p_recruited_partner_id) — resolves
--    the flat agent commission carved from the partner pool. Per-agent override
--    wins; otherwise the global agent_commission_rate. Always clamped to the
--    pool (GREATEST(0, LEAST(amount, pool))) so it can never exceed it.
--    Returns: agent_amount, agent_id, pool_amount.
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_effective_agent_split(
  p_agent_id uuid,
  p_recruited_partner_id uuid
)
RETURNS TABLE(agent_amount integer, agent_id uuid, pool_amount integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool integer;
  v_amount integer := 0;
  v_override numeric;
BEGIN
  v_pool := public.partner_base_pool(p_recruited_partner_id);
  IF p_agent_id IS NULL THEN
    RETURN QUERY SELECT 0, NULL::uuid, v_pool;
    RETURN;
  END IF;

  SELECT commission_amount INTO v_override
  FROM agent_commission_overrides WHERE agent_id = p_agent_id;
  IF v_override IS NOT NULL THEN
    v_amount := v_override::integer;
  ELSE
    SELECT COALESCE(agent_commission_rate, 0) INTO v_amount FROM platform_settings LIMIT 1;
  END IF;

  v_amount := GREATEST(0, LEAST(v_amount, v_pool));
  RETURN QUERY SELECT v_amount, p_agent_id, v_pool;
END;
$$;

REVOKE ALL ON FUNCTION public.get_effective_agent_split(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_effective_agent_split(uuid, uuid) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- 7. get_my_agent_network() — the agent's recruited partners/ambassadors with
--    performance + earned-override totals. Mirrors get_my_network() for master
--    partners, scoped to profiles.agent_id = auth.uid().
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
  override_earned numeric
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
             AND rw.source_user_id = r.id)
  FROM recruits r
  ORDER BY r.created_at DESC
$function$;

REVOKE ALL ON FUNCTION public.get_my_agent_network() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_agent_network() TO authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- 8. get_staff_directory + start_direct_thread — allow agents through.
--    Agents talk to admins only (same rule as partners/ambassadors).
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_staff_directory()
RETURNS TABLE(id uuid, full_name text, role text, is_manager boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, ur.role::text, p.is_manager
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role IN ('team_member','admin','social_media_partner')
    AND p.deleted_at IS NULL
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (
        public.has_role(auth.uid(), 'team_member'::app_role)
        AND (ur.role = 'admin' OR p.is_manager = true)
      )
      OR (
        (public.has_role(auth.uid(), 'social_media_partner'::app_role)
         OR public.has_role(auth.uid(), 'ambassador'::app_role)
         OR public.has_role(auth.uid(), 'agent'::app_role))
        AND ur.role = 'admin'
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.start_direct_thread(p_other_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_thread uuid;
  v_me_admin boolean;
  v_me_agent boolean;
  v_me_partner boolean;
  v_other_admin boolean;
  v_other_manager boolean;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_other_user IS NULL OR p_other_user = v_me THEN
    RAISE EXCEPTION 'Pick another staff member';
  END IF;

  v_me_admin := public.has_role(v_me, 'admin'::app_role);
  v_me_partner := public.has_role(v_me, 'social_media_partner'::app_role)
                  OR public.has_role(v_me, 'ambassador'::app_role);
  v_me_agent := public.has_role(v_me, 'agent'::app_role);
  v_other_admin := public.has_role(p_other_user, 'admin'::app_role);
  SELECT COALESCE(is_manager, false) INTO v_other_manager FROM public.profiles WHERE id = p_other_user;

  IF NOT (v_me_admin OR v_other_admin OR v_other_manager) THEN
    RAISE EXCEPTION 'Direct messages must include an admin or a manager';
  END IF;

  IF NOT (v_me_admin
          OR public.has_role(v_me, 'team_member'::app_role)
          OR v_me_partner
          OR v_me_agent) THEN
    RAISE EXCEPTION 'Only staff can use direct messages';
  END IF;

  IF NOT (v_other_admin
          OR public.has_role(p_other_user, 'team_member'::app_role)
          OR public.has_role(p_other_user, 'social_media_partner'::app_role)
          OR public.has_role(p_other_user, 'ambassador'::app_role)
          OR public.has_role(p_other_user, 'agent'::app_role)) THEN
    RAISE EXCEPTION 'The selected user is not staff';
  END IF;

  -- team members may only talk to admins or managers
  IF NOT v_me_admin AND public.has_role(v_me, 'team_member'::app_role)
     AND NOT (v_other_admin OR v_other_manager) THEN
    RAISE EXCEPTION 'Team members can only message an admin or a manager';
  END IF;

  -- partners, ambassadors and agents may only talk to admins
  IF NOT v_me_admin AND (v_me_partner OR v_me_agent) AND NOT v_other_admin THEN
    RAISE EXCEPTION 'Partners and agents can only message an administrator';
  END IF;

  SELECT p1.thread_id INTO v_thread
  FROM public.direct_thread_participants p1
  JOIN public.direct_thread_participants p2 ON p2.thread_id = p1.thread_id
  WHERE p1.user_id = v_me AND p2.user_id = p_other_user
  LIMIT 1;

  IF v_thread IS NOT NULL THEN
    RETURN v_thread;
  END IF;

  INSERT INTO public.direct_threads (created_by) VALUES (v_me) RETURNING id INTO v_thread;
  INSERT INTO public.direct_thread_participants (thread_id, user_id)
  VALUES (v_thread, v_me), (v_thread, p_other_user);

  RETURN v_thread;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 9. request_payout_via_chat — allow agents to request a payout (their
--    agent_override rewards clear the same 20-day hold). Recreated with the
--    agent role added to the eligibility check; otherwise identical to the
--    live definition (20260809163608).
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_payout_via_chat(p_notes text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_role text;
  v_thread uuid;
  v_admin uuid;
  v_ids uuid[];
  v_names text[];
  v_amount numeric := 0;
  v_request uuid;
  v_reference text;
  v_message uuid;
  v_body text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT (public.has_role(v_me, 'social_media_partner'::app_role)
          OR public.has_role(v_me, 'ambassador'::app_role)
          OR public.has_role(v_me, 'team_member'::app_role)
          OR public.has_role(v_me, 'agent'::app_role)) THEN
    RAISE EXCEPTION 'Only partners, agents and team members can request a payout here';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('payout_request:' || v_me::text));

  IF EXISTS (SELECT 1 FROM public.payout_requests
             WHERE requestor_id = v_me AND status = 'pending') THEN
    RAISE EXCEPTION 'You already have a payout request awaiting review';
  END IF;

  SELECT array_agg(rw.id ORDER BY rw.created_at),
         array_agg(COALESCE(split_part(c.full_name, ' ', 1), 'Student') ORDER BY rw.created_at),
         COALESCE(SUM(rw.amount), 0)
  INTO v_ids, v_names, v_amount
  FROM public.rewards rw
  LEFT JOIN public.cases c ON c.id = rw.case_id
  WHERE rw.user_id = v_me
    AND rw.status = 'pending'
    AND COALESCE(rw.unlock_at, rw.created_at + interval '20 days') <= now()
    AND NOT EXISTS (
      SELECT 1 FROM public.payout_requests pr
      WHERE pr.status <> 'rejected' AND pr.linked_reward_ids && ARRAY[rw.id]
    );

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'You have no earnings that have cleared the 20-day hold yet';
  END IF;

  SELECT role::text INTO v_role FROM public.user_roles WHERE user_id = v_me LIMIT 1;

  SELECT dtp.thread_id INTO v_thread
  FROM public.direct_thread_participants dtp
  JOIN public.direct_thread_participants other
    ON other.thread_id = dtp.thread_id AND other.user_id <> dtp.user_id
  WHERE dtp.user_id = v_me
    AND public.has_role(other.user_id, 'admin'::app_role)
  ORDER BY dtp.thread_id
  LIMIT 1;

  IF v_thread IS NULL THEN
    SELECT ur.user_id INTO v_admin
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'admin' AND p.deleted_at IS NULL
    ORDER BY p.created_at
    LIMIT 1;

    IF v_admin IS NULL THEN RAISE EXCEPTION 'No administrator is available right now'; END IF;
    v_thread := public.start_direct_thread(v_admin);
  END IF;

  INSERT INTO public.payout_requests (
    requestor_id, requestor_role, linked_reward_ids, linked_student_names,
    amount, status, payment_method, admin_notes, thread_id
  )
  VALUES (
    v_me,
    COALESCE(v_role, 'social_media_partner'),
    v_ids,
    v_names,
    v_amount,
    'pending',
    'bank_transfer',
    left(COALESCE(p_notes, ''), 1000),
    v_thread
  )
  RETURNING id, payout_reference INTO v_request, v_reference;

  UPDATE public.rewards
  SET payout_requested_at = now()
  WHERE id = ANY(v_ids);

  v_body := 'Payout request ' || COALESCE(v_reference, '') || ' — ' || round(v_amount)::text
            || ' ILS for ' || array_length(v_ids, 1)::text || ' case(s).';

  v_message := public.send_direct_message(v_thread, v_body, '[]'::jsonb, '{}'::uuid[]);

  UPDATE public.direct_messages
  SET kind = 'payout_request', payout_request_id = v_request, request_status = 'pending'
  WHERE id = v_message;

  RETURN jsonb_build_object(
    'request_id', v_request,
    'payout_reference', v_reference,
    'thread_id', v_thread,
    'message_id', v_message,
    'amount', v_amount,
    'cases', array_length(v_ids, 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_payout_via_chat(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_payout_via_chat(text) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- 10. get_my_role — add 'agent' to the role-precedence CASE so an agent's
--     single role resolves correctly.
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'admin' THEN 1
    WHEN 'team_member' THEN 2
    WHEN 'social_media_partner' THEN 3
    WHEN 'ambassador' THEN 4
    WHEN 'agent' THEN 5
    WHEN 'student' THEN 6
    ELSE 7 END
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────
-- 11. role_permissions — seed the agent role with the same minimal permission
--     set as a partner/ambassador (view own earnings, request payout, manage
--     referral links). Agent does NOT inherit any team/admin permission.
-- ────────────────────────────────────────────────────────────────────────
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'agent'::public.app_role, id FROM public.permissions
WHERE key IN ('view_referrals','manage_referral_links','view_own_earnings','request_payout')
ON CONFLICT DO NOTHING;

COMMIT;
