
-- ============================================================
-- LEADS TABLE
-- ============================================================
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  city text,
  age integer,
  education_level text,
  german_level text,
  budget_range text,
  preferred_city text,
  accommodation boolean NOT NULL DEFAULT false,
  source_type text NOT NULL DEFAULT 'organic',
  source_id uuid,
  eligibility_score integer,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all leads"
  ON public.leads FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Influencers can view their leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'influencer') AND source_id = auth.uid());

-- ============================================================
-- STUDENT CASES TABLE
-- ============================================================
CREATE TABLE public.student_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_lawyer_id uuid,
  student_profile_id uuid,
  selected_city text,
  selected_school text,
  accommodation_status text,
  service_fee numeric NOT NULL DEFAULT 0,
  influencer_commission numeric NOT NULL DEFAULT 0,
  lawyer_commission numeric NOT NULL DEFAULT 0,
  referral_discount numeric NOT NULL DEFAULT 0,
  school_commission numeric NOT NULL DEFAULT 0,
  translation_fee numeric NOT NULL DEFAULT 0,
  case_status text NOT NULL DEFAULT 'assigned',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all cases"
  ON public.student_cases FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Lawyers can view assigned cases"
  ON public.student_cases FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'lawyer') AND assigned_lawyer_id = auth.uid());

CREATE POLICY "Lawyers can update assigned cases"
  ON public.student_cases FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'lawyer') AND assigned_lawyer_id = auth.uid());

CREATE POLICY "Students can view own case"
  ON public.student_cases FOR SELECT
  TO authenticated
  USING (student_profile_id = auth.uid());

CREATE TRIGGER update_student_cases_updated_at
  BEFORE UPDATE ON public.student_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- CASE PAYMENTS TABLE
-- ============================================================
CREATE TABLE public.case_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.student_cases(id) ON DELETE CASCADE,
  payment_type text NOT NULL DEFAULT 'service_fee',
  amount numeric NOT NULL DEFAULT 0,
  paid_status text NOT NULL DEFAULT 'pending',
  paid_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.case_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all case payments"
  ON public.case_payments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students can view own case payments"
  ON public.case_payments FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.student_cases sc
    WHERE sc.id = case_payments.case_id AND sc.student_profile_id = auth.uid()
  ));

-- ============================================================
-- COMMISSIONS TABLE
-- ============================================================
CREATE TABLE public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.student_cases(id) ON DELETE CASCADE,
  influencer_amount numeric NOT NULL DEFAULT 0,
  lawyer_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all commissions"
  ON public.commissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_commissions_updated_at
  BEFORE UPDATE ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
