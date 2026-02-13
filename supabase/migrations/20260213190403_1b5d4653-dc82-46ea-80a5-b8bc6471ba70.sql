-- Drop the user self-insert rewards policy (only admins should create rewards)
DROP POLICY IF EXISTS "Users can insert own rewards" ON public.rewards;