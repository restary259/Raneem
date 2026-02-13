-- Drop the overly permissive public INSERT policy on contact_submissions
DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;