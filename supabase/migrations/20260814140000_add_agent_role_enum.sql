-- ════════════════════════════════════════════════════════════════════════
-- Add the 'agent' value to the app_role enum.
-- ════════════════════════════════════════════════════════════════════════
-- An Agent is a first-class role that recruits and manages Partners and
-- Ambassadors. Agents earn a flat admin-set commission carved out of the same
-- ₪1000 partner pool (never extra money, never from the team member's
-- commission or Darb's margin) — the exact same principle as the master-partner
-- override (COMMISSION_RULES.md §8–9).
--
-- IMPORTANT: ALTER TYPE ... ADD VALUE cannot run inside a transaction block
-- that also uses the new value, and Supabase's migration runner wraps each
-- file in a transaction. To be safe this file ONLY adds the enum value; no
-- other statement references 'agent'. Subsequent migrations create the
-- agent_relationships table, the commission carve-out and the RLS.
-- ════════════════════════════════════════════════════════════════════════

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agent';
