-- ============================================================================
-- DARB — Recover referral attribution lost during the dashboard-visibility bug.
--
-- CONTEXT
--   Two bugs could create a case with the WRONG (NULL) attribution even though
--   a partner/ambassador/student referral was the real source:
--     • BUG 2 — ApplyForm dropped `ref_code` on a transient verifyReferralCode
--       network error → create-case-from-apply received no ref_code →
--       cases.partner_id stayed NULL.
--     • BUG 3 — the duplicate-phone branch updated education fields but dropped
--       the newly-resolved partner/referrer attribution on the existing case.
--   (BUG 1 — ambassadors — needed NO data recovery: the data was correct, only
--    the READ was broken, and the migration already fixed the read.)
--
--   This script recovers the lost attribution from every available evidence
--   trail, tiered by confidence. It is ADDITIVE ONLY (never overwrites a
--   non-NULL attribution) and IDEMPOTENT (safe to re-run).
--
-- HOW TO USE
--   1. Run SECTION 1 (DRY RUN) first. It prints every candidate with its
--      confidence tier and the evidence. Review the output.
--   2. Run SECTION 2 (APPLY) to backfill the HIGH + MEDIUM confidence rows.
--      It uses the same trusted GUC the commission split uses, so the
--      restrict_cases_financial_columns trigger permits the partner_id /
--      referred_by / source_attribution_method writes.
--   3. SECTION 3 lists the remaining LOW-confidence (phone-reuse only)
--      candidates for manual admin review — these are NOT auto-applied because
--      the same phone can legitimately belong to two different people.
--
--   Run this in the Supabase SQL Editor (postgres / service-role context).
--   Re-running is safe — the additive guards skip anything already attributed.
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 1 — DRY RUN: list every recoverable orphaned case                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- An "orphan" = a non-deleted case with NEITHER partner_id NOR referred_by,
-- that came from a referral-eligible public flow. For each, we attach the best
-- evidence we can find.
DROP TABLE IF EXISTS pg_temp.recovery_candidates;
CREATE TEMP TABLE pg_temp.recovery_candidates AS
SELECT
  c.id,
  c.full_name,
  c.phone_number,
  c.source,
  c.created_at,
  c.updated_at,
  c.partner_id            AS current_partner_id,
  c.referred_by           AS current_referred_by,
  -- Signal A (HIGH): direct partner_links FK on the case itself.
  pl.partner_id           AS evidence_partner_link_id,
  -- Signal B (HIGH): a referrals row pointing at this case (student referrer).
  r.referrer_user_id      AS evidence_referrer_id,
  -- Signal C (MEDIUM): another case with the SAME phone that IS attributed to
  -- a partner/ambassador (the duplicate-phone bug — the attributed submission
  -- is the one that "won" and should have lent its attribution to this one).
  attr.partner_id          AS evidence_phone_partner_id,
  attr.source              AS evidence_phone_source,
  -- Confidence tier for the auto-apply in Section 2.
  CASE
    WHEN pl.partner_id IS NOT NULL THEN 'HIGH'
    WHEN r.referrer_user_id IS NOT NULL THEN 'HIGH'
    WHEN attr.partner_id IS NOT NULL THEN 'MEDIUM'
    ELSE 'NONE'
  END AS confidence
FROM public.cases c
LEFT JOIN public.partner_links pl
  ON pl.id = c.partner_link_id AND pl.active = true
LEFT JOIN public.referrals r
  ON r.referred_case_id = c.id
LEFT JOIN public.cases attr
  ON attr.phone_number = c.phone_number
 AND attr.id <> c.id
 AND attr.deleted_at IS NULL
 AND attr.partner_id IS NOT NULL
WHERE c.deleted_at IS NULL
  AND c.partner_id IS NULL
  AND c.referred_by IS NULL
  AND c.source IN ('contact_form', 'apply_page', 'referral', 'submit_new_student');

-- Summary counts by confidence tier.
SELECT confidence, count(*) AS cases
FROM pg_temp.recovery_candidates
GROUP BY confidence
ORDER BY confidence DESC;

-- The full candidate list (review before applying).
SELECT
  confidence,
  id,
  full_name,
  phone_number,
  source,
  created_at,
  evidence_partner_link_id,
  evidence_referrer_id,
  evidence_phone_partner_id,
  evidence_phone_source
FROM pg_temp.recovery_candidates
WHERE confidence <> 'NONE'
ORDER BY confidence DESC, created_at DESC;

-- (Optional) the orphans with NO recoverable evidence — these cannot be
-- auto-fixed; they need a manual lookup (ask the student which link they used,
-- or check partner_clicks timing by hand).
-- SELECT id, full_name, phone_number, source, created_at
-- FROM pg_temp.recovery_candidates
-- WHERE confidence = 'NONE'
-- ORDER BY created_at DESC;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 2 — APPLY: backfill HIGH + MEDIUM confidence attribution         ║
-- ║  (Re-run Section 1's CREATE TEMP TABLE above first if you opened a fresh  ║
-- ║   session — the temp table does not survive a reconnect.)                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Additive only: each UPDATE sets a column only when it is currently NULL, so
-- an already-attributed case is never re-attributed. The trusted GUC bypasses
-- the restrict_cases_financial_columns BEFORE UPDATE trigger (same mechanism as
-- record_case_commission) for the partner_id / referred_by /
-- source_attribution_method guarded columns. Wrapped in a DO block so the GUC
-- is set/unset within a single transaction regardless of statement dispatch.

