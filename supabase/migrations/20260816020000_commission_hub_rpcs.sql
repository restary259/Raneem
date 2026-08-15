-- ════════════════════════════════════════════════════════════════════════
-- Commission Hub — Migration C: admin write RPC + Hub read RPCs
-- ════════════════════════════════════════════════════════════════════════
-- admin_set_commission is the SINGLE write path for ALL commission config
-- (partner / team / agent / agent-self-referral / student-friend /
--  student-family / per-student / global). It is SECURITY DEFINER, admin-only,
-- and writes the override row + a commission_rate_history row atomically —
-- satisfying Rule 4 (who configured it / when / old → new). This replaces the
-- direct-table upserts in CommissionSettingsPanel (which left no audit trail).
--
-- The read RPCs back the Admin Commission Hub UI:
--   get_commission_hub_overview()            — totals / ₪0 accounts / custom / networks
--   get_agent_network_detail(p_agent_id)     — partners/ambassadors/direct/students
--   get_independent_accounts()               — partners/ambassadors with no recruiter
--   get_account_commission_history(p_user_id)— commission + referral + payout ledger
--   get_student_referral_config()            — friend/family discount+reward + overrides
--
-- All read RPCs are admin-only (has_role('admin')) and STABLE.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════════════════════════════
-- admin_set_commission — the single commission-config write path
-- ════════════════════════════════════════════════════════════════════════
-- Args:
--   p_entity_type  ∈ global | partner | team | agent | agent_self_referral |
--                    student_override
--   (student friend/family GLOBAL rates use entity_type='global' with the
--    matching rate_kind; per-student overrides use 'student_override' with
--    rate_kind 'friend'|'family'.)
--   p_entity_id    UUID (NULL for global)
--   p_rate_kind    which rate to set (see the CASE below)
--   p_amount       the new ₪ amount (>= 0)
--   p_reason       optional human note
-- Returns jsonb { ok, entity_type, entity_id, rate_kind, old_value, new_value }
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

  CASE p_entity_type
    -- ── Global platform_settings rates ──────────────────────────────────────
    WHEN 'global' THEN
      -- Validate p_rate_kind against the actual platform_settings columns so
      -- the allow-list can never drift out of sync with the schema. %I quoting
      -- + this guard make the dynamic SQL injection-safe.
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

    -- ── Partner / ambassador per-account override ───────────────────────────
    WHEN 'partner' THEN
      IF p_entity_id IS NULL THEN RAISE EXCEPTION 'entity_id required for partner'; END IF;
      SELECT commission_amount INTO v_old FROM partner_commission_overrides WHERE partner_id = p_entity_id;
      INSERT INTO partner_commission_overrides (partner_id, commission_amount, notes, updated_at)
        VALUES (p_entity_id, p_amount, p_reason, now())
        ON CONFLICT (partner_id) DO UPDATE
          SET commission_amount = EXCLUDED.commission_amount,
              notes = COALESCE(EXCLUDED.notes, partner_commission_overrides.notes),
              updated_at = now();

    -- ── Team member per-account override ────────────────────────────────────
    WHEN 'team' THEN
      IF p_entity_id IS NULL THEN RAISE EXCEPTION 'entity_id required for team'; END IF;
      SELECT commission_amount INTO v_old FROM team_member_commission_overrides WHERE team_member_id = p_entity_id;
      INSERT INTO team_member_commission_overrides (team_member_id, commission_amount, notes, updated_at)
        VALUES (p_entity_id, p_amount, p_reason, now())
        ON CONFLICT (team_member_id) DO UPDATE
          SET commission_amount = EXCLUDED.commission_amount,
              notes = COALESCE(EXCLUDED.notes, team_member_commission_overrides.notes),
              updated_at = now();

    -- ── Agent network override ──────────────────────────────────────────────
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

    -- ── Agent self-referral override ────────────────────────────────────────
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

    -- ── Student per-(student,type) referral-reward override ─────────────────
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

  -- Atomic audit row.
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

