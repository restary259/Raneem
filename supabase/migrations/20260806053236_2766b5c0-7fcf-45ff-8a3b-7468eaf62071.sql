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