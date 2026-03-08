
-- Fix 1: Admin can delete activity_log records
CREATE POLICY "Admins can delete activity log"
  ON public.activity_log
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Admin full access on rewards (was missing DELETE/INSERT)
CREATE POLICY "Admins can manage rewards"
  ON public.rewards
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix 3: Admin full access on payout_requests (was missing ALL admin policy)
CREATE POLICY "Admins can manage payout requests"
  ON public.payout_requests
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
