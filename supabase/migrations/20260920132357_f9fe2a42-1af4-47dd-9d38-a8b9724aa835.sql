CREATE OR REPLACE FUNCTION public.recompute_submission_catalog_prices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weeks      integer;
  v_rate       numeric;
  v_tier_price numeric;
  v_base       numeric;
  v_age        integer;
  v_months     integer;
  v_monthly    numeric;
  v_billing    text;
  v_dob        text;
BEGIN
  IF NEW.program_id IS NULL THEN
    NEW.program_weekly_price := NULL;
    NEW.program_price := 0;
  ELSE
    v_weeks := GREATEST(COALESCE(NEW.program_weeks, 0), 0);
    SELECT p.price INTO v_base FROM public.programs p WHERE p.id = NEW.program_id;
    v_tier_price := NULL;
    IF v_weeks > 0 THEN
      SELECT (t->>'price')::numeric INTO v_tier_price
        FROM public.programs p,
             jsonb_array_elements(COALESCE(p.price_tiers, '[]'::jsonb)) AS t
       WHERE p.id = NEW.program_id
         AND (t->>'price') IS NOT NULL
         AND v_weeks >= COALESCE((t->>'from_weeks')::int, 1)
         AND v_weeks <= COALESCE((t->>'to_weeks')::int, 2147483647)
       ORDER BY COALESCE((t->>'from_weeks')::int, 1)
       LIMIT 1;
    END IF;
    v_rate := COALESCE(v_tier_price, CASE WHEN v_base > 0 THEN v_base END);
    NEW.program_weekly_price := v_rate;
    NEW.program_price := CASE WHEN v_rate IS NOT NULL AND v_weeks > 0
                              THEN v_rate * v_weeks ELSE 0 END;
  END IF;

  IF NEW.accommodation_id IS NULL THEN
    NEW.accommodation_weekly_price := NULL;
    NEW.accommodation_price := 0;
  ELSE
    v_weeks := GREATEST(COALESCE(NEW.accommodation_weeks, 0), 0);
    SELECT a.price INTO v_base FROM public.accommodations a WHERE a.id = NEW.accommodation_id;
    v_tier_price := NULL;
    IF v_weeks > 0 THEN
      SELECT (t->>'price')::numeric INTO v_tier_price
        FROM public.accommodations a,
             jsonb_array_elements(COALESCE(a.price_tiers, '[]'::jsonb)) AS t
       WHERE a.id = NEW.accommodation_id
         AND (t->>'price') IS NOT NULL
         AND v_weeks >= COALESCE((t->>'from_weeks')::int, 1)
         AND v_weeks <= COALESCE((t->>'to_weeks')::int, 2147483647)
       ORDER BY COALESCE((t->>'from_weeks')::int, 1)
       LIMIT 1;
    END IF;
    v_rate := COALESCE(v_tier_price, CASE WHEN v_base > 0 THEN v_base END);
    NEW.accommodation_weekly_price := v_rate;
    NEW.accommodation_price := CASE WHEN v_rate IS NOT NULL AND v_weeks > 0
                                    THEN v_rate * v_weeks ELSE 0 END;
  END IF;

  IF NEW.insurance_id IS NULL THEN
    NEW.insurance_price := 0;
  ELSE
    SELECT i.price, i.billing_period INTO v_base, v_billing
      FROM public.insurances i WHERE i.id = NEW.insurance_id;
    v_age := NULL;
    v_dob := NEW.extra_data ->> 'date_of_birth';
    IF v_dob IS NOT NULL AND v_dob ~ '^\d{4}-\d{2}-\d{2}$' THEN
      v_age := date_part('year', age(CURRENT_DATE, v_dob::date))::int;
    END IF;
    v_monthly := NULL;
    IF v_age IS NOT NULL THEN
      SELECT (t->>'price')::numeric INTO v_monthly
        FROM public.insurances i,
             jsonb_array_elements(COALESCE(i.age_price_tiers, '[]'::jsonb)) AS t
       WHERE i.id = NEW.insurance_id
         AND (t->>'price') IS NOT NULL
         AND v_age >= COALESCE((t->>'from_age')::int, 0)
         AND v_age <= COALESCE((t->>'to_age')::int, 2147483647)
       ORDER BY COALESCE((t->>'from_age')::int, 0)
       LIMIT 1;
      IF v_monthly IS NOT NULL AND v_monthly <= 0 THEN
        v_monthly := NULL;
      END IF;
    END IF;
    v_monthly := COALESCE(v_monthly, CASE WHEN v_base > 0 THEN v_base END);
    v_months := CEIL(COALESCE(NEW.program_weeks, 0) / 4.33)::int;
    NEW.insurance_price := CASE
      WHEN v_monthly IS NULL THEN 0
      WHEN COALESCE(v_billing, 'monthly') = 'monthly' AND v_months > 0
        THEN v_monthly * v_months
      ELSE v_monthly
    END;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_submission_catalog_prices() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_submission_catalog_prices() TO service_role;

DROP TRIGGER IF EXISTS trg_recompute_submission_prices ON public.case_submissions;
CREATE TRIGGER trg_recompute_submission_prices
  BEFORE INSERT OR UPDATE ON public.case_submissions
  FOR EACH ROW EXECUTE FUNCTION public.recompute_submission_catalog_prices();