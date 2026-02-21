
-- Create active_sessions table for single-session enforcement
CREATE TABLE public.active_sessions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

-- Enable Row Level Security
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read their own row to check if their session is still active
CREATE POLICY "Users can view own session"
  ON public.active_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for regular users
-- Only service role (edge functions) can write

-- Enable realtime for instant invalidation detection
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_sessions;
