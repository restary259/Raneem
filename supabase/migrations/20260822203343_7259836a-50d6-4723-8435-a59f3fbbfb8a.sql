DROP POLICY IF EXISTS "Staff and partners can read settings" ON public.platform_settings;
CREATE POLICY "Staff and partners can read settings"
  ON public.platform_settings FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'team_member'::app_role)
    OR public.has_role(auth.uid(), 'social_media_partner'::app_role)
    OR public.has_role(auth.uid(), 'ambassador'::app_role)
    OR public.has_role(auth.uid(), 'agent'::app_role)
  );