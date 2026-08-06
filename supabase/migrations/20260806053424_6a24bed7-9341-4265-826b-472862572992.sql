CREATE OR REPLACE FUNCTION public.restrict_cases_financial_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_guarded  text[] := ARRAY[
    'platform_revenue_ils',
    'influencer_commission',
    'lawyer_commission',
    'school_commission',
    'referral_discount',
    'commission_split_done',
    'partner_id',
    'referred_by',
    'source_attribution_method'
  ];
  v_new jsonb;
  v_old jsonb;
  v_col text;
BEGIN
  -- Trusted internal writes (commission split) bypass the guard.
  IF COALESCE(current_setting('app.internal_commission_split', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  v_is_admin := public.has_role(auth.uid(), 'admin'::app_role);
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  v_new := to_jsonb(NEW);
  v_old := to_jsonb(OLD);

  FOREACH v_col IN ARRAY v_guarded LOOP
    IF v_new ? v_col AND v_old ? v_col THEN
      IF (v_new ->> v_col) IS DISTINCT FROM (v_old ->> v_col) THEN
        RAISE EXCEPTION 'Only admins can update %', v_col;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_case_commission(p_case_id uuid, p_total_payment_ils integer DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_case              RECORD;
  v_team_comm         integer := 0;
  v_partner_comm      integer := 0;
  v_admin_remainder   integer := 0;
  v_override_amount   integer;
  v_settings          RECORD;
  v_partner_id        uuid;
  v_is_ambassador     boolean := false;
BEGIN
  IF EXISTS (SELECT 1 FROM cases WHERE id = p_case_id AND commission_split_done = true) THEN
    RETURN;
  END IF;

  SELECT id, assigned_to, source, partner_id, referred_by
  INTO v_case FROM cases WHERE id = p_case_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(team_member_commission_rate, 100) AS team_rate,
         COALESCE(partner_commission_rate, 500)::integer AS partner_rate,
         COALESCE(ambassador_commission_rate, 300) AS ambassador_rate
  INTO v_settings
  FROM platform_settings LIMIT 1;

  IF v_case.assigned_to IS NOT NULL THEN
    SELECT commission_amount INTO v_override_amount
    FROM team_member_commission_overrides
    WHERE team_member_id = v_case.assigned_to;

    v_team_comm := COALESCE(v_override_amount, COALESCE(v_settings.team_rate, 100));

    IF v_team_comm > 0 THEN
      INSERT INTO rewards (user_id, amount, currency, status, case_id, admin_notes)
      VALUES (v_case.assigned_to, v_team_comm, 'ILS', 'pending', p_case_id,
              'Team commission from case ' || p_case_id::text);
    END IF;
  END IF;

  v_partner_id := COALESCE(v_case.partner_id, v_case.referred_by);
  v_override_amount := NULL;

  IF v_partner_id IS NOT NULL THEN
    v_is_ambassador := public.has_role(v_partner_id, 'ambassador'::app_role);

    SELECT commission_amount INTO v_override_amount
    FROM partner_commission_overrides
    WHERE partner_id = v_partner_id;

    v_partner_comm := COALESCE(
      v_override_amount,
      CASE WHEN v_is_ambassador THEN v_settings.ambassador_rate ELSE v_settings.partner_rate END
    );

    IF v_partner_comm > 0 THEN
      INSERT INTO rewards (user_id, amount, currency, status, case_id, admin_notes)
      VALUES (v_partner_id, v_partner_comm, 'ILS', 'pending', p_case_id,
              CASE WHEN v_is_ambassador THEN 'Ambassador commission from case '
                   ELSE 'Partner commission from case ' END || p_case_id::text);
    ELSE
      v_partner_comm := 0;
    END IF;
  END IF;

  v_admin_remainder := GREATEST(0, p_total_payment_ils - v_team_comm - v_partner_comm);

  PERFORM set_config('app.internal_commission_split', 'on', true);

  UPDATE cases SET
    platform_revenue_ils  = v_admin_remainder,
    commission_split_done = true
  WHERE id = p_case_id;

  PERFORM set_config('app.internal_commission_split', 'off', true);
END;
$function$;