DROP POLICY IF EXISTS "Staff manage WhatsApp messages" ON public.whatsapp_messages;
REVOKE INSERT, UPDATE, DELETE ON public.whatsapp_messages FROM authenticated;
GRANT SELECT ON public.whatsapp_messages TO authenticated;
CREATE POLICY "Staff read WhatsApp messages" ON public.whatsapp_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_member'));

DROP POLICY IF EXISTS "Staff manage WhatsApp templates" ON public.whatsapp_templates;
REVOKE INSERT, UPDATE, DELETE ON public.whatsapp_templates FROM authenticated;
GRANT SELECT ON public.whatsapp_templates TO authenticated;
CREATE POLICY "Staff read WhatsApp templates" ON public.whatsapp_templates FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_member'));