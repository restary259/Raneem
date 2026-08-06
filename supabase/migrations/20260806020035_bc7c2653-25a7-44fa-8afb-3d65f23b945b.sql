DROP POLICY IF EXISTS "System can insert activity" ON public.activity_log;
CREATE POLICY "Users can insert their own activity"
ON public.activity_log
FOR INSERT
TO authenticated
WITH CHECK (actor_id = auth.uid());