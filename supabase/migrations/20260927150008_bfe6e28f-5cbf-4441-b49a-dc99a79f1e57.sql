CREATE OR REPLACE FUNCTION public.start_voice_call(p_callee_id uuid, p_thread_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $start_voice_call$
DECLARE
  v_me uuid := auth.uid();
  v_callee uuid := p_callee_id;
  v_thread uuid;
  v_call uuid;
  v_caller_name text;
  v_link text;
  v_is_admin boolean;
  v_enabled boolean;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_callee IS NULL OR v_callee = v_me THEN RAISE EXCEPTION 'Pick another person to call'; END IF;

  v_is_admin := public.has_role(v_me, 'admin'::app_role);

  IF v_is_admin THEN
    SELECT voice_calls_enabled INTO v_enabled FROM public.profiles
     WHERE id = v_callee AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'You cannot call this person'; END IF;
    IF NOT COALESCE(v_enabled, false) THEN
      UPDATE public.profiles SET voice_calls_enabled = true WHERE id = v_callee;
      INSERT INTO public.admin_audit_log (admin_id, action, target_id, target_table, details)
      VALUES (v_me, 'voice_calls_auto_enabled', v_callee, 'profiles',
              jsonb_build_object('reason', 'admin_call'));
    END IF;
  ELSIF NOT public.can_communicate_directly(v_me, v_callee) THEN
    RAISE EXCEPTION 'You cannot call this person';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(LEAST(v_me, v_callee)::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(GREATEST(v_me, v_callee)::text, 0));

  IF EXISTS (SELECT 1 FROM public.voice_call_locks WHERE user_id IN (v_me, v_callee)) THEN
    RAISE EXCEPTION 'One of you is already on another call';
  END IF;

  IF p_thread_id IS NOT NULL THEN
    SELECT p1.thread_id INTO v_thread
    FROM public.direct_thread_participants p1
    JOIN public.direct_thread_participants p2 ON p2.thread_id = p1.thread_id
    WHERE p1.thread_id = p_thread_id AND p1.user_id = v_me AND p2.user_id = v_callee
    LIMIT 1;
    IF v_thread IS NULL THEN RAISE EXCEPTION 'That conversation is not shared with this person'; END IF;
  ELSE
    SELECT p1.thread_id INTO v_thread
    FROM public.direct_thread_participants p1
    JOIN public.direct_thread_participants p2 ON p2.thread_id = p1.thread_id
    WHERE p1.user_id = v_me AND p2.user_id = v_callee
    LIMIT 1;
    IF v_thread IS NULL THEN
      IF v_is_admin THEN
        INSERT INTO public.direct_threads (created_by) VALUES (v_me) RETURNING id INTO v_thread;
        INSERT INTO public.direct_thread_participants (thread_id, user_id)
        VALUES (v_thread, v_me), (v_thread, v_callee);
      ELSE
        RAISE EXCEPTION 'You need an existing conversation before you can call';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.voice_calls (thread_id, caller_id, callee_id, status)
  VALUES (v_thread, v_me, v_callee, 'ringing') RETURNING id INTO v_call;

  INSERT INTO public.voice_call_locks (user_id, call_id) VALUES (v_me, v_call), (v_callee, v_call);

  SELECT COALESCE(NULLIF(full_name, ''), 'Someone') INTO v_caller_name FROM public.profiles WHERE id = v_me;

  v_link := CASE
    WHEN public.has_role(v_callee, 'admin'::app_role) THEN '/admin/messages?call=' || v_call::text
    WHEN public.has_role(v_callee, 'team_member'::app_role) THEN '/team/messages?call=' || v_call::text
    WHEN public.has_role(v_callee, 'agent'::app_role) THEN '/agent/messages?call=' || v_call::text
    WHEN public.has_role(v_callee, 'social_media_partner'::app_role) THEN '/partner/messages?call=' || v_call::text
    WHEN public.has_role(v_callee, 'ambassador'::app_role) THEN '/partner/messages?call=' || v_call::text
    ELSE '/student/messages?call=' || v_call::text
  END;

  INSERT INTO public.notifications
    (user_id, title, body, title_en, title_ar, body_en, body_ar, source, category, priority, link, dedupe_key)
  VALUES
    (v_callee, 'Incoming voice call', v_caller_name || ' is calling you', 'Incoming voice call',
     'مكالمة صوتية واردة', v_caller_name || ' is calling you', v_caller_name || ' يتصل بك',
     'voice_call', 'calls', 'high', v_link, 'voice_call:' || v_call::text)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN v_call;
END;
$start_voice_call$;

REVOKE ALL ON FUNCTION public.start_voice_call(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_voice_call(uuid, uuid) TO authenticated;