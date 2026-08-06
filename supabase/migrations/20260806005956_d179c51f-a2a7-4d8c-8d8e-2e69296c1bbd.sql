-- master_services: staff-only visibility
DROP POLICY IF EXISTS "Authenticated can view active services" ON public.master_services;
REVOKE SELECT ON public.master_services FROM anon;

CREATE POLICY "Staff can view services"
ON public.master_services
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'team_member'::app_role)
);

-- appointments: scope team access to their own cases
DROP POLICY IF EXISTS "Team manage appointments" ON public.appointments;
CREATE POLICY "Team manage own appointments"
ON public.appointments
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR team_member_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = appointments.case_id AND c.assigned_to = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR team_member_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = appointments.case_id AND c.assigned_to = auth.uid()
  )
);

-- referrals: scope team access to their own cases
DROP POLICY IF EXISTS "Team manage referrals" ON public.referrals;
CREATE POLICY "Team manage referrals for own cases"
ON public.referrals
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = referrals.referred_case_id AND c.assigned_to = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = referrals.referred_case_id AND c.assigned_to = auth.uid()
  )
);