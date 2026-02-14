CREATE POLICY "Students can view appointments for their cases"
  ON public.appointments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM student_cases sc
      WHERE sc.id = appointments.case_id
      AND sc.student_profile_id = auth.uid()
    )
  );