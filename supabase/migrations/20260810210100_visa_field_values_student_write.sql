-- Enable student write access to their own visa field values
-- Students can INSERT/UPSERT their own visa_field_values rows (student_user_id = auth.uid())
-- Existing SELECT policy already allows students to read their own values

CREATE POLICY "Students insert own visa values"
  ON public.visa_field_values FOR INSERT TO authenticated
  WITH CHECK (student_user_id = auth.uid());

CREATE POLICY "Students update own visa values"
  ON public.visa_field_values FOR UPDATE TO authenticated
  USING (student_user_id = auth.uid())
  WITH CHECK (student_user_id = auth.uid());

GRANT INSERT, UPDATE ON public.visa_field_values TO authenticated;