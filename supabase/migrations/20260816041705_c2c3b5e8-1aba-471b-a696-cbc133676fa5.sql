DROP POLICY IF EXISTS "Admins manage own sessions" ON public.admin_security_sessions;

CREATE POLICY "Admins manage own sessions"
ON public.admin_security_sessions
FOR ALL
TO authenticated
USING (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'::app_role));