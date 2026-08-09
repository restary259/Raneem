-- Drain the push queue by calling the push-dispatch function; self-disarms
-- when the queue is empty. Mirrors the existing email queue dispatcher.
CREATE OR REPLACE FUNCTION public.push_queue_dispatch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgmq.q_push_notifications) THEN
    BEGIN
      PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000002);
      IF EXISTS (SELECT 1 FROM pgmq.q_push_notifications) THEN
        RETURN;
      END IF;
      PERFORM cron.unschedule('process-push-queue');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'push_queue_dispatch: cron unschedule failed: %', SQLERRM;
    END;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://mzbadxfvxioedzdjxamc.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.push_queue_dispatch() FROM PUBLIC, anon, authenticated;

-- Arm the cron as soon as something is queued so delivery starts in seconds.
CREATE OR REPLACE FUNCTION public.push_queue_wake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000002);
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-push-queue') THEN
    PERFORM cron.schedule('process-push-queue', '5 seconds', 'SELECT public.push_queue_dispatch()');
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'push_queue_wake: cron schedule failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.push_queue_wake() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_push_queue_wake ON public.notifications;
CREATE TRIGGER trg_push_queue_wake
  AFTER INSERT ON public.notifications
  FOR EACH STATEMENT EXECUTE FUNCTION public.push_queue_wake();