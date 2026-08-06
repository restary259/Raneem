
-- 1. documents: scope team_member access to assigned cases
DROP POLICY IF EXISTS "Team members can view documents" ON public.documents;
DROP POLICY IF EXISTS "Team can insert documents" ON public.documents;

CREATE POLICY "Team can view assigned documents"
ON public.documents FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.assigned_to = auth.uid()
      AND (c.id = documents.case_id OR c.student_user_id = documents.student_id)
  )
);

CREATE POLICY "Team can insert assigned documents"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.assigned_to = auth.uid()
      AND (c.id = documents.case_id OR c.student_user_id = documents.student_id)
  )
);

-- 2. storage: scope team uploads to folders of their assigned students
DROP POLICY IF EXISTS "Team can upload to student documents storage" ON storage.objects;

CREATE POLICY "Team can upload to assigned student documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'student-documents'
  AND public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.assigned_to = auth.uid()
      AND c.student_user_id::text = (storage.foldername(name))[1]
  )
);

-- 3. important_contacts: only signed-in users that actually hold a role
DROP POLICY IF EXISTS "Authenticated users read active contacts" ON public.important_contacts;

CREATE POLICY "Roled users read active contacts"
ON public.important_contacts FOR SELECT TO authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('student','team_member','admin','social_media_partner','ambassador')
  )
);

-- 4. anonymize_user is only invoked by internal service-role code
REVOKE EXECUTE ON FUNCTION public.anonymize_user(uuid) FROM PUBLIC, anon, authenticated;
