
-- ============================================
-- Stage 2: Financial Engine — Master Services & Snapshots
-- ============================================

-- 1. Master Services catalog (admin-managed pricing)
CREATE TABLE public.master_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name TEXT NOT NULL,
  internal_cost NUMERIC DEFAULT 0,
  sale_price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ILS',
  commission_eligible BOOLEAN NOT NULL DEFAULT false,
  team_commission_type TEXT NOT NULL DEFAULT 'fixed', -- 'fixed' or 'percentage'
  team_commission_value NUMERIC NOT NULL DEFAULT 0,
  influencer_commission_type TEXT NOT NULL DEFAULT 'fixed', -- 'fixed', 'percentage', or 'none'
  influencer_commission_value NUMERIC NOT NULL DEFAULT 0,
  refundable BOOLEAN NOT NULL DEFAULT false,
  requires_document_upload BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.master_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage master services"
  ON public.master_services FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view active services"
  ON public.master_services FOR SELECT
  USING (is_active = true);

-- 2. Case service snapshots — locks pricing at time of sale
CREATE TABLE public.case_service_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.student_cases(id) ON DELETE CASCADE,
  master_service_id UUID NOT NULL REFERENCES public.master_services(id),
  service_name TEXT NOT NULL,
  sale_price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ILS',
  team_commission_type TEXT NOT NULL DEFAULT 'fixed',
  team_commission_value NUMERIC NOT NULL DEFAULT 0,
  influencer_commission_type TEXT NOT NULL DEFAULT 'fixed',
  influencer_commission_value NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, refunded
  refundable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.case_service_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage case service snapshots"
  ON public.case_service_snapshots FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can view assigned case snapshots"
  ON public.case_service_snapshots FOR SELECT
  USING (
    has_role(auth.uid(), 'lawyer'::app_role) AND
    EXISTS (
      SELECT 1 FROM student_cases sc
      WHERE sc.id = case_service_snapshots.case_id
      AND sc.assigned_lawyer_id = auth.uid()
    )
  );

CREATE POLICY "Students can view own case snapshots"
  ON public.case_service_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM student_cases sc
      WHERE sc.id = case_service_snapshots.case_id
      AND sc.student_profile_id = auth.uid()
    )
  );

-- 3. Add refund_status to student_cases for refund tracking
ALTER TABLE public.student_cases
  ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT NULL;

-- 4. Add exchange_rate_snapshot and base_currency to transaction_log
ALTER TABLE public.transaction_log
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ILS',
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC DEFAULT 1.0;

-- 5. Trigger for updated_at on master_services
CREATE TRIGGER update_master_services_updated_at
  BEFORE UPDATE ON public.master_services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
