-- 1. invoices
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  invoice_number text,
  status text NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'ILS',
  notes text,
  issued_at timestamptz,
  due_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_status_chk CHECK (status IN ('draft','sent','paid','void')),
  CONSTRAINT invoices_currency_chk CHECK (currency = 'ILS')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team members manage invoices for their cases" ON public.invoices
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = invoices.case_id AND c.assigned_to = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = invoices.case_id AND c.assigned_to = auth.uid()));

CREATE POLICY "Students read own issued invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    status IN ('sent','paid')
    AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = invoices.case_id AND c.student_user_id = auth.uid())
  );

-- 2. invoice_items
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  amount numeric NOT NULL DEFAULT 0,
  quantity numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_items_category_chk CHECK (category IN
    ('application_fee','housing','insurance','visa','semester_fee','language_school','service_fee','other')),
  CONSTRAINT invoice_items_amount_chk CHECK (amount >= 0),
  CONSTRAINT invoice_items_qty_chk CHECK (quantity > 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all invoice items" ON public.invoice_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team members manage items for their case invoices" ON public.invoice_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i JOIN public.cases c ON c.id = i.case_id
    WHERE i.id = invoice_items.invoice_id AND c.assigned_to = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices i JOIN public.cases c ON c.id = i.case_id
    WHERE i.id = invoice_items.invoice_id AND c.assigned_to = auth.uid()));

CREATE POLICY "Students read items of own issued invoices" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i JOIN public.cases c ON c.id = i.case_id
    WHERE i.id = invoice_items.invoice_id
      AND i.status IN ('sent','paid')
      AND c.student_user_id = auth.uid()));

-- 3. payments -> invoice link (additive, nullable)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

-- 4. indexes
CREATE INDEX idx_invoices_case_id ON public.invoices(case_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX idx_payments_invoice_id ON public.payments(invoice_id);

-- 5. derived totals view (security_invoker so RLS of caller applies)
CREATE VIEW public.invoice_totals WITH (security_invoker = true) AS
SELECT i.id AS invoice_id,
       i.case_id,
       i.status,
       i.currency,
       COALESCE((SELECT SUM(it.amount * it.quantity) FROM public.invoice_items it WHERE it.invoice_id = i.id), 0)::numeric AS total,
       COALESCE((SELECT COUNT(*) FROM public.invoice_items it WHERE it.invoice_id = i.id), 0)::bigint AS item_count,
       COALESCE((SELECT SUM(p.amount) FROM public.payments p WHERE p.invoice_id = i.id AND p.status = 'paid'), 0)::numeric AS paid_amount
FROM public.invoices i;

GRANT SELECT ON public.invoice_totals TO authenticated;
GRANT ALL ON public.invoice_totals TO service_role;

-- 6. invoice number + updated_at
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_invoice_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-'
      || to_char(COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Jerusalem', 'YYYY')
      || '-' || LPAD(nextval('public.invoice_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.assign_invoice_number() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_assign_invoice_number BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.assign_invoice_number();

CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. timeline integration
CREATE OR REPLACE FUNCTION public.case_events_from_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total numeric;
BEGIN
  IF NEW.status = 'sent' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'sent') THEN
    SELECT COALESCE(SUM(amount * quantity), 0) INTO v_total FROM public.invoice_items WHERE invoice_id = NEW.id;
    PERFORM public.log_case_event(NEW.case_id, 'invoice_sent',
      jsonb_build_object('invoice_number', NEW.invoice_number, 'amount', v_total, 'currency', NEW.currency), false);
  ELSIF NEW.status = 'paid' AND (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'paid') THEN
    SELECT COALESCE(SUM(amount * quantity), 0) INTO v_total FROM public.invoice_items WHERE invoice_id = NEW.id;
    PERFORM public.log_case_event(NEW.case_id, 'payment_received',
      jsonb_build_object('invoice_number', NEW.invoice_number, 'amount', v_total, 'currency', NEW.currency), false);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.case_events_from_invoice() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_case_events_invoice_ins AFTER INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.case_events_from_invoice();
CREATE TRIGGER trg_case_events_invoice_upd AFTER UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.case_events_from_invoice();