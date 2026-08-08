CREATE TABLE public.case_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_role text NOT NULL DEFAULT 'team_member',
  author_name text,
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'shared' CHECK (visibility IN ('internal','shared')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.case_messages TO authenticated;
GRANT ALL ON public.case_messages TO service_role;
ALTER TABLE public.case_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all case messages"
ON public.case_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Assigned team reads case messages"
ON public.case_messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.assigned_to = auth.uid()));

CREATE POLICY "Student reads shared messages on own case"
ON public.case_messages FOR SELECT TO authenticated
USING (
  visibility = 'shared'
  AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.student_user_id = auth.uid())
);

CREATE TABLE public.case_message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.case_message_reads TO authenticated;
GRANT ALL ON public.case_message_reads TO service_role;
ALTER TABLE public.case_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own read markers"
ON public.case_message_reads FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_case_messages_case_created ON public.case_messages (case_id, created_at DESC);
CREATE INDEX idx_case_message_reads_user ON public.case_message_reads (user_id);

CREATE OR REPLACE FUNCTION public.send_case_message(
  p_case_id uuid,
  p_body text,
  p_visibility text DEFAULT 'shared'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_name text;
  v_case record;
  v_visibility text;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_body IS NULL OR btrim(p_body) = '' THEN
    RAISE EXCEPTION 'Message body required';
  END IF;
  IF length(p_body) > 5000 THEN
    RAISE EXCEPTION 'Message too long';
  END IF;

  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  IF v_case IS NULL THEN
    RAISE EXCEPTION 'Case not found';
  END IF;

  SELECT role::text INTO v_role FROM public.user_roles WHERE user_id = v_uid
  ORDER BY CASE role::text WHEN 'admin' THEN 1 WHEN 'team_member' THEN 2 WHEN 'student' THEN 3 ELSE 4 END
  LIMIT 1;

  IF v_role = 'admin' THEN
    v_visibility := COALESCE(p_visibility, 'shared');
  ELSIF v_role = 'team_member' AND v_case.assigned_to = v_uid THEN
    v_visibility := COALESCE(p_visibility, 'shared');
  ELSIF v_case.student_user_id = v_uid THEN
    v_visibility := 'shared';
    v_role := 'student';
  ELSE
    RAISE EXCEPTION 'Not allowed to message this case';
  END IF;

  IF v_visibility NOT IN ('internal','shared') THEN
    v_visibility := 'shared';
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.case_messages (case_id, author_id, author_role, author_name, body, visibility)
  VALUES (p_case_id, v_uid, v_role, v_name, btrim(p_body), v_visibility)
  RETURNING id INTO v_id;

  INSERT INTO public.case_message_reads (case_id, user_id, last_read_at)
  VALUES (p_case_id, v_uid, now())
  ON CONFLICT (case_id, user_id) DO UPDATE SET last_read_at = now();

  -- notify counterparts
  IF v_role = 'student' THEN
    IF v_case.assigned_to IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, source, case_id, title_ar, title_en, body_ar, body_en, link)
      VALUES (v_case.assigned_to, 'New case message', left(btrim(p_body), 140), 'case_message', p_case_id,
              'رسالة جديدة في الملف', 'New case message', left(btrim(p_body), 140), left(btrim(p_body), 140),
              '/team/cases/' || p_case_id::text);
    END IF;
  ELSIF v_visibility = 'shared' AND v_case.student_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, source, case_id, title_ar, title_en, body_ar, body_en, link)
    VALUES (v_case.student_user_id, 'New message from your advisor', left(btrim(p_body), 140), 'case_message', p_case_id,
            'رسالة جديدة من فريق درب', 'New message from your advisor', left(btrim(p_body), 140), left(btrim(p_body), 140),
            '/student-dashboard');
  END IF;

  PERFORM public.log_case_event(p_case_id, 'message_sent',
    jsonb_build_object('visibility', v_visibility, 'author_role', v_role),
    v_visibility = 'internal');

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_case_message(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_case_message(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_case_messages_read(p_case_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.case_message_reads (case_id, user_id, last_read_at)
  VALUES (p_case_id, auth.uid(), now())
  ON CONFLICT (case_id, user_id) DO UPDATE SET last_read_at = now();
$$;

REVOKE ALL ON FUNCTION public.mark_case_messages_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_case_messages_read(uuid) TO authenticated;