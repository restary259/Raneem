
-- Add soft delete column to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add soft delete column to student_cases
ALTER TABLE public.student_cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Update Influencers policy on leads to exclude soft-deleted
DROP POLICY IF EXISTS "Influencers can view their leads" ON public.leads;
CREATE POLICY "Influencers can view their leads" ON public.leads
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'influencer'::app_role)
    AND source_id = auth.uid()
    AND deleted_at IS NULL
  );

-- Update Lawyers policy on leads to exclude soft-deleted
DROP POLICY IF EXISTS "Lawyers can view leads for assigned cases" ON public.leads;
CREATE POLICY "Lawyers can view leads for assigned cases" ON public.leads
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'lawyer'::app_role)
    AND id IN (SELECT get_lawyer_lead_ids(auth.uid()))
    AND deleted_at IS NULL
  );

-- Update Influencers policy on student_cases to exclude soft-deleted
DROP POLICY IF EXISTS "Influencers can view cases for their leads" ON public.student_cases;
CREATE POLICY "Influencers can view cases for their leads" ON public.student_cases
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'influencer'::app_role)
    AND lead_id IN (SELECT get_influencer_lead_ids(auth.uid()))
    AND deleted_at IS NULL
  );

-- Update Lawyers policy on student_cases to exclude soft-deleted
DROP POLICY IF EXISTS "Lawyers can view assigned cases" ON public.student_cases;
CREATE POLICY "Lawyers can view assigned cases" ON public.student_cases
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'lawyer'::app_role)
    AND assigned_lawyer_id = auth.uid()
    AND deleted_at IS NULL
  );

-- Update Students policy on student_cases to exclude soft-deleted
DROP POLICY IF EXISTS "Students can view own case" ON public.student_cases;
CREATE POLICY "Students can view own case" ON public.student_cases
  FOR SELECT TO authenticated USING (
    student_profile_id = auth.uid()
    AND deleted_at IS NULL
  );