-- Count before, so the message below shows how many rows changed.
SELECT count(*) AS will_backfill
FROM pg_temp.recovery_candidates
WHERE confidence IN ('HIGH', 'MEDIUM');

DO $$
DECLARE
  v_partner_rows int;
  v_referrer_rows int;
BEGIN
  -- Trusted internal write: enable the guard bypass for this transaction.
  PERFORM set_config('app.internal_commission_split', 'on', true);

  -- HIGH (partner_link_id) + MEDIUM (phone reuse) → partner_id.
  UPDATE public.cases c
  SET partner_id = COALESCE(
          (SELECT evidence_partner_link_id FROM pg_temp.recovery_candidates x WHERE x.id = c.id),
          (SELECT evidence_phone_partner_id   FROM pg_temp.recovery_candidates x WHERE x.id = c.id)
        ),
      source_attribution_method = COALESCE(c.source_attribution_method,
        CASE
          WHEN EXISTS (SELECT 1 FROM pg_temp.recovery_candidates x WHERE x.id = c.id AND x.evidence_partner_link_id IS NOT NULL)
            THEN 'link'
          WHEN EXISTS (SELECT 1 FROM pg_temp.recovery_candidates x WHERE x.id = c.id AND x.evidence_phone_partner_id IS NOT NULL)
            THEN 'link'
        END)
  WHERE c.partner_id IS NULL
    AND c.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM pg_temp.recovery_candidates x
      WHERE x.id = c.id
        AND x.confidence IN ('HIGH', 'MEDIUM')
        AND COALESCE(x.evidence_partner_link_id, x.evidence_phone_partner_id) IS NOT NULL
    );
  GET DIAGNOSTICS v_partner_rows = ROW_COUNT;

  -- HIGH (referrals row) → referred_by (student-to-student referral).
  UPDATE public.cases c
  SET referred_by = (SELECT evidence_referrer_id FROM pg_temp.recovery_candidates x WHERE x.id = c.id),
      source_attribution_method = COALESCE(c.source_attribution_method, 'link')
  WHERE c.referred_by IS NULL
    AND c.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM pg_temp.recovery_candidates x
      WHERE x.id = c.id
        AND x.confidence = 'HIGH'
        AND x.evidence_referrer_id IS NOT NULL
    );
  GET DIAGNOSTICS v_referrer_rows = ROW_COUNT;

  PERFORM set_config('app.internal_commission_split', 'off', true);

  RAISE NOTICE 'Recovery complete: partner_id backfilled on % rows, referred_by backfilled on % rows.',
    v_partner_rows, v_referrer_rows;
END $$;

-- Confirm the recovery: how many previously-orphaned cases are now attributed.
SELECT
  count(*) FILTER (WHERE partner_id IS NOT NULL)    AS now_has_partner_id,
  count(*) FILTER (WHERE referred_by IS NOT NULL)    AS now_has_referred_by,
  count(*) FILTER (WHERE partner_id IS NULL
                    AND referred_by IS NULL)        AS still_orphaned
FROM public.cases
WHERE id IN (SELECT id FROM pg_temp.recovery_candidates);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 3 — LOW confidence candidates (manual review only)              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- These orphans had NO direct evidence (no partner_link_id, no referrals row,
-- no phone match). They CANNOT be auto-attributed safely. To recover them you
-- would need to confirm with the student which partner's link they used, then
-- backfill manually:
--
--   SET LOCAL app.internal_commission_split = 'on';
--   UPDATE public.cases SET partner_id = '<partner-uuid>',
--       source_attribution_method = 'link'
--     WHERE id = '<case-uuid>' AND partner_id IS NULL;
--   SET LOCAL app.internal_commission_split = 'off';
--
SELECT id, full_name, phone_number, source, created_at
FROM pg_temp.recovery_candidates
WHERE confidence = 'NONE'
ORDER BY created_at DESC;

-- For a specific orphan, you can also look at partner_clicks around the case
-- creation time to find which partner link was clicked (temporal proximity only
-- — not proof; confirm before applying):
--
--   SELECT pc.clicked_at, pl.code, pl.partner_id, p.full_name AS partner_name
--   FROM public.partner_clicks pc
--   JOIN public.partner_links pl ON pl.id = pc.partner_link_id
--   LEFT JOIN public.profiles p ON p.id = pl.partner_id
--   WHERE pc.clicked_at BETWEEN '<case-created_at>'::timestamptz - interval '2 hours'
--                           AND '<case-created_at>'::timestamptz + interval '15 minutes'
--   ORDER BY pc.clicked_at DESC;
