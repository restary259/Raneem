CREATE POLICY "Team upload receipts for assigned cases" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'student-documents' AND (storage.foldername(name))[1] = 'cases' AND (storage.foldername(name))[3] = 'receipts'
  AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id::text = (storage.foldername(name))[2] AND c.assigned_to = auth.uid()));
CREATE POLICY "Team read receipts for assigned cases" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'student-documents' AND (storage.foldername(name))[1] = 'cases' AND (storage.foldername(name))[3] = 'receipts'
  AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id::text = (storage.foldername(name))[2] AND c.assigned_to = auth.uid()));