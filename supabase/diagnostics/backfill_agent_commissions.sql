-- ═════════════════════════════════════════════════════════════════
-- Backfill: recompute commissions for paid cases that were recorded
-- before the agent additive-commission fix and/or the attribution fix.
--
-- This script finds enrollment_paid cases where commission_split_done
-- is already true, deletes the frozen reward rows, clears the flag,
-- and re-runs record_case_commission so the rewards are recomputed
-- with the current (additive agent + correct attribution) logic.
--
-- IMPORTANT:
--   • Run this AFTER deploying the 20260814230457 migration (which
--     defines the additive get_effective_agent_split).
--   • Run AFTER recover_lost_attribution.sql (which restores
--     partner_id/referred_by on orphaned cases).
--   • This script is IDEMPOTENT — safe to run multiple times.
--   • Review the DRY-RUN output (Section 1) before running Section 2.
--   • The app.internal_commission_split GUC is required to bypass
--     the restrict_cases_financial_columns guard trigger on cases.
-- ═════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- Section 1: DRY RUN — show affected cases (does NOT modify data)
-- ────────────────────────────────────────────────────────────────
-- Uncomment the SELECT below to preview which cases will be backfilled.
-- Look at commission_split_done, partner_id, referred_by, and
-- whether an agent_override reward already exists.

-- SELECT
--   c.id,
--   c.case_reference,
--   c.status,
--   c.partner_id,
--   c.referred_by,
--   p.agent_id,
--   EXISTS(
--     SELECT 1 FROM rewards r
--     WHERE r.case_id = c.id
--       AND r.reward_type = 'agent_override'
--   ) AS has_agent_override,
--   EXISTS(
--     SELECT 1 FROM rewards r
--     WHERE r.case_id = c.id
--       AND r.reward_type = 'referral'
--       AND r.recipient_role = 'partner'
--   ) AS has_partner_referral,
--   c.commission_split_done
-- FROM cases c
-- LEFT JOIN profiles p ON p.id = COALESCE(c.partner_id, c.referred_by)
-- WHERE c.status = 'enrollment_paid'
--   AND c.commission_split_done = true
--   AND COALESCE(c.archived, false) = false
--   AND c.deleted_at IS NULL
-- ORDER BY c.created_at DESC;

-- ────────────────────────────────────────────────────────────────
-- Section 2: BACKFILL — delete old rewards, re-run commission split
-- ────────────────────────────────────────────────────────────────
-- For each enrollment_paid case with commission_split_done=true:
--   1. Delete existing commission reward rows for that case
--      (team, referral, master_partner, agent_override).
--   2. Clear commission_split_done so the trigger can fire again.
--   3. Re-call record_case_commission to recompute with current logic.
--
-- The ON CONFLICT DO NOTHING inside record_case_commission makes this
-- safe to re-run — duplicates cannot be created.

DO $$
DECLARE
  v_case RECORD;
  v_count integer := 0;
  v_errors text[] := '{}';
BEGIN
  FOR v_case IN
    SELECT id, case_reference
    FROM cases
    WHERE status = 'enrollment_paid'
      AND commission_split_done = true
      AND COALESCE(archived, false) = false
      AND deleted_at IS NULL
    ORDER BY created_at ASC
  LOOP
    BEGIN
      -- Bypass the financial-column guard trigger for cases table
      PERFORM set_config('app.internal_commission_split', 'on', true);

      -- 1. Remove old commission rewards so they are recomputed fresh
      DELETE FROM rewards
      WHERE case_id = v_case.id
        AND reward_type IN ('team', 'referral', 'master_partner', 'agent_override');

      -- 2. Clear the flag so record_case_commission will process it
      UPDATE cases
      SET commission_split_done = false,
          platform_revenue_ils = NULL
      WHERE id = v_case.id;

      -- Reset GUC — record_case_commission updates cases itself but
      -- runs as SECURITY DEFINER (search_path=public), so it is not
      -- affected by the guard trigger. However, the DELETE/UPDATE
      -- above need the GUC on; reset after for safety.
      PERFORM set_config('app.internal_commission_split', 'off', true);

      -- 3. Re-run the commission split with current logic.
      --    service_fee is read from case_submissions by the trigger;
      --    record_case_commission recomputes v_base from case_services
      --    internally, so we pass 0 (it recomputes from case_services).
      PERFORM record_case_commission(v_case.id, 0);

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, format(
        'Case %s (%s): %s',
        v_case.id,
        COALESCE(v_case.case_reference, '?'),
        SQLERRM
      ));
      -- Ensure GUC is reset even on error
      PERFORM set_config('app.internal_commission_split', 'off', true);
    END;
  END LOOP;

  PERFORM set_config('app.internal_commission_split', 'off', true);

  RAISE NOTICE 'Backfill complete. Recomputed % cases.', v_count;
  IF array_length(v_errors, 1) IS NOT NULL THEN
    RAISE NOTICE 'Errors encountered on % cases:', array_length(v_errors, 1);
    FOR i IN 1..array_length(v_errors, 1) LOOP
      RAISE NOTICE '%', v_errors[i];
    END LOOP;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────
-- Section 3: VERIFY — check that agent_override rewards were created
-- ────────────────────────────────────────────────────────────────
-- Uncomment the SELECT below after running Section 2 to verify that
-- agent_override commission rows now exist for cases with an agent.

-- SELECT
--   c.id,
--   c.case_reference,
--   c.partner_id,
--   p.agent_id,
--   r.amount AS agent_override_amount
-- FROM cases c
-- JOIN profiles p ON p.id = COALESCE(c.partner_id, c.referred_by)
-- LEFT JOIN rewards r ON r.case_id = c.id
--   AND r.reward_type = 'agent_override'
--   AND r.user_id = p.agent_id
-- WHERE c.status = 'enrollment_paid'
--   AND c.commission_split_done = true
--   AND COALESCE(c.archived, false) = false
--   AND c.deleted_at IS NULL
--   AND p.agent_id IS NOT NULL
-- ORDER BY c.created_at DESC;
