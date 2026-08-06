CREATE TABLE public.auth_failure_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  is_anonymous boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'rls',
  target text NOT NULL,
  operation text,
  status_code text,
  error_message text,
  path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.auth_failure_log TO anon;
GRANT INSERT, SELECT ON public.auth_failure_log TO authenticated;
GRANT ALL ON public.auth_failure_log TO service_role;

ALTER TABLE public.auth_failure_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record an auth failure"
  ON public.auth_failure_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view auth failures"
  ON public.auth_failure_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_auth_failure_log_created_at ON public.auth_failure_log (created_at DESC);
CREATE INDEX idx_auth_failure_log_target ON public.auth_failure_log (target, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_auth_failure_spikes(
  p_window interval DEFAULT '1 hour'::interval,
  p_threshold integer DEFAULT 10
)
RETURNS TABLE(target text, source text, failure_count bigint, last_seen timestamptz, is_new boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT f.target,
         f.source,
         COUNT(*) AS failure_count,
         MAX(f.created_at) AS last_seen,
         NOT EXISTS (
           SELECT 1 FROM public.auth_failure_log p
           WHERE p.target = f.target
             AND p.created_at < now() - p_window
             AND p.created_at > now() - interval '7 days'
         ) AS is_new
  FROM public.auth_failure_log f
  WHERE f.created_at > now() - p_window
    AND public.has_role(auth.uid(), 'admin'::app_role)
  GROUP BY f.target, f.source
  HAVING COUNT(*) >= p_threshold
      OR NOT EXISTS (
           SELECT 1 FROM public.auth_failure_log p
           WHERE p.target = f.target
             AND p.created_at < now() - p_window
             AND p.created_at > now() - interval '7 days'
         )
  ORDER BY failure_count DESC
$$;

REVOKE EXECUTE ON FUNCTION public.get_auth_failure_spikes(interval, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_auth_failure_spikes(interval, integer) TO authenticated, service_role;