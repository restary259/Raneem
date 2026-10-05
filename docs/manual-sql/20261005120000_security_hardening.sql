-- Manual deploy. Durable rate limiting shared by all edge-function instances.
-- Edge functions fall back to their old in-memory limit until this exists.
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rate_limit_hits TO service_role;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (edge functions) can touch it.
CREATE INDEX IF NOT EXISTS rate_limit_hits_bucket_time_idx
  ON public.rate_limit_hits (bucket, created_at DESC);

-- Records one hit and returns true when the caller is OVER the limit.
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_bucket text, p_max int, p_window_seconds int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  INSERT INTO public.rate_limit_hits (bucket) VALUES (left(p_bucket, 200));
  SELECT count(*) INTO v_count FROM public.rate_limit_hits
   WHERE bucket = left(p_bucket, 200)
     AND created_at > now() - make_interval(secs => p_window_seconds);
  -- Opportunistic cleanup of old hits (bounded).
  DELETE FROM public.rate_limit_hits
   WHERE id IN (SELECT id FROM public.rate_limit_hits
                 WHERE created_at < now() - interval '1 day' LIMIT 500);
  RETURN v_count > p_max;
END;
$$;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, int, int) TO service_role;
