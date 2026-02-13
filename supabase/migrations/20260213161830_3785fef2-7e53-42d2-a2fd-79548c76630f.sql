
-- Allow admins to delete contact submissions
CREATE POLICY "Admins can delete contact submissions"
ON public.contact_submissions
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete profiles (for student management)
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to insert contact submissions (for completeness)
CREATE POLICY "Admins can insert contact submissions"
ON public.contact_submissions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow anon users to insert contact submissions (public form)
CREATE POLICY "Anyone can submit contact form"
ON public.contact_submissions
FOR INSERT
WITH CHECK (true);
