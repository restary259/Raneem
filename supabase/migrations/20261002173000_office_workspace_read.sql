-- Office workspace read access.
--
-- The office workspace (admin + team) shows the office's own opening hours,
-- booking settings, and routing rules. Those tables were admin-only for SELECT,
-- so a team member looking at their own office saw an empty workspace. Grant
-- read access scoped to offices the member actually belongs to; writes remain
-- admin-only via the existing "Admins manage …" policies.

CREATE OR REPLACE FUNCTION public.is_office_member(p_office_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.office_members om
    WHERE om.office_id = p_office_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
  );
$fn$;

REVOKE ALL ON FUNCTION public.is_office_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_office_member(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Members read own office hours" ON public.office_hours;
CREATE POLICY "Members read own office hours"
ON public.office_hours FOR SELECT TO authenticated
USING (public.is_office_member(office_id));

DROP POLICY IF EXISTS "Members read own office booking settings" ON public.office_booking_settings;
CREATE POLICY "Members read own office booking settings"
ON public.office_booking_settings FOR SELECT TO authenticated
USING (public.is_office_member(office_id));

DROP POLICY IF EXISTS "Members read own office routing rules" ON public.office_routing_rules;
CREATE POLICY "Members read own office routing rules"
ON public.office_routing_rules FOR SELECT TO authenticated
USING (public.is_office_member(office_id));

DROP POLICY IF EXISTS "Members read own office breaks" ON public.office_breaks;
CREATE POLICY "Members read own office breaks"
ON public.office_breaks FOR SELECT TO authenticated
USING (public.is_office_member(office_id));

DROP POLICY IF EXISTS "Members read own office blackouts" ON public.office_blackouts;
CREATE POLICY "Members read own office blackouts"
ON public.office_blackouts FOR SELECT TO authenticated
USING (public.is_office_member(office_id));
