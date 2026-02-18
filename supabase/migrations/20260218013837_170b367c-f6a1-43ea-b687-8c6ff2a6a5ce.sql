
-- Fix infinite recursion in RLS policies for leads and student_cases
-- The circular reference: leads policy references student_cases, student_cases policy references leads

-- Drop the circular policies
DROP POLICY IF EXISTS "Lawyers can view leads for assigned cases" ON public.leads;
DROP POLICY IF EXISTS "Influencers can view cases for their leads" ON public.student_cases;

-- Recreate "Lawyers can view leads for assigned cases" using a SECURITY DEFINER function
-- to avoid the circular dependency with student_cases
CREATE OR REPLACE FUNCTION public.get_lawyer_lead_ids(_lawyer_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT sc.lead_id FROM student_cases sc
  WHERE sc.assigned_lawyer_id = _lawyer_id;
$$;

-- Recreate "Influencers can view cases for their leads" using a SECURITY DEFINER function
-- to avoid the circular dependency with leads
CREATE OR REPLACE FUNCTION public.get_influencer_lead_ids(_influencer_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT l.id FROM leads l
  WHERE l.source_id = _influencer_id;
$$;

-- New policy for leads (lawyers) - uses function to avoid circular reference
CREATE POLICY "Lawyers can view leads for assigned cases"
ON public.leads
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'lawyer'::app_role)
  AND id IN (SELECT public.get_lawyer_lead_ids(auth.uid()))
);

-- New policy for student_cases (influencers) - uses function to avoid circular reference
CREATE POLICY "Influencers can view cases for their leads"
ON public.student_cases
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'influencer'::app_role)
  AND lead_id IN (SELECT public.get_influencer_lead_ids(auth.uid()))
);
