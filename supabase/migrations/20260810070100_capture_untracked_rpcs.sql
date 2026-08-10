-- Phase 1: Capture two RPCs that exist in the live database but had no
-- CREATE FUNCTION migration.
--
-- Signatures from src/integrations/supabase/types.ts:
--   confirm_agency_service_fee(p_case_id uuid) -> jsonb
--   email_queue_dispatch() -> void
--
-- 1. confirm_agency_service_fee
--    This is a sibling of confirm_agency_service_payment (captured in Phase 0).
--    It is NOT called from any frontend or Edge Function code (only present in
--    types.ts), suggesting it is either an earlier naming or a kept-for-
--    compatibility alias. It is reconstructed to mirror confirm_agency_service
--    _payment exactly so the live behaviour is preserved. If it is unused, it
--    is harmless; if some out-of-band caller invokes it, it stays functional.
--
-- 2. email_queue_dispatch
--    The pg_cron dispatcher for the email queue. The email_infra migration
--    (20260808082851) sets up the pgmq queues and the enqueue/read/delete
--    helpers, but documents in a comment block that the cron job and the
--    vault secret are applied "dynamically via the Supabase Management API" —
--    they were never written as a migration. This function mirrors the
--    tracked push_queue_dispatch (migration 20260809083350) and the documented
--    "process-email-queue" behaviour, then schedules it via pg_cron so a
--    fresh `db reset` reproduces the live 5-second dispatch cadence.

-- ── 1. confirm_agency_service_fee ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_agency_service_fee(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
  v_case RECORD;
  v_total numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id, assigned_to, student_user_id, status INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;
  IF NOT (public.has_role(v_uid, 'admin') OR v_case.assigned_to = v_uid) THEN
    RAISE EXCEPTION 'Not allowed to confirm payments for this case';
  END IF;

  PERFORM public.ensure_case_finance_confirmations(p_case_id);
  v_total := public.get_case_darb_service_total(p_case_id);

  UPDATE public.case_finance_confirmations
     SET status = 'confirmed', confirmed_by = v_uid, confirmed_at = now(), updated_at = now()
   WHERE case_id = p_case_id AND finance_type = 'service_fee';

  RETURN jsonb_build_object(
    'case_id', p_case_id,
    'finance_type', 'service_fee',
    'status', 'confirmed',
    'service_total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_agency_service_fee(uuid) FROM anon;

-- ── 2. email_queue_dispatch ─────────────────────────────────────────────
-- Mirrors push_queue_dispatch. Checks whether either email pgmq queue
-- (auth_emails / transactional_emails) has pending messages and, if so,
-- POSTs to the process-email-queue Edge Function using the vault-stored
-- service-role key. Uses an advisory lock + queue-existence guard so the
-- function self-disables the cron job when both queues are empty, matching
-- the push_queue_dispatch pattern.
CREATE OR REPLACE FUNCTION public.email_queue_dispatch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_has_messages boolean := false;
BEGIN
  -- Does either queue have messages?
  SELECT EXISTS (SELECT 1 FROM pgmq.auth_emails)
      OR EXISTS (SELECT 1 FROM pgmq.transactional_emails)
    INTO v_has_messages;

  IF NOT v_has_messages THEN
    -- Both queues empty: try to unschedule the cron to avoid idle HTTP calls,
    -- matching push_queue_dispatch's self-disabling behaviour.
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

  PERFORM net.http_post(
    url := 'https://mzbadxfvxioedzdjxamc.supabase.co/functions/v1/process-email-queue',
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

REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM anon;

-- Schedule the dispatcher every 5 seconds, matching the documented cadence
-- in migration 20260808082851_email_infra.sql (comment block, section 2).
-- Guarded so re-running the migration does not create a duplicate job.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue'
  ) THEN
    PERFORM cron.schedule('process-email-queue', '5 seconds', 'SELECT public.email_queue_dispatch()');
  END IF;
END;
$$;
