-- WhatsApp follow-up / snooze engine.
-- STAGED ONLY. Do not apply until the final Supabase migration pass.
-- WhatsApp remains a communication channel; this stores only operational follow-up work.

CREATE TABLE IF NOT EXISTS public.whatsapp_follow_up_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('snooze_resume','template')),
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','cancelled','failed')),
  template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  template_parameters jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_follow_up_tasks_due_idx
  ON public.whatsapp_follow_up_tasks (status, due_at);

CREATE INDEX IF NOT EXISTS whatsapp_follow_up_tasks_conversation_idx
  ON public.whatsapp_follow_up_tasks (conversation_id, status, due_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_follow_up_tasks TO authenticated;
GRANT ALL ON public.whatsapp_follow_up_tasks TO service_role;

ALTER TABLE public.whatsapp_follow_up_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage WhatsApp follow-up tasks" ON public.whatsapp_follow_up_tasks;
CREATE POLICY "Staff manage WhatsApp follow-up tasks"
ON public.whatsapp_follow_up_tasks
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_member'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_member'));

CREATE OR REPLACE FUNCTION public.whatsapp_snooze_conversation(
  p_conversation_id uuid,
  p_until timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_snooze$
DECLARE
  v_task_id uuid;
BEGIN
  IF NOT public.is_whatsapp_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_until IS NULL OR p_until <= now() OR p_until > now() + interval '90 days' THEN
    RAISE EXCEPTION 'Invalid snooze time';
  END IF;

  UPDATE public.whatsapp_conversations
  SET state = 'snoozed',
      snoozed_until = p_until,
      updated_at = now()
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  UPDATE public.whatsapp_follow_up_tasks
  SET status = 'cancelled', updated_at = now()
  WHERE conversation_id = p_conversation_id
    AND status IN ('pending','processing');

  INSERT INTO public.whatsapp_follow_up_tasks (
    conversation_id, kind, due_at, created_by
  )
  VALUES (
    p_conversation_id, 'snooze_resume', p_until, auth.uid()
  )
  RETURNING id INTO v_task_id;

  RETURN jsonb_build_object('task_id', v_task_id, 'snoozed_until', p_until);
END;
$whatsapp_snooze$;

REVOKE ALL ON FUNCTION public.whatsapp_snooze_conversation(uuid,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_snooze_conversation(uuid,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.whatsapp_resume_conversation(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_resume$
BEGIN
  IF NOT public.is_whatsapp_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.whatsapp_conversations
  SET state = 'waiting_for_team',
      snoozed_until = NULL,
      updated_at = now()
  WHERE id = p_conversation_id
    AND state = 'snoozed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Snoozed conversation not found';
  END IF;

  UPDATE public.whatsapp_follow_up_tasks
  SET status = 'cancelled', updated_at = now()
  WHERE conversation_id = p_conversation_id
    AND kind = 'snooze_resume'
    AND status IN ('pending','processing');

  RETURN jsonb_build_object('conversation_id', p_conversation_id, 'status', 'resumed');
END;
$whatsapp_resume$;

REVOKE ALL ON FUNCTION public.whatsapp_resume_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_resume_conversation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.whatsapp_cancel_follow_ups_for_conversation(p_conversation_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_cancel$
  UPDATE public.whatsapp_follow_up_tasks
  SET status = 'cancelled', updated_at = now()
  WHERE conversation_id = p_conversation_id
    AND status IN ('pending','processing');
$whatsapp_cancel$;

REVOKE ALL ON FUNCTION public.whatsapp_cancel_follow_ups_for_conversation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_cancel_follow_ups_for_conversation(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.whatsapp_claim_due_follow_up_tasks(p_limit integer DEFAULT 25)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  kind text,
  template_id uuid,
  template_parameters jsonb,
  attempt_count integer,
  max_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_claim$
BEGIN
  IF NOT public.is_whatsapp_staff(auth.uid()) AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH claimed AS (
    SELECT t.id
    FROM public.whatsapp_follow_up_tasks t
    WHERE t.status = 'pending'
      AND t.due_at <= now()
      AND t.attempt_count < t.max_attempts
    ORDER BY t.due_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(coalesce(p_limit,25),1),100)
  )
  UPDATE public.whatsapp_follow_up_tasks t
  SET status = 'processing',
      attempt_count = t.attempt_count + 1,
      updated_at = now()
  FROM claimed
  WHERE t.id = claimed.id
  RETURNING t.id, t.conversation_id, t.kind, t.template_id, t.template_parameters, t.attempt_count, t.max_attempts;
END;
$whatsapp_claim$;

REVOKE ALL ON FUNCTION public.whatsapp_claim_due_follow_up_tasks(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_claim_due_follow_up_tasks(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.whatsapp_complete_follow_up_task(p_task_id uuid, p_status text, p_error text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_complete$
BEGIN
  IF NOT public.is_whatsapp_staff(auth.uid()) AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_status NOT IN ('pending','sent','cancelled','failed') THEN
    RAISE EXCEPTION 'Invalid follow-up status';
  END IF;

  UPDATE public.whatsapp_follow_up_tasks
  SET status = p_status,
      due_at = CASE WHEN p_status = 'pending' THEN now() + interval '5 minutes' ELSE due_at END,
      last_error = left(p_error, 1000),
      processed_at = CASE WHEN p_status = 'pending' THEN NULL ELSE now() END,
      updated_at = now()
  WHERE id = p_task_id;
END;
$whatsapp_complete$;

REVOKE ALL ON FUNCTION public.whatsapp_complete_follow_up_task(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_complete_follow_up_task(uuid,text,text) TO service_role;

-- Any inbound message cancels stale follow-ups and removes snooze.
CREATE OR REPLACE FUNCTION public.whatsapp_cancel_followups_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_follow_trigger$
BEGIN
  PERFORM public.whatsapp_cancel_follow_ups_for_conversation(NEW.conversation_id);
  RETURN NEW;
END;
$whatsapp_follow_trigger$;

REVOKE ALL ON FUNCTION public.whatsapp_cancel_followups_on_message() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_cancel_followups_on_message() TO service_role;

DROP TRIGGER IF EXISTS whatsapp_cancel_followups_after_message ON public.whatsapp_messages;
CREATE TRIGGER whatsapp_cancel_followups_after_message
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION public.whatsapp_cancel_followups_on_message();

-- Five-minute dispatcher. Uses the same Vault-bound service-role pattern already
-- used by appointment reminders; it calls the Edge Function, which then calls
-- the existing WhatsApp connector. Provider credentials never reach the browser.
CREATE OR REPLACE FUNCTION public.dispatch_whatsapp_follow_up_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $whatsapp_cron$
DECLARE
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key';

  IF v_key IS NULL OR btrim(v_key) = '' THEN
    RAISE WARNING 'dispatch_whatsapp_follow_up_tasks: vault secret email_queue_service_role_key is missing/empty';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://mzbadxfvxioedzdjxamc.supabase.co/functions/v1/whatsapp-follow-up-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb
  );
END;
$whatsapp_cron$;

REVOKE ALL ON FUNCTION public.dispatch_whatsapp_follow_up_tasks() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-follow-up-dispatch'
  ) THEN
    PERFORM cron.schedule(
      'whatsapp-follow-up-dispatch',
      '*/5 * * * *',
      'SELECT public.dispatch_whatsapp_follow_up_tasks()'
    );
  END IF;
END;
$$;
