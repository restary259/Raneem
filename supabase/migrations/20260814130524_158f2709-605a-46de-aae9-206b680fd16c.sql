CREATE OR REPLACE FUNCTION public.restrict_referrals_discount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_jwt_role text := COALESCE(
    current_setting('request.jwt.claim.role', true),
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    auth.role()
  );
BEGIN
  IF v_jwt_role = 'service_role'
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