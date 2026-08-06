-- B1: students may only insert pending, unconfirmed payments
DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
CREATE POLICY "Users can insert own pending payments"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    auth.uid() = student_id
    AND status = 'pending'
    AND payment_date IS NULL
  )
);

CREATE OR REPLACE FUNCTION public.restrict_payments_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.payment_date := NULL;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restrict_payments_write ON public.payments;
CREATE TRIGGER restrict_payments_write
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.restrict_payments_write();

-- B2: students cannot change the status of their own services
DROP POLICY IF EXISTS "Users can update own services" ON public.services;
CREATE POLICY "Users can update own services"
ON public.services FOR UPDATE TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

CREATE OR REPLACE FUNCTION public.restrict_services_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin')
     OR public.has_role(auth.uid(), 'team_member') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only staff can change the status of a service';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restrict_services_status ON public.services;
CREATE TRIGGER restrict_services_status
BEFORE INSERT OR UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.restrict_services_status();

-- B3: students cannot self-apply a referral discount
DROP POLICY IF EXISTS "Students create referrals" ON public.referrals;
CREATE POLICY "Students create referrals"
ON public.referrals FOR INSERT TO authenticated
WITH CHECK (
  referrer_user_id = auth.uid()
  AND discount_applied = false
);

CREATE OR REPLACE FUNCTION public.restrict_referrals_discount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin')
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

DROP TRIGGER IF EXISTS restrict_referrals_discount ON public.referrals;
CREATE TRIGGER restrict_referrals_discount
BEFORE INSERT OR UPDATE ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.restrict_referrals_discount();

REVOKE EXECUTE ON FUNCTION public.restrict_payments_write() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restrict_services_status() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restrict_referrals_discount() FROM anon, authenticated;