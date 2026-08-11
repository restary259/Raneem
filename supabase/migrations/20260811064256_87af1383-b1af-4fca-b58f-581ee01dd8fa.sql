DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
CREATE POLICY "Users can view own documents"
  ON public.documents FOR SELECT TO authenticated
  USING (auth.uid() = student_id AND COALESCE(is_visible_to_student, true) = true);

DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
CREATE POLICY "Users can update own documents"
  ON public.documents FOR UPDATE TO authenticated
  USING (auth.uid() = student_id AND COALESCE(is_visible_to_student, true) = true)
  WITH CHECK (auth.uid() = student_id AND COALESCE(is_visible_to_student, true) = true);

DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
CREATE POLICY "Users can delete own documents"
  ON public.documents FOR DELETE TO authenticated
  USING (auth.uid() = student_id AND COALESCE(is_visible_to_student, true) = true);