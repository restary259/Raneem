DROP POLICY IF EXISTS "Admins read whatsapp campaigns" ON public.whatsapp_campaigns;
CREATE POLICY "Admins read whatsapp campaigns"
  ON public.whatsapp_campaigns FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read whatsapp campaign recipients" ON public.whatsapp_campaign_recipients;
CREATE POLICY "Admins read whatsapp campaign recipients"
  ON public.whatsapp_campaign_recipients FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.whatsapp_campaigns TO authenticated;
GRANT SELECT ON public.whatsapp_campaign_recipients TO authenticated;
GRANT ALL ON public.whatsapp_campaigns TO service_role;
GRANT ALL ON public.whatsapp_campaign_recipients TO service_role;