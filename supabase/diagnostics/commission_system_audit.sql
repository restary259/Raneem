-- commission_system_audit.sql
-- Diagnostic audit for the Darb/Raneem commission system (post-Hub rebuild).
-- Safe to run on production: read-only, no DDL, no writes.
--
-- Checks:
--  A1  Conflicting function definitions (shadowed/duplicate record_case_commission)
--  A2  Cases missing commission rewards at paid status
--  A3  Rewards whose case is NOT enrollment_paid (potential orphan/leak)
--  A4  Agent override rows whose profiles are no longer agents
--  A5  Partners stuck at ₪0 (may be intentional — Hub shows this count)
--  A6  Student-referral rewards pointing at non-student recipients
--  A7  Referrals missing referral_type (legacy rows pre-capture)
--  A8  platform_settings additive invariant (agent on top of pool, not carved)
--  A9  commission_rate_history coverage of recent Hub writes

\echo '─ A1: Conflicting record_case_commission definitions ─'
SELECT n.nspname AS schema, p.proname AS function_name,
       COUNT(*) OVER (PARTITION BY p.proname) AS dup_count,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('record_case_commission', 'get_effective_agent_split')
  AND n.nspname = 'public'
ORDER BY p.proname, args;

\echo '─ A2: Paid cases with NO commission reward row ─'
SELECT c.id, c.status, c.platform_revenue_ils, c.partner_id, c.referred_by
FROM cases c
WHERE c.status = 'enrollment_paid'
  AND NOT EXISTS (SELECT 1 FROM rewards r WHERE r.case_id = c.id)
ORDER BY c.created_at DESC
LIMIT 50;

\echo '─ A3: Rewards whose case is not enrollment_paid (leak) ─'
SELECT r.id, r.case_id, r.reward_type, r.amount, r.status, c.status AS case_status
FROM rewards r
JOIN cases c ON c.id = r.case_id
WHERE r.status IN ('pending', 'approved', 'paid')
  AND c.status <> 'enrollment_paid'
ORDER BY r.created_at DESC
LIMIT 50;

\echo '─ A4: Agent overrides for non-agent profiles ─'
SELECT aco.agent_id, aco.commission_amount, p.email, ur.role
FROM agent_commission_overrides aco
JOIN profiles p ON p.id = aco.agent_id
LEFT JOIN user_roles ur ON ur.user_id = aco.agent_id
WHERE ur.role IS DISTINCT FROM 'agent'
LIMIT 50;

\echo '─ A5: Partners at ₪0 override (intentional or stuck) ─'
SELECT pco.partner_id, pco.commission_amount, prof.email
FROM partner_commission_overrides pco
JOIN profiles prof ON prof.id = pco.partner_id
WHERE pco.commission_amount = 0
ORDER BY pco.updated_at DESC
LIMIT 50;

\echo '─ A6: Student-referral rewards to non-student recipients ─'
SELECT r.id, r.user_id, r.case_id, r.amount, p.email, ur.role
FROM rewards r
JOIN profiles p ON p.id = r.user_id
LEFT JOIN user_roles ur ON ur.user_id = r.user_id
WHERE r.reward_type = 'student_referral'
  AND ur.role IS DISTINCT FROM 'student'
LIMIT 50;

\echo '─ A7: Referrals missing referral_type (legacy) ─'
SELECT COUNT(*) AS legacy_referrals_without_type,
       COUNT(*) FILTER (WHERE referred_case_id IS NOT NULL) AS linked_without_type
FROM referrals
WHERE referral_type IS NULL;

\echo '─ A8: Additive invariant — agent share should NOT reduce partner pool ─'
-- For each paid case with both a partner reward and an agent reward, confirm
-- partner_amount == partner_base_pool (i.e. agent was NOT carved out).
SELECT c.id AS case_id,
       c.platform_revenue_ils,
       pr.amount   AS partner_reward,
       ar.amount   AS agent_reward,
       (pr.amount = (SELECT partner_base_pool(c.partner_id))) AS partner_kept_full_pool
FROM cases c
JOIN rewards pr ON pr.case_id = c.id AND pr.reward_type = 'referral'
LEFT JOIN rewards ar ON ar.case_id = c.id AND ar.reward_type = 'agent_override'
WHERE c.status = 'enrollment_paid'
  AND c.partner_id IS NOT NULL
ORDER BY c.created_at DESC
LIMIT 50;

\echo '─ A9: Recent commission_rate_history (Hub audit trail) ─'
SELECT changed_at, entity_type, rate_kind, old_value, new_value, changed_by, reason
FROM commission_rate_history
ORDER BY changed_at DESC
LIMIT 25;

\echo '─ done ─'
