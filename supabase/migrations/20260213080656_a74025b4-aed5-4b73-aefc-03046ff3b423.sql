-- Allow admins to view all files in student-documents bucket
CREATE POLICY "Admins can view all student documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'student-documents' AND public.has_role(auth.uid(), 'admin'::app_role));