-- ════════════════════════════════════════════════════════════════════════
-- get_commission_hub_overview — Hub Overview KPIs
-- ════════════════════════════════════════════════════════════════════════
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
                                  AND p.agent_id IS NULL AND p.master_partner_id IS NULL
                                  AND p.deleted_at IS NULL),
    'master_partners',        (SELECT count(*) FROM public.profiles p
                                WHERE p.is_master_partner = true AND p.deleted_at IS NULL),
    'global_rates', (SELECT jsonb_build_object(
        'partner', partner_commission_rate,
        'ambassador', ambassador_commission_rate,
        'team', team_member_commission_rate,
        'master_share', master_partner_override_rate,
        'agent', agent_commission_rate,
        'agent_self_referral', agent_self_referral_rate,
        'referral_discount', referral_discount_amount,
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

-- ════════════════════════════════════════════════════════════════════════
-- get_agent_network_detail — one agent's network (partners/ambassadors/direct)
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_agent_network_detail(p_agent_id uuid)
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
  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur
                  WHERE ur.user_id = p_agent_id AND ur.role = 'agent') THEN
    RAISE EXCEPTION 'Not an agent: %', p_agent_id;
  END IF;

  SELECT jsonb_build_object(
    'agent', (SELECT jsonb_build_object(
      'id', p.id, 'name', p.full_name, 'email', p.email,
      'default_override', COALESCE((SELECT commission_amount FROM agent_commission_overrides WHERE agent_id = p.id), NULL),
      'global_rate', (SELECT COALESCE(agent_commission_rate, 0) FROM platform_settings LIMIT 1),
      'self_referral_override', COALESCE((SELECT commission_amount FROM agent_self_referral_overrides WHERE agent_id = p.id), NULL),
      'self_referral_global', (SELECT COALESCE(agent_self_referral_rate, 0) FROM platform_settings LIMIT 1)
    ) FROM public.profiles p WHERE p.id = p_agent_id),
    'recruits', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC) FROM (
        SELECT p.id, p.full_name, p.email,
               COALESCE((SELECT ur.role::text FROM public.user_roles ur
                          WHERE ur.user_id = p.id AND ur.role IN ('social_media_partner','ambassador') LIMIT 1), 'social_media_partner') AS role,
               COALESCE((SELECT o.commission_amount FROM partner_commission_overrides o WHERE o.partner_id = p.id), NULL) AS partner_override,
               (SELECT count(DISTINCT c.id) FROM public.cases c WHERE c.partner_id = p.id AND c.deleted_at IS NULL) AS students_referred,
               (SELECT count(DISTINCT c.id) FROM public.cases c WHERE c.partner_id = p.id AND c.status = 'enrollment_paid' AND c.deleted_at IS NULL) AS students_enrolled,
               (SELECT COALESCE(sum(rw.amount),0) FROM public.rewards rw WHERE rw.user_id = p.id AND rw.reward_type = 'referral') AS partner_earned,
               p.created_at
        FROM public.profiles p
        WHERE p.agent_id = p_agent_id AND p.deleted_at IS NULL
      ) r
    ), '[]'::jsonb),
    'direct_referrals', (SELECT count(DISTINCT c.id) FROM public.cases c
        WHERE c.partner_id = p_agent_id AND c.deleted_at IS NULL),
    'override_earned', (SELECT COALESCE(sum(amount),0) FROM public.rewards
        WHERE user_id = p_agent_id AND reward_type = 'agent_override'),
    'self_referral_earned', (SELECT COALESCE(sum(amount),0) FROM public.rewards
        WHERE user_id = p_agent_id AND reward_type = 'referral'),
    'total_earned', (SELECT COALESCE(sum(amount),0) FROM public.rewards WHERE user_id = p_agent_id),
    'pending', (SELECT COALESCE(sum(amount),0) FROM public.rewards
        WHERE user_id = p_agent_id AND status IN ('pending','approved','requested')),
    'paid', (SELECT COALESCE(sum(amount),0) FROM public.rewards
        WHERE user_id = p_agent_id AND status = 'paid')
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_agent_network_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agent_network_detail(uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- get_agent_list — all agents with override + recruited counts (Hub Agents tab)
-- ════════════════════════════════════════════════════════════════════════
-- Single server-side join so the Hub never hand-rolls the agent list client-
-- side (keeping one source of truth, RLS-respecting).
CREATE OR REPLACE FUNCTION public.get_agent_list()
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
  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.name), '[]'::jsonb) INTO v_result
  FROM (
    SELECT p.id, p.full_name AS name, p.email,
           COALESCE(o.commission_amount, NULL) AS override,
           COALESCE((SELECT agent_commission_rate FROM platform_settings LIMIT 1), 0) AS global_rate,
           (SELECT count(DISTINCT c.id) FROM public.cases c
              WHERE c.partner_id IN (SELECT pr.id FROM public.profiles pr WHERE pr.agent_id = p.id AND pr.deleted_at IS NULL)
                AND c.deleted_at IS NULL) AS students_referred,
           (SELECT COALESCE(sum(rw.amount),0) FROM public.rewards rw
              WHERE rw.user_id = p.id AND rw.reward_type = 'agent_override') AS earned
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'agent'
    LEFT JOIN agent_commission_overrides o ON o.agent_id = p.id
    WHERE p.deleted_at IS NULL
  ) r;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_agent_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agent_list() TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- get_independent_accounts — partners/ambassadors with no recruiter
-- ════════════════════════════════════════════════════════════════════════
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
    WHERE p.agent_id IS NULL AND p.master_partner_id IS NULL AND p.deleted_at IS NULL
  ) r;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_independent_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_independent_accounts() TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- get_account_commission_history — full commission + referral + payout ledger
-- ════════════════════════════════════════════════════════════════════════
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
      'agent_id', p.agent_id, 'master_partner_id', p.master_partner_id,
      'is_master_partner', p.is_master_partner
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

-- ════════════════════════════════════════════════════════════════════════
-- get_student_referral_config — friend/family discount+reward + overrides
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_student_referral_config()
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
    'global', (SELECT jsonb_build_object(
        'friend_discount', student_refer_friend_discount,
        'friend_reward', student_refer_friend_reward,
        'family_discount', student_refer_family_discount,
        'family_reward', student_refer_family_reward
      ) FROM platform_settings LIMIT 1),
    'overrides', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.full_name) FROM (
        SELECT o.id, o.student_id, o.referral_type, o.reward_amount, o.notes,
               o.created_by, o.created_at, o.updated_at,
               p.full_name AS full_name, p.email
        FROM student_referral_reward_overrides o
        JOIN public.profiles p ON p.id = o.student_id
        WHERE p.deleted_at IS NULL
      ) r
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_referral_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_referral_config() TO authenticated;

COMMIT;
