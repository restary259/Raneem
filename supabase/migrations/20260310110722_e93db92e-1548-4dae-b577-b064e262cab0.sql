
-- Migration 1: Drop translation_fee columns (safe, IF EXISTS)
ALTER TABLE public.case_submissions DROP COLUMN IF EXISTS translation_fee;

-- Migration 2: Drop commission_tiers table (safe, IF EXISTS)
DROP TABLE IF EXISTS public.commission_tiers CASCADE;
DROP FUNCTION IF EXISTS public.get_influencer_tier_commission(uuid);

-- Migration 4: Replace record_case_commission with correct multi-partner version
CREATE OR REPLACE FUNCTION public.record_case_commission(
  p_case_id uuid,
  p_total_payment_ils integer DEFAULT 0
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_case              RECORD;
  v_t_comm            integer := 0;
  v_total_partner     integer := 0;
  v_admin_remainder   integer := 0;
  v_override          RECORD;
  v_global_team_rate  integer := 100;
BEGIN
  IF EXISTS (
    SELECT 1 FROM cases WHERE id = p_case_id AND commission_split_done = true
  ) THEN
    RETURN;
  END IF;

  SELECT id, assigned_to, source
  INTO v_case
  FROM cases WHERE id = p_case_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(team_member_commission_rate, 100)
  INTO v_global_team_rate
  FROM platform_settings LIMIT 1;

  IF v_case.assigned_to IS NOT NULL THEN
    SELECT COALESCE(commission_amount, v_global_team_rate)
    INTO v_t_comm
    FROM team_member_commission_overrides
    WHERE team_member_id = v_case.assigned_to;
    IF NOT FOUND THEN v_t_comm := v_global_team_rate; END IF;

    IF v_t_comm > 0 THEN
      INSERT INTO rewards (user_id, amount, status, admin_notes)
      VALUES (
        v_case.assigned_to, v_t_comm, 'pending',
        'Team commission from case ' || p_case_id::text
      ) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  FOR v_override IN
    SELECT partner_id, commission_amount, show_all_cases
    FROM partner_commission_overrides
  LOOP
    IF (
      v_override.show_all_cases = true
      OR (v_override.show_all_cases = false AND v_case.source IN (
            'apply_page', 'contact_form', 'submit_new_student', 'manual'
          ))
      OR (v_override.show_all_cases IS NULL AND v_case.source = 'referral')
    ) THEN
      IF v_override.commission_amount > 0 THEN
        INSERT INTO rewards (user_id, amount, status, admin_notes)
        VALUES (
          v_override.partner_id,
          v_override.commission_amount,
          'pending',
          'Partner commission from case ' || p_case_id::text
        ) ON CONFLICT DO NOTHING;

        v_total_partner := v_total_partner + v_override.commission_amount;
      END IF;
    END IF;
  END LOOP;

  v_admin_remainder := GREATEST(0, p_total_payment_ils - v_t_comm - v_total_partner);

  UPDATE cases SET
    platform_revenue_ils  = v_admin_remainder,
    commission_split_done = true
  WHERE id = p_case_id;
END;
$$;

-- Migration 6: Update auto_split_payment trigger function
CREATE OR REPLACE FUNCTION public.auto_split_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status = 'enrollment_paid' AND OLD.status IS DISTINCT FROM 'enrollment_paid' THEN
    IF NOT NEW.commission_split_done THEN
      PERFORM record_case_commission(NEW.id, 0);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_split_payment ON public.cases;
CREATE TRIGGER trg_auto_split_payment
  AFTER UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.auto_split_payment();
