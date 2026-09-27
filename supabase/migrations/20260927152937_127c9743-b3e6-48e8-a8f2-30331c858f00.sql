ALTER TABLE public.voice_calls ADD COLUMN IF NOT EXISTS call_logged boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.log_voice_call_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dur int := 0; v_name text; v_kind text;
BEGIN
  IF NEW.call_logged OR NEW.status NOT IN ('ended','declined','cancelled','missed','failed') THEN
    RETURN NEW;
  END IF;
  IF NEW.answered_at IS NOT NULL THEN
    v_dur := GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(NEW.ended_at, now()) - NEW.answered_at))::int);
    v_kind := 'answered';
  ELSE
    v_kind := NEW.status;
  END IF;
  SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.caller_id;
  INSERT INTO public.direct_messages (thread_id, author_id, author_name, author_role, body, kind, attachments)
  VALUES (NEW.thread_id, NEW.caller_id, COALESCE(v_name,''), 'system',
          'call:' || v_kind || ':' || v_dur, 'call',
          jsonb_build_array(jsonb_build_object('call_id', NEW.id, 'status', v_kind, 'duration_s', v_dur)));
  NEW.call_logged := true;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.log_voice_call_message() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_voice_call_message ON public.voice_calls;
CREATE TRIGGER trg_log_voice_call_message BEFORE UPDATE OF status ON public.voice_calls
FOR EACH ROW EXECUTE FUNCTION public.log_voice_call_message();