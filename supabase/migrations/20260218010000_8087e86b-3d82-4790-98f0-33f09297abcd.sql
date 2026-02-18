-- Phase 5: Add influencer SELECT policy on student_cases
-- This fixes the confirmed bug where influencer cases are always empty
-- because there was no RLS policy allowing influencers to see their cases.

CREATE POLICY "Influencers can view cases for their leads"
  ON public.student_cases
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'influencer'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = student_cases.lead_id
        AND l.source_id = auth.uid()
    )
  );