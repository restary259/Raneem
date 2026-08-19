-- ════════════════════════════════════════════════════════════════════════
-- Commission Hub rebuild — every surface reads the production resolvers
-- ════════════════════════════════════════════════════════════════════════
-- One authoritative resolution path (override-if-exists-else-global) feeds the
-- commission engine, the Hub, and the simulator. No engine changes, no new
-- commission math. Rates resolve dynamically at enrollment; accounts without
-- overrides follow later global-rate changes. Preserved.
--
-- (a) get_commission_hub_overview — adds recruited/direct splits
-- (b) get_agent_list              — adds self-referral override + global + status
-- (c) get_team_members_commission — captured into VCS (was out-of-band), adds
--                                   is_manager + global_rate
-- (d) get_partner_list / (e) get_ambassador_list — NEW (all accounts incl.
--                                   recruited, with agent name)
-- (f) get_commission_simulation_inputs — resolves a person's EFFECTIVE rates by
--                                   calling the SAME resolver functions the
--                                   engine calls (partner_base_pool,
--                                   get_effective_agent_split under the
--                                   app.internal_commission_split GUC,
--                                   get_effective_agent_self_referral,
--                                   get_student_referral_reward). The simulator
--                                   never re-implements rate resolution in TS.
-- ════════════════════════════════════════════════════════════════════════

-- ── (a) Overview — adds recruited/direct splits ─────────────────────────────
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
    -- recruited vs direct split (user_roles × profiles; deleted_at IS NULL)
    'recruited_partners', (SELECT count(*) FROM roles r JOIN public.profiles p ON p.id = r.user_id
                            WHERE r.role = 'social_media_partner'
                              AND p.agent_id IS NOT NULL AND p.deleted_at IS NULL),
    'recruited_ambassadors', (SELECT count(*) FROM roles r JOIN public.profiles p ON p.id = r.user_id
                               WHERE r.role = 'ambassador'
                                 AND p.agent_id IS NOT NULL AND p.deleted_at IS NULL),
    'direct_partners', (SELECT count(*) FROM roles r JOIN public.profiles p ON p.id = r.user_id
                         WHERE r.role = 'social_media_partner'
                           AND p.agent_id IS NULL AND p.deleted_at IS NULL),
    'direct_ambassadors', (SELECT count(*) FROM roles r JOIN public.profiles p ON p.id = r.user_id
                            WHERE r.role = 'ambassador'
                              AND p.agent_id IS NULL AND p.deleted_at IS NULL),
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

-- ── (b) Agents — adds self-referral rates + status ──────────────────────────
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
           (SELECT sro.commission_amount FROM agent_self_referral_overrides sro
             WHERE sro.agent_id = p.id) AS self_referral_override,
           COALESCE((SELECT agent_self_referral_rate FROM platform_settings LIMIT 1), 0) AS self_referral_global,
           CASE WHEN p.deactivated_at IS NULL THEN 'active' ELSE 'inactive' END AS status,
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

-- ── (c) Team members — captured into VCS, adds is_manager + global_rate ─────
-- The function previously existed only on the live DB (created out-of-band);
-- this CREATE OR REPLACE makes the repo its source of truth. The returned
-- columns the frontend already consumes (id, name, email, override) are
-- preserved; is_manager + global_rate are additive.
CREATE OR REPLACE FUNCTION public.get_team_members_commission()
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
           (SELECT o.commission_amount FROM team_member_commission_overrides o
             WHERE o.team_member_id = p.id) AS override,
           COALESCE((SELECT team_member_commission_rate FROM platform_settings LIMIT 1), 0) AS global_rate,
           p.is_manager
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'team_member'
    WHERE p.deleted_at IS NULL
  ) r;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_team_members_commission() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_members_commission() TO authenticated;

-- ── (d) Partners — ALL accounts (recruited + direct) with agent name ────────
CREATE OR REPLACE FUNCTION public.get_partner_list()
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
           (SELECT o.commission_amount FROM partner_commission_overrides o
             WHERE o.partner_id = p.id) AS override,
           COALESCE((SELECT partner_commission_rate FROM platform_settings LIMIT 1), 0) AS global_rate,
           p.agent_id,
           a.full_name AS agent_name,
           (SELECT count(DISTINCT c.id) FROM public.cases c
              WHERE c.partner_id = p.id AND c.deleted_at IS NULL) AS students_referred,
           (SELECT COALESCE(sum(rw.amount),0) FROM public.rewards rw
              WHERE rw.user_id = p.id AND rw.reward_type = 'referral') AS earned
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'social_media_partner'
    LEFT JOIN public.profiles a ON a.id = p.agent_id
    WHERE p.deleted_at IS NULL
  ) r;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_partner_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_list() TO authenticated;

