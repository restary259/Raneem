-- Guard the push/email queue dispatchers against a missing vault secret.
--
-- Both push_queue_dispatch and email_queue_dispatch authenticate their call to
-- the matching Edge Function with `Bearer <vault.decrypted_secrets name =
-- 'email_queue_service_role_key'>`. That secret is a POST-MIGRATION step applied
-- via the Supabase Management API (see 20260808082851_email_infra.sql); it is
-- NOT created by a static migration. If it was never set (or was rotated and
-- not refreshed), the Authorization header collapses to NULL and the cron
-- silently fails to drain either queue — so push notifications and async
-- transactional emails stop being delivered while inserts still succeed
-- (in-app/realtime notifications keep working).
--
-- Surface that condition loudly instead of failing silently: read the secret
-- once, RAISE WARNING when it is absent, and only POST when present. This
-- makes the failure visible in Postgres logs the next time the cron runs.
-- No behaviour change when the secret is present.

CREATE OR REPLACE FUNCTION public.push_queue_dispatch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_key text;
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

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key';

  IF v_key IS NULL OR btrim(v_key) = '' THEN
    RAISE WARNING 'push_queue_dispatch: vault secret email_queue_service_role_key is missing/empty — push delivery is disabled until it is set';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://mzbadxfvxioedzdjxamc.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.push_queue_dispatch() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.email_queue_dispatch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_has_messages boolean := false;
  v_key          text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pgmq.auth_emails)
      OR EXISTS (SELECT 1 FROM pgmq.transactional_emails)
    INTO v_has_messages;

  IF NOT v_has_messages THEN
    BEGIN
      PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);
      IF NOT (EXISTS (SELECT 1 FROM pgmq.auth_emails)
           OR EXISTS (SELECT 1 FROM pgmq.transactional_emails)) THEN
        PERFORM cron.unschedule('process-email-queue');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'email_queue_dispatch: cron unschedule failed: %', SQLERRM;
    END;
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key';

  IF v_key IS NULL OR btrim(v_key) = '' THEN
    RAISE WARNING 'email_queue_dispatch: vault secret email_queue_service_role_key is missing/empty — async email delivery is disabled until it is set';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://mzbadxfvxioedzdjxamc.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM anon;
