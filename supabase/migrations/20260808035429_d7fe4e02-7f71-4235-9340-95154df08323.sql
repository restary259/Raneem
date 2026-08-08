-- ── 1. Service catalog ────────────────────────────────────────────────
CREATE TABLE public.service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  default_price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.service_catalog TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.service_catalog TO authenticated;
GRANT ALL ON public.service_catalog TO service_role;

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read the catalog"
  ON public.service_catalog FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage the catalog"
  ON public.service_catalog FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER service_catalog_updated_at
  BEFORE UPDATE ON public.service_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 2. Services attached to a case ────────────────────────────────────
CREATE TABLE public.case_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.service_catalog(id) ON DELETE SET NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  unit_price numeric NOT NULL DEFAULT 0,
  quantity numeric NOT NULL DEFAULT 1,
  discount numeric NOT NULL DEFAULT 0,
  notes text,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_services_case ON public.case_services(case_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_services TO authenticated;
GRANT ALL ON public.case_services TO service_role;

ALTER TABLE public.case_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all case services"
  ON public.case_services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team members manage services for their cases"
  ON public.case_services FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_services.case_id AND c.assigned_to = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_services.case_id AND c.assigned_to = auth.uid()));

CREATE POLICY "Students read services on their own case"
  ON public.case_services FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_services.case_id AND c.student_user_id = auth.uid()));

CREATE TRIGGER case_services_updated_at
  BEFORE UPDATE ON public.case_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 3. Invoice line extensions ────────────────────────────────────────
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS case_service_id uuid REFERENCES public.case_services(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_invoice_items_case_service ON public.invoice_items(case_service_id);

-- ── 4. Payment extensions (ad-hoc payment history) ────────────────────
ALTER TABLE public.case_payments
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS recorded_by uuid;

-- ── 5. Keep the draft invoice in sync with the case services ──────────
CREATE OR REPLACE FUNCTION public.sync_case_service_invoice_line()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_id uuid;
  v_invoice_id uuid;
BEGIN
  v_case_id := COALESCE(NEW.case_id, OLD.case_id);

  IF TG_OP = 'DELETE' THEN
    -- the ON DELETE CASCADE on invoice_items already removes the line
    RETURN OLD;
  END IF;

  -- reuse the open draft invoice for this case, or create one
  SELECT id INTO v_invoice_id
  FROM public.invoices
  WHERE case_id = v_case_id AND status = 'draft'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invoice_id IS NULL THEN
    INSERT INTO public.invoices (case_id, status, created_by)
    VALUES (v_case_id, 'draft', auth.uid())
    RETURNING id INTO v_invoice_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.invoice_items (invoice_id, description, category, amount, quantity, discount, case_service_id)
    VALUES (v_invoice_id, NEW.description, NEW.category, NEW.unit_price, NEW.quantity, NEW.discount, NEW.id);
  ELSE
    UPDATE public.invoice_items
    SET description = NEW.description,
        category    = NEW.category,
        amount      = NEW.unit_price,
        quantity    = NEW.quantity,
        discount    = NEW.discount
    WHERE case_service_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_case_service_invoice_line() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER case_services_sync_invoice
  AFTER INSERT OR UPDATE OR DELETE ON public.case_services
  FOR EACH ROW EXECUTE FUNCTION public.sync_case_service_invoice_line();

-- ── 6. Timeline events for service changes ────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_case_events_services()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_case_event(
      NEW.case_id, 'service_added',
      jsonb_build_object('description', NEW.description, 'amount', NEW.unit_price * NEW.quantity - NEW.discount)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_case_event(
      OLD.case_id, 'service_removed',
      jsonb_build_object('description', OLD.description)
    );
    RETURN OLD;
  ELSE
    PERFORM public.log_case_event(
      NEW.case_id, 'service_updated',
      jsonb_build_object('description', NEW.description, 'amount', NEW.unit_price * NEW.quantity - NEW.discount)
    );
    RETURN NEW;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_case_events_services() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER case_services_timeline
  AFTER INSERT OR UPDATE OR DELETE ON public.case_services
  FOR EACH ROW EXECUTE FUNCTION public.trg_case_events_services();

-- ── 7. Starter catalog ────────────────────────────────────────────────
INSERT INTO public.service_catalog (name_ar, name_en, category, default_price, sort_order) VALUES
  ('رسوم الخدمة الأساسية', 'Core service fee',       'service_fee',  4000, 1),
  ('مدرسة اللغة',          'Language school',        'language',     3000, 2),
  ('التأمين الصحي',        'Health insurance',       'insurance',    1200, 3),
  ('الحساب المغلق',        'Blocked account',        'finance',       500, 4),
  ('معادلة الشهادة',       'Certificate recognition','documents',     600, 5),
  ('الترجمة المحلفة',      'Sworn translation',      'documents',     400, 6),
  ('رسوم التأشيرة',        'Visa fees',              'visa',          300, 7),
  ('السكن',                'Accommodation support',  'other',         800, 8);