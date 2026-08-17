-- ════════════════════════════════════════════════════════════════════════
-- Commission simplification — flat, independent, additive architecture
-- ════════════════════════════════════════════════════════════════════════
-- Removes the Master Partner concept from the active commission engine and
-- wires the Ambassador rate correctly (the canonical partner_base_pool read
-- ONLY partner_commission_rate, so ambassadors silently reused the Partner
-- rate). The engine is now flat: each role resolves its own rate from
-- platform_settings (or its per-account override), independent of every other
-- role, and the agent share is additive on top of the partner/ambassador pool.
--
-- This is a CREATE OR REPLACE only — it affects FUTURE enrollment_paid cases.
-- Historical rewards are frozen by cases.commission_split_done + the
-- case_financial_snapshots row; already-paid commissions are NEVER
-- recalculated, and historical master_partner/master_override/network_split
-- rewards remain intact (the frontend classifier keeps bucketing them into the
-- partner pool for historical financial overviews).
--
-- What this migration changes:
--   1. partner_base_pool — role-aware: ambassador_commission_rate for
--      ambassadors, partner_commission_rate for partners (per-account
--      override still wins for either role).
--   2. record_case_commission — NO master branch, NO get_effective_partner_split
--      call. The partner/ambassador keeps the FULL pool (no master carve).
--      Preserves the case_financial_snapshots INSERT (G3), the margin-safety
--      warning (G2), the attribution-priority docs (G6), and log_case_event.
--   3. get_commission_hub_overview — drops master_partners and master_share
--      (global_rates); keeps partners_at_zero (unrelated to master).
--   4. admin_set_commission — rejects the obsolete master_partner_override_rate
--      global rate_kind.
--   5. get_student_referral_discount_by_type — new student-readable RPC that
--      returns the friend/family discount (replaces the generic
--      get_referral_discount_amount used by the student ReferralForm).
--
-- OPTIONAL CLEANUP section (clearly delimited at the bottom) drops the now-
-- fully-unused master profile state, the obsolete rate columns, and the rate-
-- offer subsystem. It is safe to run in preproduction; in a populated DB,
-- review it first. The REQUIRED section does NOT drop any columns or tables,
-- so the app keeps working even if the optional section is deferred.
--
-- Requires Supabase admin/service-role DDL — NOT applied by the Vercel build
-- or ci.yml. Run via `supabase db push` or the dashboard SQL editor.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- REQUIRED SECTION
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. partner_base_pool — role-aware override/global lookup ──────────────
-- Per-account override still wins for EITHER role. When no override exists,
-- the role determines the global default: ambassadors use
-- ambassador_commission_rate, partners use partner_commission_rate. This
-- fixes the silent bug where ambassadors reused the partner rate. The role is
-- resolved from user_roles (ambassador takes priority so a dual-role account
-- is deterministic); a missing role falls back to the partner rate (legacy
-- safety, matches the prior behaviour for unclassified accounts).
CREATE OR REPLACE FUNCTION public.partner_base_pool(p_partner_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool integer;
  v_is_ambassador boolean := false;
BEGIN
  IF p_partner_id IS NULL THEN RETURN 0; END IF;

  SELECT commission_amount INTO v_pool
  FROM partner_commission_overrides WHERE partner_id = p_partner_id;
  IF v_pool IS NOT NULL THEN
    RETURN COALESCE(v_pool, 0);
  END IF;

  -- No per-account override → resolve the global default by role.
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_partner_id AND ur.role = 'ambassador'
  ) INTO v_is_ambassador;

  IF v_is_ambassador THEN
    SELECT COALESCE(ambassador_commission_rate, 0) INTO v_pool FROM platform_settings LIMIT 1;
  ELSE
    SELECT COALESCE(partner_commission_rate, 0) INTO v_pool FROM platform_settings LIMIT 1;
  END IF;
  RETURN COALESCE(v_pool, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.partner_base_pool(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.partner_base_pool(uuid) TO service_role;


-- ── 2. record_case_commission — simplified flat engine (no master branch) ─
-- The partner/ambassador keeps the FULL pool (no master carve). The agent
-- override remains ADDITIVE (paid on top of the pool from DARB's margin).
-- Preserves: pg_advisory_xact_lock + commission_split_done idempotency,
-- ON CONFLICT DO NOTHING on rewards, the 20-day unlock, the
-- case_financial_snapshots freeze (G3), the margin-safety warning (G2), the
-- attribution-priority docs (G6), and the commission_recorded log_case_event.
--
-- ATTRIBUTION PRIORITY (deterministic, single winner):
--   1. cases.partner_id wins over cases.referred_by (COALESCE order).
--   2. Role lookup on the winner: partner/ambassador > agent (self-ref) > student.
--      The first match wins — no fallback chain once a role is found.
--   3. Student referrals create a NEW attribution boundary (Rule 6, ISOLATED):
--      they pay ONLY the referring student and NEVER propagate upstream.
--   4. A NULL referrer (no partner_id and no referred_by) pays only the team
--      commission; no partner/agent/student rewards are created.
CREATE OR REPLACE FUNCTION public.record_case_commission(p_case_id uuid, p_total_payment_ils integer DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_case RECORD;
  v_base integer := 0;
  v_net integer := 0;
  v_t_comm integer := 0;
  v_pool integer := 0;
  v_partner_comm integer := 0;
  v_partner_id uuid;
  v_is_partner boolean := false;
  v_is_ambassador boolean := false;
  v_is_agent_self_referral boolean := false;
  v_is_student_referrer boolean := false;
  v_agent_self_amount integer := 0;
  v_agent uuid;
  v_agent_share integer := 0;
  v_agent_split RECORD;
  v_student_reward integer := 0;
  v_referral_type text;
  v_admin_remainder integer := 0;
  v_global_team_rate integer := 100;
  v_total_payouts integer := 0;
  v_referrer_role text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('case_commission:' || p_case_id::text));

  SELECT id, assigned_to, source, partner_id, referred_by, status, case_reference,
         commission_split_done, referral_discount
  INTO v_case FROM cases WHERE id = p_case_id;
  IF NOT FOUND OR v_case.commission_split_done THEN RETURN; END IF;
  IF v_case.status IS DISTINCT FROM 'enrollment_paid' THEN
    RAISE EXCEPTION 'Commission can only be recorded once the case reaches enrollment_paid (current: %)', v_case.status;
  END IF;

  -- Gross base — matches get_case_darb_service_total (no currency filter: DARB
  -- service lines are always ILS, and the read functions sum all rows).
  SELECT COALESCE(SUM(GREATEST(unit_price * quantity - discount, 0)), 0)::integer
  INTO v_base
  FROM case_services
  WHERE case_id = p_case_id;

  IF v_base <= 0 THEN
    RAISE EXCEPTION 'Cannot record commission: the case has no positive DARB service total';
  END IF;

  -- Net base after the referral discount (the amount the student was invoiced).
  v_net := GREATEST(v_base - COALESCE(v_case.referral_discount, 0), 0);

  SELECT COALESCE(team_member_commission_rate, 100)
  INTO v_global_team_rate
  FROM platform_settings LIMIT 1;

  -- ── Team commission (flat, from margin, independent of the referral chain) ─
  IF v_case.assigned_to IS NOT NULL THEN
    SELECT commission_amount INTO v_t_comm
    FROM team_member_commission_overrides
    WHERE team_member_id = v_case.assigned_to;
    v_t_comm := COALESCE(v_t_comm, v_global_team_rate);
    IF v_t_comm > 0 THEN
      INSERT INTO rewards (
        user_id, amount, status, case_id, reward_type, admin_notes,
        recipient_role, case_reference, rate_used, base_amount, rate_source,
        unlock_at, created_by_event
      ) VALUES (
        v_case.assigned_to, v_t_comm, 'pending', p_case_id, 'team',
        'Team commission from case ' || COALESCE(v_case.case_reference, p_case_id::text),
        'team_member', v_case.case_reference, v_t_comm, v_base, 'calculated_service_total',
        now() + interval '20 days', 'case_enrollment_paid'
      ) ON CONFLICT (case_id, user_id, reward_type) WHERE case_id IS NOT NULL DO NOTHING;
    END IF;
  END IF;

  -- ── Resolve the referrer and classify the chain ──────────────────────────
  v_partner_id := COALESCE(v_case.partner_id, v_case.referred_by);
  IF v_partner_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = v_partner_id AND ur.role = 'ambassador'
    ) INTO v_is_ambassador;

    IF v_is_ambassador THEN
      v_is_partner := true;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = v_partner_id AND ur.role = 'social_media_partner'
      ) INTO v_is_partner;
    END IF;

    IF NOT v_is_partner THEN
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = v_partner_id AND ur.role = 'agent'
      ) INTO v_is_agent_self_referral;
    END IF;

    IF NOT v_is_partner AND NOT v_is_agent_self_referral THEN
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = v_partner_id AND ur.role = 'student'
      ) INTO v_is_student_referrer;
    END IF;
  END IF;

  IF v_is_student_referrer THEN
    -- ── Student → Student referral (Rule 6, ISOLATED) ───────────────────────
    -- Pays ONLY the referring student a flat reward. NEVER propagates upstream.
    SELECT referral_type INTO v_referral_type
    FROM public.referrals
    WHERE referred_case_id = p_case_id
    ORDER BY created_at DESC
    LIMIT 1;

    v_student_reward := public.get_student_referral_reward(v_partner_id, v_referral_type);
    IF v_student_reward > 0 THEN
      INSERT INTO rewards (
        user_id, amount, status, case_id, reward_type, source_user_id, admin_notes,
        recipient_role, case_reference, rate_used, base_amount, rate_source,
        unlock_at, created_by_event
      ) VALUES (
        v_partner_id, v_student_reward, 'pending', p_case_id, 'student_referral', v_partner_id,
        'Student ' || COALESCE(v_referral_type, 'referral') || ' referral reward from case '
          || COALESCE(v_case.case_reference, p_case_id::text),
        'student', v_case.case_reference, v_student_reward, v_base, 'calculated_service_total',
        now() + interval '20 days', 'case_enrollment_paid'
      ) ON CONFLICT (case_id, user_id, reward_type) WHERE case_id IS NOT NULL DO NOTHING;
    END IF;

  ELSIF v_is_agent_self_referral THEN
    -- ── Agent self-referral (agent is the direct referrer) ──────────────────
    -- Pays the self-referral rate as a 'referral' reward. NO agent_override
    -- reward is created (isolation: self-referral is not a network override).
    SELECT amount INTO v_agent_self_amount FROM public.get_effective_agent_self_referral(v_partner_id);
    v_agent_self_amount := COALESCE(v_agent_self_amount, 0);
    IF v_agent_self_amount > 0 THEN
      INSERT INTO rewards (
        user_id, amount, status, case_id, reward_type, admin_notes,
        recipient_role, case_reference, rate_used, base_amount, rate_source,
        unlock_at, created_by_event
      ) VALUES (
        v_partner_id, v_agent_self_amount, 'pending', p_case_id, 'referral',
        'Agent self-referral from case ' || COALESCE(v_case.case_reference, p_case_id::text),
        'agent', v_case.case_reference, v_agent_self_amount, v_base, 'calculated_service_total',
        now() + interval '20 days', 'case_enrollment_paid'
      ) ON CONFLICT (case_id, user_id, reward_type) WHERE case_id IS NOT NULL DO NOTHING;
    END IF;

  ELSIF v_is_partner THEN
    -- ── Partner / Ambassador referral (the professional pool, flat) ─────────
    -- The referrer keeps the FULL pool (no master carve). partner_base_pool is
    -- role-aware so an ambassador resolves ambassador_commission_rate.
    v_pool := public.partner_base_pool(v_partner_id);
    v_partner_comm := GREATEST(0, v_pool);

    IF v_partner_comm > 0 THEN
      INSERT INTO rewards (
        user_id, amount, status, case_id, reward_type, admin_notes,
        recipient_role, case_reference, rate_used, base_amount, rate_source,
        unlock_at, created_by_event
      ) VALUES (
        v_partner_id, v_partner_comm, 'pending', p_case_id, 'referral',
        (CASE WHEN v_is_ambassador THEN 'Ambassador' ELSE 'Partner' END)
          || ' commission from case ' || COALESCE(v_case.case_reference, p_case_id::text),
        (CASE WHEN v_is_ambassador THEN 'ambassador' ELSE 'partner' END),
        v_case.case_reference, v_partner_comm, v_pool, 'calculated_service_total',
        now() + interval '20 days', 'case_enrollment_paid'
      ) ON CONFLICT (case_id, user_id, reward_type) WHERE case_id IS NOT NULL DO NOTHING;
    END IF;

    -- Agent override is ADDITIVE: paid on top of the pool, from DARB's margin.
    SELECT p.agent_id INTO v_agent FROM public.profiles p WHERE p.id = v_partner_id;
    IF v_agent IS NOT NULL AND v_agent <> v_partner_id THEN
      PERFORM set_config('app.internal_commission_split', 'on', true);
      SELECT * INTO v_agent_split FROM public.get_effective_agent_split(v_agent, v_partner_id);
      PERFORM set_config('app.internal_commission_split', 'off', true);
      v_agent_share := GREATEST(0, COALESCE(v_agent_split.agent_amount, 0));
    END IF;

    IF v_agent IS NOT NULL AND v_agent <> v_partner_id AND v_agent_share > 0 THEN
      INSERT INTO rewards (
        user_id, amount, status, case_id, reward_type, source_user_id, admin_notes,
        recipient_role, case_reference, rate_used, base_amount, rate_source,
        unlock_at, created_by_event
      ) VALUES (
        v_agent, v_agent_share, 'pending', p_case_id, 'agent_override', v_partner_id,
        'Agent recruitment share from case ' || COALESCE(v_case.case_reference, p_case_id::text),
        'agent', v_case.case_reference, v_agent_share, v_agent_share, 'calculated_service_total',
        now() + interval '20 days', 'case_enrollment_paid'
      ) ON CONFLICT (case_id, user_id, reward_type) WHERE case_id IS NOT NULL DO NOTHING;
    END IF;
  END IF;

  -- Referral lifecycle milestone.
  UPDATE public.referrals
     SET status = 'rewarded'
   WHERE referred_case_id = p_case_id
     AND status IS DISTINCT FROM 'rewarded';

  -- ── Platform revenue (ADDITIVE model, no master carve) ────────────────────
  IF v_is_agent_self_referral THEN
    v_admin_remainder := GREATEST(0, v_net - v_t_comm - v_agent_self_amount);
    v_total_payouts := v_t_comm + v_agent_self_amount;
    v_referrer_role := 'agent';
  ELSIF v_is_student_referrer THEN
    v_admin_remainder := GREATEST(0, v_net - v_t_comm - v_student_reward);
    v_total_payouts := v_t_comm + v_student_reward;
    v_referrer_role := 'student';
  ELSIF v_is_partner THEN
    v_admin_remainder := GREATEST(0, v_net - v_t_comm - v_pool - v_agent_share);
    v_total_payouts := v_t_comm + v_pool + v_agent_share;
    v_referrer_role := CASE WHEN v_is_ambassador THEN 'ambassador' ELSE 'partner' END;
  ELSE
    v_admin_remainder := GREATEST(0, v_net - v_t_comm);
    v_total_payouts := v_t_comm;
    v_referrer_role := NULL;
  END IF;

  -- ── G2: Margin-safety warning (non-blocking) ─────────────────────────────
  IF v_total_payouts > v_net THEN
    PERFORM public.log_case_event(
      p_case_id,
      'commission_margin_warning',
      jsonb_build_object(
        'net', v_net,
        'total_payouts', v_total_payouts,
        'overage', v_total_payouts - v_net,
        'team', v_t_comm,
        'pool', v_pool,
        'agent_share', v_agent_share,
        'agent_self_amount', v_agent_self_amount,
        'student_reward', v_student_reward,
        'model', 'additive_flat'
      ),
      true
    );
  END IF;

  -- ── G3: Write the immutable financial snapshot (once, never overwritten) ─
  -- master_partner_id / master_rate_used / master_override are frozen at NULL/0:
  -- the simplified engine has no master branch. The columns are retained so
  -- historical snapshots (written by the prior engine) keep their values.
  INSERT INTO public.case_financial_snapshots (
    case_id, gross_total, referral_discount, net_total,
    referrer_id, referrer_role, agent_id, master_partner_id,
    partner_rate_used, agent_rate_used, master_rate_used, team_rate_used, student_reward_used,
    partner_commission, agent_override, master_override, team_commission,
    student_reward, total_payouts, darb_margin,
    attribution_model, is_agent_self_referral, is_student_referrer, student_referral_type
  ) VALUES (
    p_case_id, v_base, COALESCE(v_case.referral_discount, 0), v_net,
    v_partner_id, v_referrer_role, v_agent, NULL,
    v_pool, v_agent_share, 0, v_t_comm, v_student_reward,
    v_partner_comm, v_agent_share, 0, v_t_comm,
    v_student_reward, v_total_payouts, v_admin_remainder,
    'additive_flat', v_is_agent_self_referral, v_is_student_referrer, v_referral_type
  ) ON CONFLICT (case_id) DO NOTHING;

  UPDATE cases
  SET platform_revenue_ils = v_admin_remainder,
      commission_split_done = true
  WHERE id = p_case_id;

  PERFORM public.log_case_event(
    p_case_id,
    'commission_recorded',
    jsonb_build_object(
      'base_amount', v_base,
      'net_after_discount', v_net,
      'team_amount', v_t_comm,
      'partner_pool', v_pool,
      'partner_amount', v_partner_comm,
      'agent_share', v_agent_share,
      'agent_id', v_agent,
      'agent_self_referral', v_is_agent_self_referral,
      'agent_self_referral_amount', v_agent_self_amount,
      'student_referrer', v_is_student_referrer,
      'student_referrer_reward', v_student_reward,
      'student_referral_type', v_referral_type,
      'platform_revenue', v_admin_remainder,
      'referral_discount', COALESCE(v_case.referral_discount, 0),
      'total_payouts', v_total_payouts,
      'referrer_role', v_referrer_role,
      'model', 'additive_flat',
      'source', 'case_services'
    ),
    true
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_case_commission(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_case_commission(uuid, integer) TO service_role;


-- ── 3. get_commission_hub_overview — drop master_partners + master_share ──
-- Keeps partners_at_zero (unrelated to master). Removes master_partners count
-- and the master_share global rate. The independent_partners count no longer
-- filters on master_partner_id (the column is dropped in the optional section;
-- until then, keeping the filter is harmless, but we drop it now so the RPC
-- never depends on a column we intend to remove).
CREATE OR REPLACE FUNCTION public.get_commission_hub_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_admin uuid := auth.uid(); v_result jsonb;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  WITH roles AS (
    SELECT ur.user_id, ur.role FROM public.user_roles ur
    WHERE ur.role IN ('team_member','social_media_partner','ambassador','agent','student')
  ),
  partners AS (
    SELECT r.user_id FROM roles r WHERE r.role IN ('social_media_partner','ambassador')
  )
  SELECT jsonb_build_object(
    'team_members_total',     (SELECT count(*) FROM roles WHERE role = 'team_member'),
    'partners_total',         (SELECT count(*) FROM partners),
    'partners_custom',        (SELECT count(*) FROM partner_commission_overrides),
    'partners_at_zero',       (SELECT count(*) FROM partners p
                                JOIN partner_commission_overrides o ON o.partner_id = p.user_id
                                WHERE o.commission_amount = 0),
    'ambassadors_total',      (SELECT count(*) FROM roles WHERE role = 'ambassador'),
    'agents_total',           (SELECT count(*) FROM roles WHERE role = 'agent'),
    'agents_custom',          (SELECT count(*) FROM agent_commission_overrides),
    'students_total',         (SELECT count(*) FROM roles WHERE role = 'student'),
    'student_overrides',      (SELECT count(*) FROM student_referral_reward_overrides),
    'independent_partners',   (SELECT count(*) FROM public.profiles p
                                JOIN roles r ON r.user_id = p.id
                                WHERE r.role IN ('social_media_partner','ambassador')
                                  AND p.agent_id IS NULL
                                  AND p.deleted_at IS NULL),
    'global_rates', (SELECT jsonb_build_object(
        'partner', partner_commission_rate,
        'ambassador', ambassador_commission_rate,
        'team', team_member_commission_rate,
        'agent', agent_commission_rate,
        'agent_self_referral', agent_self_referral_rate,
        'student_friend_discount', student_refer_friend_discount,
        'student_friend_reward', student_refer_friend_reward,
        'student_family_discount', student_refer_family_discount,
        'student_family_reward', student_refer_family_reward
      ) FROM platform_settings LIMIT 1),
    'recent_changes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', h.id, 'entity_type', h.entity_type, 'entity_id', h.entity_id,
        'rate_kind', h.rate_kind, 'old_value', h.old_value, 'new_value', h.new_value,
        'changed_by', h.changed_by, 'changed_at', h.changed_at, 'reason', h.reason
      ) ORDER BY h.changed_at DESC)
      FROM (SELECT * FROM commission_rate_history ORDER BY changed_at DESC LIMIT 20) h
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_commission_hub_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_commission_hub_overview() TO authenticated;


-- ── 4. admin_set_commission — reject obsolete master rate_kind ─────────────
-- The global 'master_partner_override_rate' column is obsolete (no engine
-- branch reads it). Reject attempts to set it so the Hub cannot leave a stale
-- value that implies a master carve exists. The allow-list is otherwise
-- unchanged (the information_schema guard still validates every other column).
CREATE OR REPLACE FUNCTION public.admin_set_commission(
  p_entity_type text,
  p_entity_id   uuid,
  p_rate_kind   text,
  p_amount      integer,
  p_reason      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_old   numeric;
  v_new   numeric := p_amount;
  v_row   record;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'Admin access required to configure commissions';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Commission amount must be a non-negative integer (₪)';
  END IF;
  -- Reject the obsolete master rate kind up front (before the column guard
  -- would otherwise accept it).
  IF p_entity_type = 'global' AND p_rate_kind = 'master_partner_override_rate' THEN
    RAISE EXCEPTION 'The master partner override rate is no longer used (master partners were removed)';
  END IF;

  CASE p_entity_type
    WHEN 'global' THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name  = 'platform_settings'
          AND column_name = p_rate_kind
      ) THEN RAISE EXCEPTION 'Unknown global rate_kind: %', p_rate_kind; END IF;

      EXECUTE format('SELECT %I FROM platform_settings LIMIT 1', p_rate_kind) INTO v_old;
      EXECUTE format('UPDATE platform_settings SET %I = $1, updated_at = now(), updated_by = $2',
                     p_rate_kind)
        USING p_amount, v_admin;

    WHEN 'partner' THEN
      IF p_entity_id IS NULL THEN RAISE EXCEPTION 'entity_id required for partner'; END IF;
      SELECT commission_amount INTO v_old FROM partner_commission_overrides WHERE partner_id = p_entity_id;
      INSERT INTO partner_commission_overrides (partner_id, commission_amount, notes, updated_at)
        VALUES (p_entity_id, p_amount, p_reason, now())
        ON CONFLICT (partner_id) DO UPDATE
          SET commission_amount = EXCLUDED.commission_amount,
              notes = COALESCE(EXCLUDED.notes, partner_commission_overrides.notes),
              updated_at = now();

    WHEN 'team' THEN
      IF p_entity_id IS NULL THEN RAISE EXCEPTION 'entity_id required for team'; END IF;
      SELECT commission_amount INTO v_old FROM team_member_commission_overrides WHERE team_member_id = p_entity_id;
      INSERT INTO team_member_commission_overrides (team_member_id, commission_amount, notes, updated_at)
        VALUES (p_entity_id, p_amount, p_reason, now())
        ON CONFLICT (team_member_id) DO UPDATE
          SET commission_amount = EXCLUDED.commission_amount,
              notes = COALESCE(EXCLUDED.notes, team_member_commission_overrides.notes),
              updated_at = now();

    WHEN 'agent' THEN
      IF p_entity_id IS NULL THEN RAISE EXCEPTION 'entity_id required for agent'; END IF;
      SELECT commission_amount INTO v_old FROM agent_commission_overrides WHERE agent_id = p_entity_id;
      INSERT INTO agent_commission_overrides (agent_id, commission_amount, notes, updated_at, created_by)
        VALUES (p_entity_id, p_amount, p_reason, now(), v_admin)
        ON CONFLICT (agent_id) DO UPDATE
          SET commission_amount = EXCLUDED.commission_amount,
              notes = COALESCE(EXCLUDED.notes, agent_commission_overrides.notes),
              updated_at = now(),
              created_by = COALESCE(agent_commission_overrides.created_by, v_admin);

    WHEN 'agent_self_referral' THEN
      IF p_entity_id IS NULL THEN RAISE EXCEPTION 'entity_id required for agent_self_referral'; END IF;
      SELECT commission_amount INTO v_old FROM agent_self_referral_overrides WHERE agent_id = p_entity_id;
      INSERT INTO agent_self_referral_overrides (agent_id, commission_amount, notes, updated_at, created_by)
        VALUES (p_entity_id, p_amount, p_reason, now(), v_admin)
        ON CONFLICT (agent_id) DO UPDATE
          SET commission_amount = EXCLUDED.commission_amount,
              notes = COALESCE(EXCLUDED.notes, agent_self_referral_overrides.notes),
              updated_at = now(),
              created_by = COALESCE(agent_self_referral_overrides.created_by, v_admin);

    WHEN 'student_override' THEN
      IF p_entity_id IS NULL THEN RAISE EXCEPTION 'entity_id required for student_override'; END IF;
      IF p_rate_kind NOT IN ('friend','family') THEN
        RAISE EXCEPTION 'student_override rate_kind must be friend or family';
      END IF;
      SELECT reward_amount INTO v_old FROM student_referral_reward_overrides
        WHERE student_id = p_entity_id AND referral_type = p_rate_kind;
      INSERT INTO student_referral_reward_overrides (student_id, referral_type, reward_amount, notes, created_by, updated_at)
        VALUES (p_entity_id, p_rate_kind, p_amount, p_reason, v_admin, now())
        ON CONFLICT (student_id, referral_type) DO UPDATE
          SET reward_amount = EXCLUDED.reward_amount,
              notes = COALESCE(EXCLUDED.notes, student_referral_reward_overrides.notes),
              created_by = COALESCE(student_referral_reward_overrides.created_by, v_admin),
              updated_at = now();

    ELSE
      RAISE EXCEPTION 'Unknown entity_type: %', p_entity_type;
  END CASE;

  INSERT INTO public.commission_rate_history
    (entity_type, entity_id, rate_kind, old_value, new_value, changed_by, reason)
  VALUES (p_entity_type, p_entity_id, p_rate_kind, v_old, v_new, v_admin, p_reason);

  RETURN jsonb_build_object(
    'ok', true,
    'entity_type', p_entity_type,
    'entity_id', p_entity_id,
    'rate_kind', p_rate_kind,
    'old_value', v_old,
    'new_value', v_new
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_commission(text, uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_commission(text, uuid, text, integer, text) TO authenticated;


-- ── 5. get_student_referral_discount_by_type — friend/family discount RPC ──
-- Student-readable (no platform_settings RLS bypass needed beyond this one
-- value). Returns the configured discount for the given referral_type. The
-- generic get_referral_discount_amount (which read referral_discount_amount)
-- is obsolete: the student referral form now asks by type so a friend and a
-- family referral can carry different discounts. Returns 0 for an unknown/
-- NULL type (no unsafe default).
CREATE OR REPLACE FUNCTION public.get_student_referral_discount_by_type(p_referral_type text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric := 0;
  v_type text;
BEGIN
  v_type := lower(COALESCE(p_referral_type, ''));
  IF v_type NOT IN ('friend', 'family') THEN
    RETURN 0;
  END IF;
  SELECT CASE v_type
           WHEN 'friend' THEN COALESCE(student_refer_friend_discount, 0)
           WHEN 'family' THEN COALESCE(student_refer_family_discount, 0)
         END
  INTO v_amount FROM platform_settings LIMIT 1;
  RETURN COALESCE(v_amount, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_referral_discount_by_type(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_referral_discount_by_type(text) TO authenticated;


-- ── 6. get_account_commission_history — drop master fields from the account ─
-- The account object no longer surfaces master_partner_id / is_master_partner
-- (the Hub drawer stopped rendering them). The rewards rows are untouched, so
-- historical master_partner rewards still appear in the ledger by reward_type.
CREATE OR REPLACE FUNCTION public.get_account_commission_history(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_admin uuid := auth.uid(); v_result jsonb;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  SELECT jsonb_build_object(
    'account', (SELECT jsonb_build_object(
      'id', p.id, 'name', p.full_name, 'email', p.email,
      'role', (SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.id LIMIT 1),
      'agent_id', p.agent_id
    ) FROM public.profiles p WHERE p.id = p_user_id),
    'rewards', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC) FROM (
        SELECT rw.id, rw.amount, rw.status, rw.reward_type, rw.recipient_role,
               rw.source_user_id, rw.case_id, rw.case_reference, rw.rate_used,
               rw.base_amount, rw.unlock_at, rw.paid_at, rw.payout_requested_at,
               rw.admin_notes, rw.created_at,
               c.case_reference AS linked_case_reference, c.status AS case_status
        FROM public.rewards rw
        LEFT JOIN public.cases c ON c.id = rw.case_id
        WHERE rw.user_id = p_user_id
      ) r
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'total', (SELECT COALESCE(sum(amount),0) FROM public.rewards WHERE user_id = p_user_id),
      'pending', (SELECT COALESCE(sum(amount),0) FROM public.rewards WHERE user_id = p_user_id AND status IN ('pending','approved','requested')),
      'paid', (SELECT COALESCE(sum(amount),0) FROM public.rewards WHERE user_id = p_user_id AND status = 'paid'),
      'by_type', COALESCE((SELECT jsonb_object_agg(reward_type, total) FROM (
          SELECT reward_type, COALESCE(sum(amount),0) AS total FROM public.rewards
          WHERE user_id = p_user_id GROUP BY reward_type
      ) s), '{}'::jsonb)
    ),
    'rate_changes', COALESCE((
      SELECT jsonb_agg(row_to_json(h) ORDER BY h.changed_at DESC) FROM (
        SELECT entity_type, rate_kind, old_value, new_value, changed_by, changed_at, reason
        FROM commission_rate_history
        WHERE entity_id = p_user_id
        ORDER BY changed_at DESC
      ) h
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_account_commission_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_account_commission_history(uuid) TO authenticated;


-- ── 7. get_independent_accounts — drop the master_partner_id filter ─────────
-- "Independent" now means simply "no agent recruiter". The master_partner_id
-- filter is removed (the column is dropped in the optional section).
CREATE OR REPLACE FUNCTION public.get_independent_accounts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_admin uuid := auth.uid(); v_result jsonb;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.role, r.name), '[]'::jsonb) INTO v_result
  FROM (
    SELECT p.id, p.full_name AS name, p.email,
           COALESCE((SELECT ur.role::text FROM public.user_roles ur
                      WHERE ur.user_id = p.id AND ur.role IN ('social_media_partner','ambassador') LIMIT 1), 'social_media_partner') AS role,
           COALESCE((SELECT o.commission_amount FROM partner_commission_overrides o WHERE o.partner_id = p.id), NULL) AS override,
           (SELECT count(DISTINCT c.id) FROM public.cases c WHERE c.partner_id = p.id AND c.deleted_at IS NULL) AS students_referred,
           (SELECT COALESCE(sum(rw.amount),0) FROM public.rewards rw WHERE rw.user_id = p.id AND rw.reward_type = 'referral') AS earned
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role IN ('social_media_partner','ambassador')
    WHERE p.agent_id IS NULL AND p.deleted_at IS NULL
  ) r;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_independent_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_independent_accounts() TO authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- OPTIONAL CLEANUP SECTION
-- ════════════════════════════════════════════════════════════════════════
-- Preproduction cleanup: drops the now-fully-unused master partner state,
-- the obsolete generic referral_discount_amount column, the get_referral_discount_amount
-- RPC, and the rate-offer subsystem (RPCs + table). Everything below is
-- idempotent (IF EXISTS). In a populated database, review the diagnostic
-- SELECTs first — these drops are irreversible.
--
-- The frontend no longer references any of these after the companion code
-- changes. The case_financial_snapshots master_partner_id / master_rate_used /
-- master_override columns are RETAINED (historical snapshots written by the
-- prior engine keep their values; the new engine writes NULL/0).
-- ════════════════════════════════════════════════════════════════════════


-- Clear any active master partner flags so the Hub/Members pages show no
-- master state after the columns are dropped. Idempotent.
UPDATE public.profiles SET is_master_partner = false, master_partner_id = NULL
WHERE is_master_partner = true OR master_partner_id IS NOT NULL;

-- Drop the master partner profile columns.
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS is_master_partner,
  DROP COLUMN IF EXISTS master_partner_id;

-- Drop the obsolete global rate columns (no engine branch reads them).
ALTER TABLE public.platform_settings
  DROP COLUMN IF EXISTS master_partner_override_rate,
  DROP COLUMN IF EXISTS referral_discount_amount;

-- Drop the obsolete generic referral-discount RPC (replaced by
-- get_student_referral_discount_by_type).
DROP FUNCTION IF EXISTS public.get_referral_discount_amount();

-- Drop the partner_recruit_applications.master_partner_id column + its FK +
-- index. The table itself is retained (recruit applications are still used
-- for agent/partner recruitment); the column is obsolete.
DROP INDEX IF EXISTS public.idx_recruit_apps_master;
ALTER TABLE public.partner_recruit_applications
  DROP COLUMN IF EXISTS master_partner_id;

-- Drop the rate-offer subsystem (master-partner-only). Nothing reads or writes
-- these after the frontend changes. Signatures must match the live definitions
-- so DROP FUNCTION resolves the right overload.
DROP FUNCTION IF EXISTS public.get_my_rate_offers();
DROP FUNCTION IF EXISTS public.partner_respond_rate_offer(uuid, boolean);
DROP FUNCTION IF EXISTS public.master_send_rate_offer(uuid, integer, text);
DROP TABLE IF EXISTS public.partner_rate_offers;

-- get_effective_partner_split is no longer called by the engine (the flat
-- model resolves the pool directly via partner_base_pool). Drop it so no
-- future caller resurrects the master carve. Its body read
-- profiles.master_partner_id / partner_rate_offers, both of which are dropped
-- above, so retaining it would error on the first call anyway.
DROP FUNCTION IF EXISTS public.get_effective_partner_split(uuid);
