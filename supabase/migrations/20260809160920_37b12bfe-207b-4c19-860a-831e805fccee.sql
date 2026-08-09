-- 1. Currency columns
ALTER TABLE public.case_services ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'ILS';
ALTER TABLE public.case_payments ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'ILS';

-- 2. Payment lifecycle columns
ALTER TABLE public.case_payments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_reason text,
  ADD COLUMN IF NOT EXISTS idem_key text;

-- Backfill from the legacy paid_status
UPDATE public.case_payments
   SET status = 'confirmed',
       confirmed_at = COALESCE(confirmed_at, paid_date, created_at),
       submitted_by = COALESCE(submitted_by, recorded_by),
       submitted_at = COALESCE(submitted_at, paid_date, created_at)
 WHERE paid_status = 'paid' AND status = 'pending';

ALTER TABLE public.case_payments DROP CONSTRAINT IF EXISTS case_payments_status_chk;
ALTER TABLE public.case_payments
  ADD CONSTRAINT case_payments_status_chk
  CHECK (status IN ('pending','submitted','confirmed','rejected'));

ALTER TABLE public.case_payments DROP CONSTRAINT IF EXISTS case_payments_amount_chk;
ALTER TABLE public.case_payments
  ADD CONSTRAINT case_payments_amount_chk CHECK (amount >= 0);

-- 3. Idempotency: one live payment per case per key
CREATE UNIQUE INDEX IF NOT EXISTS case_payments_idem_uq
  ON public.case_payments (case_id, idem_key)
  WHERE idem_key IS NOT NULL AND status <> 'rejected';

CREATE INDEX IF NOT EXISTS idx_case_payments_case ON public.case_payments (case_id);

-- 4. RLS: team may read + insert pending/submitted only, never confirm, never mutate after submit
DROP POLICY IF EXISTS "Team manage payments on their cases" ON public.case_payments;
DROP POLICY IF EXISTS "Admins can manage case payments" ON public.case_payments;

CREATE POLICY "Team insert payments on their cases"
  ON public.case_payments FOR INSERT TO authenticated
  WITH CHECK (
    status IN ('pending','submitted')
    AND confirmed_at IS NULL
    AND confirmed_by IS NULL
    AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.assigned_to = auth.uid())
  );

-- 5. Audit trigger -> case timeline
CREATE OR REPLACE FUNCTION public.trg_case_payment_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_case_event(
      NEW.case_id, 'payment_' || NEW.status,
      jsonb_build_object('payment_id', NEW.id, 'amount', NEW.amount, 'currency', NEW.currency, 'payment_type', NEW.payment_type),
      true);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_case_event(
      NEW.case_id, 'payment_' || NEW.status,
      jsonb_build_object('payment_id', NEW.id, 'amount', NEW.amount, 'currency', NEW.currency,
                         'from_status', OLD.status, 'reason', NEW.rejected_reason),
      true);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_case_event(
      OLD.case_id, 'payment_deleted',
      jsonb_build_object('payment_id', OLD.id, 'amount', OLD.amount, 'currency', OLD.currency),
      true);
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS case_payments_audit ON public.case_payments;
CREATE TRIGGER case_payments_audit
AFTER INSERT OR UPDATE OR DELETE ON public.case_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_case_payment_audit();

GRANT SELECT, INSERT ON public.case_payments TO authenticated;
GRANT ALL ON public.case_payments TO service_role;
GRANT SELECT ON public.case_services TO authenticated;
GRANT ALL ON public.case_services TO service_role;