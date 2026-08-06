CREATE OR REPLACE FUNCTION public.enforce_payout_paid_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'paid' THEN
    NEW.paid_at := NULL;
    NEW.paid_by := NULL;
  ELSIF NEW.paid_at IS NULL THEN
    NEW.paid_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_payout_paid_at ON public.payout_requests;
CREATE TRIGGER trg_enforce_payout_paid_at
BEFORE INSERT OR UPDATE ON public.payout_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_payout_paid_at();

REVOKE EXECUTE ON FUNCTION public.enforce_payout_paid_at() FROM PUBLIC, anon, authenticated;