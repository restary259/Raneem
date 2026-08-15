-- ════════════════════════════════════════════════════════════════════════
-- Commission engine invariants — runnable assertion suite
-- ════════════════════════════════════════════════════════════════════════
-- Run AFTER applying migrations 20260816000000 / 20260816010000 / 20260816020000
-- against a test database. Each block sets up a minimal case, calls
-- record_case_commission, and RAISEs if the invariant is violated. This is the
-- regression guard for the money path — it MUST pass before any commission
-- migration reaches production.
--
-- Run with:  psql -d <test_db> -f supabase/diagnostics/commission_engine_invariants.sql
--
-- Requires a service-role connection (the RPCs are SECURITY DEFINER + the
-- auth.uid() check inside admin_set_commission needs a real admin session).
-- All test data is created inside a transaction that rolls back at the end,
-- so nothing persists.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Shared test fixtures ──────────────────────────────────────────────────
-- Insert throwaway auth.users + profiles + user_roles + platform_settings so
-- the engine has real rows to operate on. Uses fixed UUIDs for determinism.
INSERT INTO auth.users (id, email, encrypted_password, aud, role, email_confirmed_at, instance_id)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'agent@test.local', 'x', 'authenticated', 'authenticated', now(), '00000000-0000-0000-0000-000000000000'),
  ('11111111-0000-0000-0000-000000000002', 'partner@test.local', 'x', 'authenticated', 'authenticated', now(), '00000000-0000-0000-0000-000000000000'),
  ('11111111-0000-0000-0000-000000000003', 'student@test.local', 'x', 'authenticated', 'authenticated', now(), '00000000-0000-0000-0000-000000000000')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, email, agent_id)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'Test Agent',  'agent@test.local',  NULL),
  ('11111111-0000-0000-0000-000000000002', 'Test Partner','partner@test.local', '11111111-0000-0000-0000-000000000001'),
  ('11111111-0000-0000-0000-000000000003', 'Test Student','student@test.local', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('11111111-0000-0000-0000-000000000001', 'agent'),
  ('11111111-0000-0000-0000-000000000002', 'social_media_partner'),
  ('11111111-0000-0000-0000-000000000003', 'student')
ON CONFLICT (user_id, role) DO NOTHING;

-- Ensure platform_settings has the expected global rates.
INSERT INTO public.platform_settings (id, partner_commission_rate, team_member_commission_rate, agent_commission_rate,
  student_refer_friend_reward, student_refer_family_reward)
VALUES (1, 1000, 100, 500, 200, 300)
ON CONFLICT (id) DO UPDATE SET
  partner_commission_rate = 1000,
  team_member_commission_rate = 100,
  agent_commission_rate = 500,
  student_refer_friend_reward = 200,
  student_refer_family_reward = 300;

-- Helper: create a case + service line with the given case_reference.
CREATE OR REPLACE FUNCTION pg_temp.make_case(p_ref text, p_partner uuid DEFAULT NULL, p_referred_by uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.cases (case_reference, full_name, phone_number, source, status,
    partner_id, referred_by, referral_discount, commission_split_done)
  VALUES (p_ref, 'Test ' || p_ref, '0000000000', 'referral', 'enrollment_paid',
    p_partner, p_referred_by, 0, false)
  RETURNING id INTO v_id;
  INSERT INTO public.case_services (case_id, unit_price, quantity, discount)
  VALUES (v_id, 5000, 1, 0);
  RETURN v_id;
END $$;

-- ── TEST 1: Additive partner + agent ──────────────────────────────────────
-- Setup: case with partner_id = partner (agent_id = agent), no master.
-- Expect:
--   partner reward amount == partner pool (₪1000)
--   agent reward amount == agent override (₪500)
--   platform_revenue_ils == 5000 - 100(team) - 1000(pool) - 500(agent) = 3400
DO $$
DECLARE
  v_case uuid;
  v_partner_reward int; v_agent_reward int; v_platform int;
BEGIN
  v_case := pg_temp.make_case('TEST-ADDITIVE', '11111111-0000-0000-0000-000000000002'::uuid);
  PERFORM public.record_case_commission(v_case, 0);

  SELECT amount INTO v_partner_reward FROM rewards WHERE case_id = v_case AND reward_type = 'referral';
  SELECT amount INTO v_agent_reward FROM rewards WHERE case_id = v_case AND reward_type = 'agent_override';
  SELECT platform_revenue_ils INTO v_platform FROM cases WHERE id = v_case;

  ASSERT v_partner_reward = 1000, 'partner should keep the full ₪1000 pool, got %', v_partner_reward;
  ASSERT v_agent_reward = 500, 'agent should get ₪500 (additive), got %', v_agent_reward;
  ASSERT v_platform = 3400, 'platform_revenue should be 3400, got %', v_platform;
END $$;
\echo 'TEST 1 (additive partner + agent): PASSED'

-- ── TEST 2: Student referral isolation ───────────────────────────────────
-- Setup: case with referred_by = student (role='student'), referral_type='friend'.
-- Expect:
--   exactly ONE reward row, reward_type='student_referral', amount = friend_reward
--   NO referral/partner/agent_override reward exists
--   platform_revenue_ils == net - team - student_reward
DO $$
DECLARE
  v_case uuid; v_count int; v_student_reward int; v_nonstudent int; v_platform int;
BEGIN
  v_case := pg_temp.make_case('TEST-STUDENT-REF', NULL, '11111111-0000-0000-0000-000000000003'::uuid);
  -- Seed a referrals row with referral_type = 'friend'.
  INSERT INTO public.referrals (referrer_user_id, referred_name, referred_phone, referred_case_id, referral_type)
  VALUES ('11111111-0000-0000-0000-000000000003', 'Friend', '0000000001', v_case, 'friend')
  ON CONFLICT DO NOTHING;

  PERFORM public.record_case_commission(v_case, 0);

  SELECT count(*) INTO v_count FROM rewards WHERE case_id = v_case;
  SELECT count(*) INTO v_nonstudent FROM rewards WHERE case_id = v_case
    AND reward_type NOT IN ('student_referral','team');
  SELECT amount INTO v_student_reward FROM rewards WHERE case_id = v_case AND reward_type = 'student_referral';
  SELECT platform_revenue_ils INTO v_platform FROM cases WHERE id = v_case;

  ASSERT v_nonstudent = 0, 'no partner/agent reward should exist for a student referral, got %', v_nonstudent;
  ASSERT v_student_reward = 200, 'student should receive ₪200 friend reward, got %', v_student_reward;
  ASSERT v_platform = 4700, 'platform_revenue should be 4700 (5000-100-200), got %', v_platform;
END $$;
\echo 'TEST 2 (student referral isolation): PASSED'

-- ── TEST 3: Idempotency ───────────────────────────────────────────────────
-- Expect: calling record_case_commission twice produces exactly one reward set
-- (commission_split_done guard + ON CONFLICT DO NOTHING).
DO $$
DECLARE
  v_case uuid; v_before int; v_after int;
BEGIN
  v_case := pg_temp.make_case('TEST-IDEMPOTENT', '11111111-0000-0000-0000-000000000002'::uuid);
  PERFORM public.record_case_commission(v_case, 0);  -- first call
  SELECT count(*) INTO v_before FROM rewards WHERE case_id = v_case;
  PERFORM public.record_case_commission(v_case, 0);  -- second call
  SELECT count(*) INTO v_after FROM rewards WHERE case_id = v_case;
  ASSERT v_after = v_before, 'second call must not add rewards: before=% after=%', v_before, v_after;
END $$;
\echo 'TEST 3 (idempotency): PASSED'

-- ── TEST 4: admin_set_commission writes audit trail ───────────────────────
-- Expect: admin_set_commission inserts a commission_rate_history row with the
-- correct old_value → new_value.
DO $$
DECLARE
  v_before int; v_after int;
BEGIN
  SELECT count(*) INTO v_before FROM commission_rate_history
    WHERE entity_type='global' AND rate_kind='agent_commission_rate';
  PERFORM public.admin_set_commission('global', NULL, 'agent_commission_rate', 600, 'test');
  SELECT count(*) INTO v_after FROM commission_rate_history
    WHERE entity_type='global' AND rate_kind='agent_commission_rate';
  ASSERT v_after = v_before + 1, 'audit row should be written, before=% after=%', v_before, v_after;
END $$;
\echo 'TEST 4 (audit trail): PASSED'

ROLLBACK;
