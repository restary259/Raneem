-- ============ Direct (non-case) staff conversations ============
CREATE TABLE public.direct_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.direct_thread_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.direct_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, user_id)
);

CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.direct_threads(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  author_role text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.direct_threads TO authenticated;
GRANT SELECT, UPDATE ON public.direct_thread_participants TO authenticated;
GRANT SELECT ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_threads TO service_role;
GRANT ALL ON public.direct_thread_participants TO service_role;
GRANT ALL ON public.direct_messages TO service_role;

ALTER TABLE public.direct_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Membership helper (security definer to avoid recursive RLS).
CREATE OR REPLACE FUNCTION public.is_direct_thread_member(_thread_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.direct_thread_participants
    WHERE thread_id = _thread_id AND user_id = _user_id
  )
$$;
REVOKE ALL ON FUNCTION public.is_direct_thread_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_direct_thread_member(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "Members read their direct threads"
ON public.direct_threads FOR SELECT TO authenticated
USING (public.is_direct_thread_member(id, auth.uid()));

CREATE POLICY "Members read participants of their threads"
ON public.direct_thread_participants FOR SELECT TO authenticated
USING (public.is_direct_thread_member(thread_id, auth.uid()));

CREATE POLICY "Members update their own read marker"
ON public.direct_thread_participants FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Members read messages in their threads"
ON public.direct_messages FOR SELECT TO authenticated
USING (public.is_direct_thread_member(thread_id, auth.uid()));

CREATE INDEX idx_direct_messages_thread ON public.direct_messages(thread_id, created_at DESC);
CREATE INDEX idx_direct_participants_user ON public.direct_thread_participants(user_id);

-- ============ RPCs (writes go only through these) ============

-- Direct chat is allowed only when at least one side is an admin, and both
-- sides are staff. Team <-> team / partner <-> partner is blocked by design.
CREATE OR REPLACE FUNCTION public.start_direct_thread(p_other_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_thread uuid;
  v_me_admin boolean;
  v_other_admin boolean;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_other_user IS NULL OR p_other_user = v_me THEN
    RAISE EXCEPTION 'Pick another staff member';
  END IF;

  v_me_admin := public.has_role(v_me, 'admin'::app_role);
  v_other_admin := public.has_role(p_other_user, 'admin'::app_role);

  IF NOT (v_me_admin OR v_other_admin) THEN
    RAISE EXCEPTION 'Direct messages must include an admin';
  END IF;

  IF NOT (v_me_admin
          OR public.has_role(v_me, 'team_member'::app_role)
          OR public.has_role(v_me, 'social_media_partner'::app_role)
          OR public.has_role(v_me, 'ambassador'::app_role)) THEN
    RAISE EXCEPTION 'Only staff can use direct messages';
  END IF;

  IF NOT (v_other_admin
          OR public.has_role(p_other_user, 'team_member'::app_role)
          OR public.has_role(p_other_user, 'social_media_partner'::app_role)
          OR public.has_role(p_other_user, 'ambassador'::app_role)) THEN
    RAISE EXCEPTION 'The selected user is not staff';
  END IF;

  SELECT p1.thread_id INTO v_thread
  FROM public.direct_thread_participants p1
  JOIN public.direct_thread_participants p2 ON p2.thread_id = p1.thread_id
  WHERE p1.user_id = v_me AND p2.user_id = p_other_user
  LIMIT 1;

  IF v_thread IS NOT NULL THEN
    RETURN v_thread;
  END IF;

  INSERT INTO public.direct_threads (created_by) VALUES (v_me) RETURNING id INTO v_thread;
  INSERT INTO public.direct_thread_participants (thread_id, user_id)
  VALUES (v_thread, v_me), (v_thread, p_other_user);

  RETURN v_thread;
END;
$$;
REVOKE ALL ON FUNCTION public.start_direct_thread(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_direct_thread(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_direct_message(p_thread_id uuid, p_body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_id uuid;
  v_name text;
  v_role text;
  v_body text := btrim(COALESCE(p_body, ''));
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_body = '' THEN RAISE EXCEPTION 'Message body required'; END IF;
  IF length(v_body) > 5000 THEN RAISE EXCEPTION 'Message is too long'; END IF;
  IF NOT public.is_direct_thread_member(p_thread_id, v_me) THEN
    RAISE EXCEPTION 'You are not a participant in this conversation';
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_me;
  SELECT role::text INTO v_role FROM public.user_roles WHERE user_id = v_me LIMIT 1;

  INSERT INTO public.direct_messages (thread_id, author_id, author_name, author_role, body)
  VALUES (p_thread_id, v_me, COALESCE(v_name, 'Unknown'), COALESCE(v_role, 'staff'), v_body)
  RETURNING id INTO v_id;

  UPDATE public.direct_threads
  SET last_message_at = now(), updated_at = now()
  WHERE id = p_thread_id;

  UPDATE public.direct_thread_participants
  SET last_read_at = now()
  WHERE thread_id = p_thread_id AND user_id = v_me;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.send_direct_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_direct_thread_read(p_thread_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.direct_thread_participants
  SET last_read_at = now()
  WHERE thread_id = p_thread_id AND user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.mark_direct_thread_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_direct_thread_read(uuid) TO authenticated;

CREATE TRIGGER trg_direct_threads_updated_at
BEFORE UPDATE ON public.direct_threads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;