DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_dispatch_secret') THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'cron_dispatch_secret',
      'Shared secret proving a request came from pg_cron (edge function dispatch).'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_cron_dispatch_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_dispatch_secret'
$$;

REVOKE ALL ON FUNCTION public.get_cron_dispatch_secret() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_cron_dispatch_secret() FROM anon;
REVOKE ALL ON FUNCTION public.get_cron_dispatch_secret() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_dispatch_secret() TO service_role;

CREATE OR REPLACE FUNCTION public.push_queue_dispatch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
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

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_dispatch_secret';

  IF v_secret IS NULL THEN
    RAISE WARNING 'push_queue_dispatch: cron_dispatch_secret missing; skipping dispatch';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://mzbadxfvxioedzdjxamc.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_appointment_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_dispatch_secret';

  IF v_secret IS NULL THEN
    RAISE WARNING 'dispatch_appointment_reminders: cron_dispatch_secret missing';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://mzbadxfvxioedzdjxamc.supabase.co/functions/v1/send-appointment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_appointment_reminders() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_appointment_reminders() FROM anon;
REVOKE ALL ON FUNCTION public.dispatch_appointment_reminders() FROM authenticated;

DO $$
DECLARE
  j record;
BEGIN
  FOR j IN
    SELECT jobid FROM cron.job
    WHERE jobname = 'send-appointment-reminders'
       OR command LIKE '%/functions/v1/send-appointment-reminders%'
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
  PERFORM cron.schedule(
    'send-appointment-reminders',
    '*/5 * * * *',
    'SELECT public.dispatch_appointment_reminders();'
  );

  FOR j IN SELECT jobid FROM cron.job WHERE jobname = 'email-queue-safety-sweep' LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;