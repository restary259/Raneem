DROP POLICY IF EXISTS "realtime private channel read" ON realtime.messages;
DROP POLICY IF EXISTS "realtime private channel write" ON realtime.messages;

CREATE POLICY "realtime private channel read"
ON realtime.messages FOR SELECT TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'typing:case:%' THEN public.can_access_case_thread((NULLIF(split_part(realtime.topic(), ':', 3), ''))::uuid, auth.uid())
    WHEN realtime.topic() LIKE 'typing:direct:%' THEN public.is_direct_thread_member((NULLIF(split_part(realtime.topic(), ':', 3), ''))::uuid, auth.uid())
    WHEN realtime.topic() = 'presence:staff' THEN (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_member'))
    ELSE false
  END
);

CREATE POLICY "realtime private channel write"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  CASE
    WHEN realtime.topic() LIKE 'typing:case:%' THEN public.can_access_case_thread((NULLIF(split_part(realtime.topic(), ':', 3), ''))::uuid, auth.uid())
    WHEN realtime.topic() LIKE 'typing:direct:%' THEN public.is_direct_thread_member((NULLIF(split_part(realtime.topic(), ':', 3), ''))::uuid, auth.uid())
    WHEN realtime.topic() = 'presence:staff' THEN (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_member'))
    ELSE false
  END
);