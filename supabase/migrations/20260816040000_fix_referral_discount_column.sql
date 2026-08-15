-- ════════════════════════════════════════════════════════════════════════
-- DEFINITIVE FIX: column "referral_discount_amount" does not exist
-- ════════════════════════════════════════════════════════════════════════
-- Root cause: get_commission_hub_overview() and get_referral_discount_amount()
-- reference platform_settings columns by name. In plpgsql, column references
-- are resolved at RUNTIME, not at CREATE FUNCTION time. So the RPC creates
-- successfully even if the column is missing — then explodes when the Hub
-- page calls it.
--
-- This migration is self-contained: it (1) adds every column the RPCs
-- reference, then (2) recreates the RPCs. Running JUST this one migration
-- fixes the error regardless of which earlier migrations were applied.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Ensure all platform_settings columns exist ──────────────────────────
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS partner_commission_rate        NUMERIC NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS ambassador_commission_rate     NUMERIC NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS team_member_commission_rate    NUMERIC NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS master_partner_override_rate   NUMERIC NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS agent_commission_rate          NUMERIC NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS agent_self_referral_rate       NUMERIC NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS referral_discount_amount       NUMERIC NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS student_refer_friend_discount  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS student_refer_friend_reward    NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS student_refer_family_discount  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS student_refer_family_reward    NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_rate                       NUMERIC NOT NULL DEFAULT 0.18;

-- ── 2. Ensure profiles columns exist (AdminStudents page) ──────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS linked_case_id            UUID,
  ADD COLUMN IF NOT EXISTS updated_by_student_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eye_color                 TEXT,
  ADD COLUMN IF NOT EXISTS has_changed_legal_name    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS previous_legal_name       TEXT,
  ADD COLUMN IF NOT EXISTS has_criminal_record       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS criminal_record_details   TEXT,
  ADD COLUMN IF NOT EXISTS has_dual_citizenship      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS second_passport_country   TEXT,
  ADD COLUMN IF NOT EXISTS must_change_password      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS passport_expiry           DATE,
  ADD COLUMN IF NOT EXISTS arrival_date              DATE,
  ADD COLUMN IF NOT EXISTS emergency_contact         TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name    TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone   TEXT,
  ADD COLUMN IF NOT EXISTS intake_month              TEXT,
  ADD COLUMN IF NOT EXISTS referral_code             TEXT,
  ADD COLUMN IF NOT EXISTS referral_code_enabled     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS agent_id                  UUID,
  ADD COLUMN IF NOT EXISTS master_partner_id         UUID,
  ADD COLUMN IF NOT EXISTS is_master_partner         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by                UUID,
  ADD COLUMN IF NOT EXISTS case_id                   UUID,
  ADD COLUMN IF NOT EXISTS city                      TEXT,
  ADD COLUMN IF NOT EXISTS gender                    TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth             DATE,
  ADD COLUMN IF NOT EXISTS country                   TEXT,
  ADD COLUMN IF NOT EXISTS nationality               TEXT,
  ADD COLUMN IF NOT EXISTS university_name           TEXT,
  ADD COLUMN IF NOT EXISTS notes                     TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at                TIMESTAMPTZ;

-- ── 3. Recreate get_referral_discount_amount (student-facing RPC) ──────────
-- This is called by ReferralForm.tsx. If it was never created (Aug 13
-- migration skipped), the student referral form silently falls back to 500.
CREATE OR REPLACE FUNCTION public.get_referral_discount_amount()
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_amount numeric;
BEGIN
  SELECT ps.referral_discount_amount
    INTO v_amount
    FROM public.platform_settings ps
   LIMIT 1;
  RETURN v_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.get_referral_discount_amount() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_referral_discount_amount() TO authenticated;

-- ── 4. Recreate get_commission_hub_overview (admin Hub RPC) ────────────────
-- This is the one that throws "column referral_discount_amount does not exist"
-- when the Hub page loads. Now that the columns are guaranteed to exist (step
-- 1), the runtime column resolution will succeed.
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

COMMIT;
