-- Fix: Add INSERT policy for admin_audit_log (currently missing, causing RLS violations)
CREATE POLICY "Admins can insert audit log"
ON public.admin_audit_log
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));