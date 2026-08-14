-- ============================================================================
-- DARB — Partner/Ambassador/Agent referral workflow audit & verification.
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).
-- Every block is READ-ONLY (SELECT) — nothing is mutated. Use it to:
--   1. Confirm the new migration (20260814210000) is applied.
--   2. Find cases that are invisible to a partner/ambassador dashboard.
--   3. Find cases whose attribution was dropped by the duplicate-phone bug.
--   4. Verify agent visibility of recruited-partner students.
--
-- All queries are safe to re-run.
-- ============================================================================


-- ── 0. Is the fix migration applied? ───────────────────────────────────────
-- Expect ≥1 row. If 0 rows, the migration 20260814210000_partner_ambassador_case_visibility.sql
-- has NOT been applied yet — apply it via `supabase db push` or the SQL editor.
SELECT
  'migration_applied' AS check_name,
  EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version = '20260814210000'
  ) AS applied,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'backfill_case_attribution'
  ) AS backfill_rpc_exists;


-- ── 1. Ambassador dashboard visibility (the #1 reported symptom) ───────────
-- Ambassadors use /partner/* (same routes + pages as partners) and read cases
-- through get_partner_pool_cases. Before the fix, that RPC gated on
-- has_role('social_media_partner') ONLY, so EVERY ambassador got 0 cases.
-- This query counts cases correctly attributed to ambassadors (partner_id =
-- ambassador). After the fix, these are exactly the rows an ambassador should
-- now see in their dashboard + KPI.
SELECT
  r.user_id   AS ambassador_id,
  p.full_name AS ambassador_name,
  count(c.id) AS attributed_cases
FROM user_roles r
JOIN profiles p ON p.id = r.user_id
LEFT JOIN cases c ON c.partner_id = r.user_id AND c.deleted_at IS NULL
WHERE r.role = 'ambassador'
GROUP BY r.user_id, p.full_name
ORDER BY attributed_cases DESC;


-- ── 2. Sanity: does get_partner_pool_cases now return rows for an ambassador? ─
-- Replace <ambassador-uuid> with a real ambassador id from query 1, then run.
-- Expected: the same count as query 1 for that ambassador. Before the fix this
-- returned 0 for every ambassador.
-- SELECT count(*) FROM get_partner_pool_cases() WHERE partner_id = '<ambassador-uuid>';


-- ── 3. Cases lost to the duplicate-phone attribution bug ────────────────────
-- A case created via contact_form/apply_page with NO partner_id, where the SAME
-- phone number later appeared on a submission that SHOULD have carried a partner
-- attribution. The backfill RPC now recovers these going forward; this query
-- surfaces pre-existing orphaned cases that may need a one-time admin review.
-- (It cannot prove the "should have" definitively — it flags candidates by
-- phone reuse across attributed and unattributed apply/contact submissions.)
SELECT
  unattributed.id,
  unattributed.full_name,
  unattributed.phone_number,
  unattributed.source,
  unattributed.created_at,
  attributed.partner_id AS partner_it_should_have_had,
  attributed.source    AS later_source
FROM cases unattributed
JOIN cases attributed
  ON attributed.phone_number = unattributed.phone_number
  AND attributed.id <> unattributed.id
  AND attributed.partner_id IS NOT NULL
WHERE unattributed.partner_id IS NULL
  AND unattributed.referred_by IS NULL
  AND unattributed.deleted_at IS NULL
  AND unattributed.source IN ('contact_form', 'apply_page')
ORDER BY unattributed.created_at DESC
LIMIT 200;


-- ── 4. Agent → Partner/Ambassador → Student visibility ─────────────────────
-- For each agent, the partners/ambassadors they recruited and the students
-- generated through those recruits. The agent dashboard (AgentStudentsPage +
-- get_my_agent_network) derives visibility from cases.partner_id IN (recruits
-- where profiles.agent_id = agent). This confirms the hierarchy is intact.
SELECT
  a.id         AS agent_id,
  a.full_name  AS agent_name,
  recruit.id   AS recruit_id,
  recruit.full_name AS recruit_name,
  ur.role      AS recruit_role,
  count(c.id)  AS students_via_recruit
FROM profiles a
JOIN profiles recruit ON recruit.agent_id = a.id AND recruit.deleted_at IS NULL
JOIN user_roles ur ON ur.user_id = recruit.id AND ur.role IN ('social_media_partner','ambassador')
LEFT JOIN cases c ON c.partner_id = recruit.id AND c.deleted_at IS NULL
WHERE EXISTS (SELECT 1 FROM user_roles ar WHERE ar.user_id = a.id AND ar.role = 'agent')
GROUP BY a.id, a.full_name, recruit.id, recruit.full_name, ur.role
ORDER BY students_via_recruit DESC;


-- ── 5. Agent self-referral cases (partner_id = agent) ──────────────────────
-- Cases the agent submitted via their own /agent/apply form or /apply?ref= link.
-- These earn the agent_self_referral_rate. They should appear in the agent's
-- "Your own referrals" tab.
SELECT
  a.full_name AS agent_name,
  count(c.id) AS self_referral_cases
FROM profiles a
JOIN cases c ON c.partner_id = a.id AND c.deleted_at IS NULL
WHERE EXISTS (SELECT 1 FROM user_roles ar WHERE ar.user_id = a.id AND ar.role = 'agent')
GROUP BY a.full_name
ORDER BY self_referral_cases DESC;


-- ── 6. RLS verification (run as a partner/ambassador) ──────────────────────
-- In the Supabase Dashboard, use "Run as role" / the SQL editor's
-- "Authenticated" impersonation with a specific user id, then run:
--   SELECT count(*) FROM get_partner_pool_cases();
-- For a partner/ambassador with attributed cases it should return their cases
-- (query 1 / 2), NOT 0. Before the fix, ambassadors always got 0 here.
