CREATE POLICY "Assigned team can view student profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.student_user_id = profiles.id
      AND c.assigned_to = auth.uid()
  )
);