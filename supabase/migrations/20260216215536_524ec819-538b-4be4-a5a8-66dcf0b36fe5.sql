-- Add gender column to student_cases
ALTER TABLE student_cases ADD COLUMN IF NOT EXISTS gender text;

-- Allow lawyers to delete their assigned cases
CREATE POLICY "Lawyers can delete assigned cases"
  ON student_cases FOR DELETE
  USING (
    has_role(auth.uid(), 'lawyer'::app_role)
    AND assigned_lawyer_id = auth.uid()
  );