
-- Restore RLS policies for old tables that lost policies due to CASCADE

-- admin_audit_log
CREATE POLICY "Admins can view audit log v2" ON public.admin_audit_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert audit log v2" ON public.admin_audit_log
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ai_chat_logs
CREATE POLICY "Admins can view AI chat logs v2" ON public.ai_chat_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- commission_tiers
CREATE POLICY "Admins can manage commission tiers v2" ON public.commission_tiers
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view tiers v2" ON public.commission_tiers
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- commissions
CREATE POLICY "Admins can manage all commissions v2" ON public.commissions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- contact_submissions
CREATE POLICY "Admins can manage contact submissions v2" ON public.contact_submissions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can insert contact submissions v2" ON public.contact_submissions
  FOR INSERT WITH CHECK (true);

-- influencer_invites
CREATE POLICY "Admins can manage invites v2" ON public.influencer_invites
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- leads
CREATE POLICY "Admins can manage all leads v2" ON public.leads
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team can view all leads v2" ON public.leads
  FOR SELECT USING (public.has_role(auth.uid(), 'team_member'));

-- login_attempts
CREATE POLICY "Admins can view login attempts v2" ON public.login_attempts
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert login attempts v2" ON public.login_attempts
  FOR INSERT WITH CHECK (true);

-- transaction_log
CREATE POLICY "Admins can manage transaction log v2" ON public.transaction_log
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
