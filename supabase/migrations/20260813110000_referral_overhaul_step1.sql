-- ════════════════════════════════════════════════════════════════════════
-- Referral overhaul — STEP 1 (schema + config + clean slate)
--
-- 1. Formalize the live-DB-only `cases.referral_discount` column so the
--    generated types and migrations stop diverging. Written only by the
--    create-case-from-apply edge function (service_role) — the existing
--    restrict_cases_financial_columns guard already protects it from clients.
-- 2. Add the configurable referral discount amount to platform_settings
--    (single row, authenticated-readable — same RLS as the other settings).
-- 3. Restore a real `referrals.status` column (was dropped in the 20260305
--    rebuild; ReferralTracker + admin-weekly-digest read it).
-- 4. Clean slate: purge legacy referral rows and the legacy auto_split
--    referral cashback rewards (those linked via rewards.referral_id).
--    Partner / team rewards and payout history are preserved.
-- 5. Drop the dead notify_referral_accepted trigger/function (its table was
--    rebuilt without a `status` column, so it can never fire).
-- ════════════════════════════════════════════════════════════════════════

-- 1) cases.referral_discount — formalize the untracked live column.
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS referral_discount numeric NOT NULL DEFAULT 0;

-- 2) platform_settings.referral_discount_amount — default 500 ILS, configurable
--    by admins. The single settings row gets the default automatically.
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS referral_discount_amount numeric NOT NULL DEFAULT 500;

-- 3) referrals.status — real lifecycle column (was dropped in the 20260305 rebuild).
--    Lifecycle: pending → contacted (team reaches out) → enrolled (friend
--    enrolls) → rewarded (friend's case reaches enrollment_paid).
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'contacted', 'enrolled', 'rewarded'));

-- 4) Clean slate for legacy referral data.
--    Purge rows, keep the tables (policy/trigger wiring stays intact).
DELETE FROM public.referral_milestones;

-- Legacy referral cashback rewards point at referrals via referral_id.
DELETE FROM public.rewards WHERE referral_id IS NOT NULL;

DELETE FROM public.referrals;

-- Old referral-sourced cases carry a cosmetic referral_discount that never
-- reached financials; zero it so the fresh model starts clean.
UPDATE public.cases
   SET referral_discount = 0
 WHERE source = 'referral' OR referred_by IS NOT NULL;

-- Defense-in-depth duplicate guard (replaces the client-only check in
-- ReferralForm) — matches the existing client behaviour, now enforced at
-- the database level. Table was emptied above, so the index is cheap to build.
CREATE UNIQUE INDEX IF NOT EXISTS referrals_referrer_phone_unique
  ON public.referrals (referrer_user_id, referred_phone);

-- 5) Drop the dead referral-accepted notification machinery.
DROP TRIGGER IF EXISTS trg_referral_accepted_notify ON public.referrals;
DROP FUNCTION IF EXISTS public.notify_referral_accepted();
