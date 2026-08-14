CREATE OR REPLACE FUNCTION public.restrict_referrals_discount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Trusted backend workflows (including record_case_commission) execute with
  -- the service-role JWT. They must be able to close the referral lifecycle
  -- after the caller has already passed the admin enrollment gate.
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR public.has_role(auth.uid(), 'admin')
     OR public.has_role(auth.uid(), 'team_member') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.discount_applied := false;
    RETURN NEW;
  END IF;

  IF NEW.discount_applied IS DISTINCT FROM OLD.discount_applied THEN
    RAISE EXCEPTION 'Only staff can apply a referral discount';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.restrict_referrals_discount() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restrict_referrals_discount() TO service_role;