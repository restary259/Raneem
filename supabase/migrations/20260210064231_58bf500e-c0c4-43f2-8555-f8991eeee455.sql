
-- Fix RLS: only admins can read contact submissions, only service role inserts
DROP POLICY "Service role can manage contact submissions" ON public.contact_submissions;

-- Admins can read submissions
CREATE POLICY "Admins can view contact submissions"
ON public.contact_submissions
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update submissions (e.g., add notes, change status)
CREATE POLICY "Admins can update contact submissions"
ON public.contact_submissions
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Insert is done via service role key in edge function (bypasses RLS)
-- No insert policy needed for regular users

-- Also add admin SELECT policy on profiles for admin dashboard
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can view all services
CREATE POLICY "Admins can view all services"
ON public.services
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can view all payments
CREATE POLICY "Admins can view all payments"
ON public.payments
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can view all documents metadata
CREATE POLICY "Admins can view all documents"
ON public.documents
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
