CREATE POLICY "Admins read darb documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'darb-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins upload darb documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'darb-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update darb documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'darb-documents' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'darb-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete darb documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'darb-documents' AND public.has_role(auth.uid(), 'admin'));