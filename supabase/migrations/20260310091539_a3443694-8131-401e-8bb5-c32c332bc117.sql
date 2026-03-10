
-- Migration 1: Drop translation columns (legacy)
ALTER TABLE public.case_submissions DROP COLUMN IF EXISTS translation_fee;
ALTER TABLE public.student_cases DROP COLUMN IF EXISTS translation_fee;
ALTER TABLE public.student_cases DROP COLUMN IF EXISTS has_translation_service;
ALTER TABLE public.student_cases DROP COLUMN IF EXISTS translation_added_by_user_id;

-- Migration 2: Drop commission_tiers and tier function
DROP TABLE IF EXISTS public.commission_tiers CASCADE;
DROP FUNCTION IF EXISTS public.get_influencer_tier_commission(uuid);

-- Migration 3: guard columns on cases (already exist but add IF NOT EXISTS for safety)
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS commission_split_done boolean NOT NULL DEFAULT false;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS platform_revenue_ils integer NOT NULL DEFAULT 0;

-- Migration 4: Idempotent record_case_commission
CREATE OR REPLACE FUNCTION public.record_case_commission(
  p_case_id uuid,
  p_total_payment_ils integer DEFAULT 0
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_case              RECORD;
  v_settings          RECORD;
  v_partner_amount    NUMERIC := 0;
  v_team_amount       NUMERIC := 0;
  v_override          RECORD;
BEGIN
  -- Guard: never split twice
  IF EXISTS (SELECT 1 FROM public.cases WHERE id = p_case_id AND commission_split_done = true) THEN
    RETURN;
  END IF;

  SELECT id, partner_id, assigned_to
  INTO v_case
  FROM public.cases
  WHERE id = p_case_id;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT partner_commission_rate, team_member_commission_rate
  INTO v_settings
  FROM public.platform_settings
  LIMIT 1;

  IF v_case.partner_id IS NOT NULL THEN
    SELECT commission_amount INTO v_override
    FROM public.partner_commission_overrides
    WHERE partner_id = v_case.partner_id;
    IF FOUND THEN
      v_partner_amount := COALESCE(v_override.commission_amount, 0);
    ELSE
      v_partner_amount := COALESCE(v_settings.partner_commission_rate, 500);
    END IF;
  END IF;

  IF v_case.assigned_to IS NOT NULL THEN
    SELECT commission_amount INTO v_override
    FROM public.team_member_commission_overrides
    WHERE team_member_id = v_case.assigned_to;
    IF FOUND THEN
      v_team_amount := COALESCE(v_override.commission_amount, 0);
    ELSE
      v_team_amount := COALESCE(v_settings.team_member_commission_rate, 100);
    END IF;
  END IF;

  UPDATE public.cases
  SET
    influencer_commission = v_partner_amount,
    lawyer_commission     = v_team_amount,
    platform_revenue_ils  = GREATEST(0, p_total_payment_ils - v_partner_amount::integer - v_team_amount::integer),
    commission_split_done = true
  WHERE id = p_case_id;

  IF v_partner_amount > 0 AND v_case.partner_id IS NOT NULL THEN
    INSERT INTO public.rewards (user_id, amount, status, admin_notes)
    VALUES (v_case.partner_id, v_partner_amount, 'pending', 'Auto-generated partner commission — case ' || p_case_id::text)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_team_amount > 0 AND v_case.assigned_to IS NOT NULL THEN
    INSERT INTO public.rewards (user_id, amount, status, admin_notes)
    VALUES (v_case.assigned_to, v_team_amount, 'pending', 'Auto-generated team commission — case ' || p_case_id::text)
    ON CONFLICT DO NOTHING;
  END IF;

END;
$$;
