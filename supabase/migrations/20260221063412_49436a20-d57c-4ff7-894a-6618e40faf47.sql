-- Create a view for lawyer access that excludes sensitive columns (email)
CREATE OR REPLACE VIEW public.leads_lawyer_safe AS
SELECT
  id, full_name, phone, city, age, education_level, german_level,
  budget_range, preferred_city, accommodation, source_type, source_id,
  eligibility_score, eligibility_reason, passport_type, english_units,
  math_units, status, created_at, ref_code, study_destination,
  preferred_major, deleted_at, is_stale, last_contacted,
  companion_lead_id, student_portal_created, notes, service_requested,
  arab48_flag, visa_history, fraud_flags
FROM public.leads;

-- Grant access to authenticated users (RLS on underlying table still applies)
GRANT SELECT ON public.leads_lawyer_safe TO authenticated;

-- Revoke the broad lawyer SELECT on leads and replace with view-based access
DROP POLICY IF EXISTS "Lawyers can view all active leads" ON public.leads;

-- Re-create lawyer policy scoped to assigned cases only (via get_lawyer_lead_ids)
CREATE POLICY "Lawyers can view assigned leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'lawyer'::app_role)
  AND id IN (SELECT get_lawyer_lead_ids(auth.uid()))
  AND deleted_at IS NULL
);