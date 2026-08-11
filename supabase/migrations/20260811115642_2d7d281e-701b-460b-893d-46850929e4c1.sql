-- 1. Session metadata (IP / user agent) no longer streams over Realtime.
ALTER PUBLICATION supabase_realtime DROP TABLE public.active_sessions;

-- 2. Soft-deleted case messages are unreadable for students and assigned team.
DROP POLICY IF EXISTS "Student reads shared messages on own case" ON public.case_messages;
CREATE POLICY "Student reads shared messages on own case"
ON public.case_messages
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND visibility = 'shared'
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_messages.case_id AND c.student_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Assigned team reads case messages" ON public.case_messages;
CREATE POLICY "Assigned team reads case messages"
ON public.case_messages
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_messages.case_id AND c.assigned_to = auth.uid()
  )
);

-- 3. Soft-deleted direct messages are unreadable for thread members.
DROP POLICY IF EXISTS "Members read messages in their threads" ON public.direct_messages;
CREATE POLICY "Members read messages in their threads"
ON public.direct_messages
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND public.is_direct_thread_member(thread_id, auth.uid())
);