CREATE POLICY "Staff read whatsapp media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'whatsapp-media' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_member')));
CREATE POLICY "Staff upload whatsapp media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'whatsapp-media' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_member')));
CREATE POLICY "Staff delete whatsapp media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'whatsapp-media' AND public.has_role(auth.uid(), 'admin'));