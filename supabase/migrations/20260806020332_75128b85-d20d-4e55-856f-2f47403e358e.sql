CREATE OR REPLACE FUNCTION public.restrict_cases_financial_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  v_is_admin := public.has_role(auth.uid(), 'admin'::app_role);

  IF NOT v_is_admin THEN
    IF NEW.platform_revenue_ils IS DISTINCT FROM OLD.platform_revenue_ils THEN
      RAISE EXCEPTION 'Only admins can update platform_revenue_ils';
    END IF;
    IF NEW.team_member_commission_ils IS DISTINCT FROM OLD.team_member_commission_ils THEN
      RAISE EXCEPTION 'Only admins can update team_member_commission_ils';
    END IF;
    IF NEW.partner_commission_ils IS DISTINCT FROM OLD.partner_commission_ils THEN
      RAISE EXCEPTION 'Only admins can update partner_commission_ils';
    END IF;
    IF NEW.lawyer_commission IS DISTINCT FROM OLD.lawyer_commission THEN
      RAISE EXCEPTION 'Only admins can update lawyer_commission';
    END IF;
    IF NEW.school_commission IS DISTINCT FROM OLD.school_commission THEN
      RAISE EXCEPTION 'Only admins can update school_commission';
    END IF;
    IF NEW.influencer_commission IS DISTINCT FROM OLD.influencer_commission THEN
      RAISE EXCEPTION 'Only admins can update influencer_commission';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.restrict_cases_financial_columns() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restrict_cases_financial_columns() TO authenticated;

DROP TRIGGER IF EXISTS restrict_cases_financial_columns ON public.cases;
CREATE TRIGGER restrict_cases_financial_columns
BEFORE UPDATE ON public.cases
FOR EACH ROW
EXECUTE FUNCTION public.restrict_cases_financial_columns();