-- ── (e) Ambassadors — same shape, default = ambassador_commission_rate ──────
CREATE OR REPLACE FUNCTION public.get_ambassador_list()
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
           (SELECT o.commission_amount FROM partner_commission_overrides o
             WHERE o.partner_id = p.id) AS override,
           COALESCE((SELECT ambassador_commission_rate FROM platform_settings LIMIT 1), 0) AS global_rate,
           p.agent_id,
           a.full_name AS agent_name,
           (SELECT count(DISTINCT c.id) FROM public.cases c
              WHERE c.partner_id = p.id AND c.deleted_at IS NULL) AS students_referred,
           (SELECT COALESCE(sum(rw.amount),0) FROM public.rewards rw
              WHERE rw.user_id = p.id AND rw.reward_type = 'referral') AS earned
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'ambassador'
    LEFT JOIN public.profiles a ON a.id = p.agent_id
    WHERE p.deleted_at IS NULL
  ) r;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_ambassador_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ambassador_list() TO authenticated;

-- ── (f) Simulator inputs — resolves effective rates via production resolvers ─
-- Always returns the current globals. When p_user_id is given, also returns
-- the person's role/agent linkage and their EFFECTIVE rates resolved by
-- calling the SAME functions the commission engine calls. The agent's
-- additive rate is read under the app.internal_commission_split GUC (the
-- same escape hatch the engine uses), reset immediately after.
CREATE OR REPLACE FUNCTION public.get_commission_simulation_inputs(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_result jsonb;
  v_globals jsonb;
  v_person jsonb;
  v_role text;
  v_name text;
  v_email text;
  v_agent_id uuid;
  v_agent_name text;
  v_effective jsonb;
  v_recruiter jsonb;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'partner', partner_commission_rate,
    'ambassador', ambassador_commission_rate,
    'team', team_member_commission_rate,
    'agent', agent_commission_rate,
    'agent_self_referral', agent_self_referral_rate,
    'student_friend_discount', student_refer_friend_discount,
    'student_friend_reward', student_refer_friend_reward,
    'student_family_discount', student_refer_family_discount,
    'student_family_reward', student_refer_family_reward
  ) INTO v_globals FROM platform_settings LIMIT 1;

  v_person := NULL;

  IF p_user_id IS NOT NULL THEN
    SELECT p.full_name, p.email, p.agent_id INTO v_name, v_email, v_agent_id
    FROM public.profiles p WHERE p.id = p_user_id;

    SELECT ur.role::text INTO v_role FROM public.user_roles ur
    WHERE ur.user_id = p_user_id LIMIT 1;

    IF v_agent_id IS NOT NULL THEN
      SELECT a.full_name INTO v_agent_name FROM public.profiles a WHERE a.id = v_agent_id;
    END IF;

    -- The internal-GUC escape hatch — same pattern the engine uses to read
    -- the agent additive split. Reset to 'off' right after.
    PERFORM set_config('app.internal_commission_split', 'on', true);

    v_effective := '{}'::jsonb;
    IF v_role = 'team_member' THEN
      v_effective := jsonb_build_object('team',
        COALESCE((SELECT o.commission_amount FROM team_member_commission_overrides o
                   WHERE o.team_member_id = p_user_id),
                 COALESCE((SELECT team_member_commission_rate FROM platform_settings LIMIT 1), 0)));
    ELSIF v_role IN ('social_media_partner', 'ambassador') THEN
      v_effective := jsonb_build_object('partner', public.partner_base_pool(p_user_id));
      IF v_agent_id IS NOT NULL THEN
        v_recruiter := jsonb_build_object(
          'id', v_agent_id,
          'name', v_agent_name,
          'agent_effective', COALESCE((SELECT amount FROM public.get_effective_agent_split(v_agent_id, p_user_id)), 0));
      END IF;
    ELSIF v_role = 'agent' THEN
      v_effective := jsonb_build_object(
        'agent_self_referral', COALESCE((SELECT amount FROM public.get_effective_agent_self_referral(p_user_id)), 0),
        'agent', COALESCE((SELECT amount FROM public.get_effective_agent_split(p_user_id, NULL)), 0));
    ELSIF v_role = 'student' THEN
      v_effective := jsonb_build_object(
        'student_friend_reward', public.get_student_referral_reward(p_user_id, 'friend'),
        'student_family_reward', public.get_student_referral_reward(p_user_id, 'family'));
    END IF;

    PERFORM set_config('app.internal_commission_split', 'off', true);

    v_person := jsonb_build_object(
      'id', p_user_id,
      'name', v_name,
      'email', v_email,
      'role', v_role,
      'agent_id', v_agent_id,
      'agent_name', v_agent_name,
      'is_recruited', (v_agent_id IS NOT NULL),
      'effective', v_effective,
      'recruiter', v_recruiter
    );
  END IF;

  v_result := jsonb_build_object('globals', v_globals, 'person', v_person);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_commission_simulation_inputs(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_commission_simulation_inputs(uuid) TO authenticated;
