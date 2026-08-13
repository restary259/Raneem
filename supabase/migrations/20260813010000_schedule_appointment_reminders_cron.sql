-- Persist the runtime auth fix for the send-appointment-reminders pg_cron job.
--
-- Background: the Edge Function send-appointment-reminders calls
-- requireAuth(req, ["admin"]) (supabase/functions/_shared/auth.ts), which only
-- accepts the service-role key or an admin JWT. The original cron job (old
-- jobid 63) passed the anon JWT in an `apikey` header, so requireAuth logged a
-- "Missing bearer token" denial (auth.ts:71-80) and returned 401 on every
-- firing — appointment_reminders rows were created by
-- sync_appointment_reminders() but never drained.
--
-- A runtime fix corrected this by recreating the job (jobid 214, jobname
-- 'send-appointment-reminders', schedule */5 * * * *) so it now sends
-- Authorization: 'Bearer ' || <vault email_queue_service_role_key>. That fix
-- lives only in the live cron.job table and is NOT in the repo, so it would
-- silently regress if migrations are replayed or the original out-of-band
-- scheduler re-runs. This migration makes the corrected job the durable source
-- of truth.
--
-- Mirrors the guarded dispatch pattern in
-- 20260812130000_guard_queue_dispatch_secret.sql and
-- 20260810070100_capture_untracked_rpcs.sql: a SECURITY DEFINER wrapper reads
-- the vault-stored email_queue_service_role_key (the same service-role secret
-- used by the push/email dispatchers) and passes it as a Bearer header, so the
-- Authorization header never collapses to NULL. Unlike the queue dispatchers
-- this job is NOT self-disarming: appointments are scheduled into the future
-- and become due as wall-clock time advances, so the poller must keep running
-- every 5 minutes.

-- 1. Idempotently tear down every stale send-appointment-reminders cron job.
--    Unschedules by the canonical jobname, and also removes any orphaned job
--    whose command targets the function URL — that catches stale duplicates
--    created out-of-band under a different jobname (e.g. old jobid 63 with the
--    broken anon-JWT/apikey header).
DO $$
DECLARE
  v_orphan bigint;
BEGIN
  BEGIN
    PERFORM cron.unschedule('send-appointment-reminders');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'appointment-reminders cron: unschedule by name failed: %', SQLERRM;
  END;

  LOOP
    SELECT jobid INTO v_orphan
      FROM cron.job
     WHERE command ~ 'functions/v1/send-appointment-reminders'
     LIMIT 1;
    EXIT WHEN v_orphan IS NULL;
    BEGIN
      PERFORM cron.unschedule(v_orphan);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'appointment-reminders cron: unschedule orphan jobid % failed: %', v_orphan, SQLERRM;
      EXIT;
    END;
  END LOOP;
END;
$$;

-- 2. The corrected dispatcher. Mirrors push_queue_dispatch /
--    email_queue_dispatch (20260812130000_guard_queue_dispatch_secret.sql,
--    20260810070100_capture_untracked_rpcs.sql): a SECURITY DEFINER wrapper
--    reads the vault-stored service-role key, RAISE WARNING when it is
--    absent/empty (so the failure is visible in Postgres logs instead of
--    silently collapsing the Authorization header to NULL), and only POSTs
--    when present. The vault read happens at execution time, so a rotated
--    secret is picked up automatically on the next firing.
CREATE OR REPLACE FUNCTION public.dispatch_appointment_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key';

  IF v_key IS NULL OR btrim(v_key) = '' THEN
    RAISE WARNING 'dispatch_appointment_reminders: vault secret email_queue_service_role_key is missing/empty — appointment reminders cannot be sent until it is set';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://mzbadxfvxioedzdjxamc.supabase.co/functions/v1/send-appointment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_appointment_reminders() FROM PUBLIC, anon, authenticated;

-- 3. Reschedule the corrected job under the canonical jobname. Guarded so
--    re-running the migration never creates a duplicate (the teardown above
--    should already have left none, but a concurrent scheduler could re-arm one
--    between steps). NOT self-disarming: appointments are scheduled into the
--    future and become due as wall-clock time advances, so the poller must keep
--    running every 5 minutes indefinitely.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'send-appointment-reminders'
  ) THEN
    PERFORM cron.schedule(
      'send-appointment-reminders',
      '*/5 * * * *',
      'SELECT public.dispatch_appointment_reminders()'
    );
  END IF;
END;
$$;

-- ============================================================
-- Optional hardening: same auth fix for the admin-weekly-digest
-- cron (jobid 1 in the live cron.job table). That Edge Function
-- also calls requireAuth(req, ["admin"]) (admin-weekly-digest/
-- index.ts:13), and the original cron passes the anon JWT in an
-- `apikey` header — so it 401s the same way on every firing. With
-- no tracked migration, the broken header regresses on replay.
-- Switch it to the same vault service-role key.
-- ============================================================

-- 4. Idempotently tear down every stale admin-weekly-digest cron job
--    (canonical jobname + any orphan whose command targets the URL).
DO $$
DECLARE
  v_digest_orphan bigint;
BEGIN
  BEGIN
    PERFORM cron.unschedule('admin-weekly-digest');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'admin-weekly-digest cron: unschedule by name failed: %', SQLERRM;
  END;

  LOOP
    SELECT jobid INTO v_digest_orphan
      FROM cron.job
     WHERE command ~ 'functions/v1/admin-weekly-digest'
     LIMIT 1;
    EXIT WHEN v_digest_orphan IS NULL;
    BEGIN
      PERFORM cron.unschedule(v_digest_orphan);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'admin-weekly-digest cron: unschedule orphan jobid % failed: %', v_digest_orphan, SQLERRM;
      EXIT;
    END;
  END LOOP;
END;
$$;

-- 5. The corrected weekly-digest dispatcher (same guarded vault pattern).
CREATE OR REPLACE FUNCTION public.dispatch_admin_weekly_digest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key';

  IF v_key IS NULL OR btrim(v_key) = '' THEN
    RAISE WARNING 'dispatch_admin_weekly_digest: vault secret email_queue_service_role_key is missing/empty — the weekly admin digest cannot be sent until it is set';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://mzbadxfvxioedzdjxamc.supabase.co/functions/v1/admin-weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_admin_weekly_digest() FROM PUBLIC, anon, authenticated;

-- 6. Reschedule the corrected weekly digest (Mondays 08:00 UTC). Guarded
--    against duplicates.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'admin-weekly-digest'
  ) THEN
    PERFORM cron.schedule(
      'admin-weekly-digest',
      '0 8 * * 1',
      'SELECT public.dispatch_admin_weekly_digest()'
    );
  END IF;
END;
$$;
