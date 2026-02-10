
-- Login attempts tracking for rate limiting
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Only admins can view login attempts
CREATE POLICY "Admins can view login attempts"
  ON public.login_attempts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- No direct insert from client - only via edge function with service role

-- Admin audit log
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_table text,
  target_id text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON public.admin_audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- AI chat logs for abuse detection
CREATE TABLE public.ai_chat_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  message_preview text,
  tokens_used integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_chat_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view AI chat logs"
  ON public.ai_chat_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for rate limiting queries
CREATE INDEX idx_login_attempts_email_time ON public.login_attempts(email, created_at DESC);
CREATE INDEX idx_ai_chat_logs_created ON public.ai_chat_logs(created_at DESC);
CREATE INDEX idx_admin_audit_log_created ON public.admin_audit_log(created_at DESC);
