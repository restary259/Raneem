-- ════════════════════════════════════════════════════════════════════════
-- Fix: admin_set_commission 'global' branch blocked by pg-safeupdate
-- ════════════════════════════════════════════════════════════════════════
-- Symptom: saving any GLOBAL commission rate in the Hub failed live with
--   "UPDATE requires a WHERE clause"
-- Supabase projects with the pg-safeupdate extension enabled reject UPDATE
-- without a WHERE clause at the SQL level. The 'global' branch of
-- admin_set_commission ran
--   EXECUTE format('UPDATE platform_settings SET %I = ..., updated_by = $2', ...)
-- with no WHERE. All other entity branches use predicated upserts and were
-- unaffected — only the Global rates tab errored. Fix: WHERE true (the only
-- extension point safeupdate requires; the settings table is single-row, so
-- the predicate intentionally matches it). Function body otherwise verbatim
-- from the live 20260818000000 definition — INCLUDING the obsolete-rate
-- rejection (master_partner_override_rate / referral_discount_amount) and the
-- information_schema column guard — so nothing else drifts.
--
-- MANUAL DEPLOY (dashboard SQL editor / supabase db push). Timestamp must
-- stay later than 20260828000000 to keep this the newest definition.
-- ════════════════════════════════════════════════════════════════════════

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
  -- referral_discount_amount was the generic single-column discount replaced
  -- by the type-aware student_refer_friend/family_discount columns. Reject it
  -- explicitly so an admin cannot write the now-unused column (the
  -- information_schema guard below would only catch it AFTER the optional
  -- cleanup drops the column).
  IF p_entity_type = 'global' AND p_rate_kind = 'referral_discount_amount' THEN
    RAISE EXCEPTION 'The generic referral_discount_amount is no longer used (replaced by student_refer_friend/family_discount)';
  END IF;

  CASE p_entity_type
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
      -- WHERE true: pg-safeupdate only requires a WHERE condition; the
      -- settings table is single-row so the predicate intentionally matches it.
      EXECUTE format('UPDATE platform_settings SET %I = $1, updated_at = now(), updated_by = $2 WHERE true',
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
