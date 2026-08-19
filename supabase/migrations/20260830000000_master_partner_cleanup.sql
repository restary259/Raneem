-- ════════════════════════════════════════════════════════════════════════
-- Master-partner cleanup — executes the OPTIONAL CLEANUP section verbatim
-- ════════════════════════════════════════════════════════════════════════
-- The commission simplification's OPTIONAL CLEANUP section (inside
-- 20260818000000) was skipped on the live DB, so all master-partner state is
-- still physically present. This standalone migration runs those DROPs
-- verbatim, idempotently (IF EXISTS on every statement). Verify before/after:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name IN ('profiles','platform_settings','partner_recruit_applications')
--     AND column_name IN ('is_master_partner','master_partner_id',
--                         'master_partner_override_rate','referral_discount_amount');
--   SELECT to_regclass('public.partner_rate_offers');
-- MANUAL DEPLOY (dashboard SQL editor / supabase db push).
-- ════════════════════════════════════════════════════════════════════════

-- Master-partner graph trigger + function (invariant moot with the concept).
DROP TRIGGER IF EXISTS public.trg_enforce_master_partner_graph ON public.profiles;
DROP FUNCTION IF EXISTS public.enforce_master_partner_graph();

-- Remaining master RPCs reading the profiles master columns.
DROP FUNCTION IF EXISTS public.master_announce_to_network(text);
DROP FUNCTION IF EXISTS public.ensure_master_recruit_link();

-- Master partner profile columns (safe now: no trigger/granted RPC refs them).
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS is_master_partner,
  DROP COLUMN IF EXISTS master_partner_id;

-- Obsolete global rate columns (no engine branch reads them).
ALTER TABLE public.platform_settings
  DROP COLUMN IF EXISTS master_partner_override_rate,
  DROP COLUMN IF EXISTS referral_discount_amount;

-- Obsolete generic referral-discount RPC (replaced by
-- get_student_referral_discount_by_type).
DROP FUNCTION IF EXISTS public.get_referral_discount_amount();

-- partner_recruit_applications.master_partner_id (+ index). Table retained.
DROP INDEX IF EXISTS public.idx_recruit_apps_master;
ALTER TABLE public.partner_recruit_applications
  DROP COLUMN IF EXISTS master_partner_id;

-- Rate-offer subsystem (master-partner-only).
DROP FUNCTION IF EXISTS public.get_my_rate_offers();
DROP FUNCTION IF EXISTS public.partner_respond_rate_offer(uuid, boolean);
DROP FUNCTION IF EXISTS public.master_send_rate_offer(uuid, integer, text);
DROP TABLE IF EXISTS public.partner_rate_offers;

-- get_effective_partner_split is no longer called by the engine (the flat
-- model resolves the pool directly via partner_base_pool). Retaining it would
-- error anyway — its body read the columns dropped above.
DROP FUNCTION IF EXISTS public.get_effective_partner_split(uuid);

-- Lingering generated-types remnant (an old live RPC surviving because the
-- optional cleanup never ran).
DROP FUNCTION IF EXISTS public.get_master_partner_override_rate();
