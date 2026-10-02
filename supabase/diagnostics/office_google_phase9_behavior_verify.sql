-- Phase 9 behaviour verification — Real-Time Google Notifications + Background Sync.
--
-- This one is NOT read-only: it seeds offices/profiles/operators/connections,
-- then ROLLBACKs at the end. Run it on a scratch/branch database, not
-- production. It expects the Supabase-shaped auth schema (auth.uid(),
-- auth.role(), auth.jwt()); on Supabase proper it works as-is.
--
-- Unlike office_google_phase9_deploy_verify.sql (schema shape), this exercises
-- the real RPCs to prove the pipeline invariants: idempotent event receipt,
-- redelivery-safe routing, office derivation that never trusts the payload,
-- office-scoped notification fan-out, retry/dead-letter lifecycle, and the
-- claim contract that carries the triggering event for audience-correct alerts.
--
-- Ends with a pass/fail table; every row must read ok = true.

-- Phase 9 behaviour harness (offline). Asserts the event pipeline invariants.
\set ON_ERROR_STOP on
BEGIN;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id) VALUES
  ('11111111-1111-1111-1111-111111111111'), -- admin
  ('22222222-2222-2222-2222-222222222222'), -- berlin primary
  ('33333333-3333-3333-3333-333333333333'), -- berlin side
  ('44444444-4444-4444-4444-444444444444'), -- hamburg primary
  ('55555555-5555-5555-5555-555555555555'); -- berlin ordinary member (not operator)

INSERT INTO public.profiles (id, email, full_name) VALUES
  ('11111111-1111-1111-1111-111111111111','admin@x','Admin'),
  ('22222222-2222-2222-2222-222222222222','p@x','Berlin Primary'),
  ('33333333-3333-3333-3333-333333333333','s@x','Berlin Side'),
  ('44444444-4444-4444-4444-444444444444','h@x','Hamburg Primary'),
  ('55555555-5555-5555-5555-555555555555','m@x','Berlin Member');

INSERT INTO public.user_roles (user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111','admin'),
  ('22222222-2222-2222-2222-222222222222','team_member'),
  ('33333333-3333-3333-3333-333333333333','team_member'),
  ('44444444-4444-4444-4444-444444444444','team_member'),
  ('55555555-5555-5555-5555-555555555555','team_member');

INSERT INTO public.offices (id, name_en, name_ar, slug) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','Berlin Office','مكتب برلين','berlin'),
  ('aaaaaaaa-0000-0000-0000-000000000002','Hamburg Office','مكتب هامبورغ','hamburg');

INSERT INTO public.office_members (office_id, user_id, is_active) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222', true),
  ('aaaaaaaa-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333', true),
  ('aaaaaaaa-0000-0000-0000-000000000001','55555555-5555-5555-5555-555555555555', true),
  ('aaaaaaaa-0000-0000-0000-000000000002','44444444-4444-4444-4444-444444444444', true);

INSERT INTO public.office_google_operators (office_id, team_member_id, role) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','PRIMARY'),
  ('aaaaaaaa-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','SIDE_MANAGER'),
  ('aaaaaaaa-0000-0000-0000-000000000002','44444444-4444-4444-4444-444444444444','PRIMARY');

INSERT INTO public.google_business_connections (id, google_email, google_account_id, connection_status) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001','info@darb.agency','acct-1','connected');

INSERT INTO public.office_google_profiles
  (office_id, google_account_id, google_location_id, google_location_resource_name,
   mapping_status, connection_status, google_connection_id)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','acct-1','111','accounts/acct-1/locations/111','MAPPED','connected','bbbbbbbb-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000002','acct-1','222','accounts/acct-1/locations/222','MAPPED','connected','bbbbbbbb-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- Test harness helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.role','service_role', true);
  PERFORM set_config('request.jwt.claim.sub','', true);
END $$;

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_uid uuid, p_aal text DEFAULT 'aal2') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.role','authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('aal', p_aal, 'sub', p_uid::text)::text, true);
END $$;

CREATE TEMP TABLE _t (id serial, name text, ok boolean, detail text) ON COMMIT DROP;
CREATE OR REPLACE FUNCTION pg_temp.chk(p_name text, p_ok boolean, p_detail text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO _t(name, ok, detail) VALUES (p_name, COALESCE(p_ok,false), p_detail);
$$;

SELECT pg_temp.as_service();

-- ===========================================================================
-- 1. Event receipt idempotency
-- ===========================================================================
DO $$
DECLARE r1 record; r2 record;
BEGIN
  SELECT * INTO r1 FROM public.record_google_business_event(
    'msg-1','NEW_REVIEW','acct-1','111','accounts/acct-1/locations/111/reviews/r1',
    'r1','hash-1','{"type":"NEW_REVIEW"}'::jsonb);
  PERFORM pg_temp.chk('record first message creates an event', r1.is_duplicate = false AND r1.event_id IS NOT NULL);

  SELECT * INTO r2 FROM public.record_google_business_event(
    'msg-1','NEW_REVIEW','acct-1','111','accounts/acct-1/locations/111/reviews/r1',
    'r1','hash-1','{"type":"NEW_REVIEW"}'::jsonb);
  PERFORM pg_temp.chk('redelivered message is a duplicate', r2.is_duplicate = true AND r2.event_id = r1.event_id);
END $$;

SELECT pg_temp.chk('one row for a redelivered message',
  (SELECT count(*) FROM public.google_business_events WHERE google_message_id = 'msg-1') = 1);

-- ===========================================================================
-- 2. Routing -> office derivation + job creation
-- ===========================================================================
DO $$
DECLARE v_id uuid; rr record;
BEGIN
  SELECT id INTO v_id FROM public.google_business_events WHERE google_message_id='msg-1';
  SELECT * INTO rr FROM public.route_google_business_event(v_id);
  PERFORM pg_temp.chk('NEW_REVIEW routes to the Berlin office',
    rr.routing_status = 'ROUTED' AND rr.office_id = 'aaaaaaaa-0000-0000-0000-000000000001');
  PERFORM pg_temp.chk('NEW_REVIEW queues a HIGH REVIEWS job',
    rr.sync_type = 'REVIEWS' AND rr.priority = 'HIGH' AND rr.sync_job_id IS NOT NULL);

  -- Replay must not create a second job.
  SELECT * INTO rr FROM public.route_google_business_event(v_id);
  PERFORM pg_temp.chk('re-routing is idempotent', rr.is_duplicate = true);
END $$;

SELECT pg_temp.chk('exactly one REVIEWS job for Berlin',
  (SELECT count(*) FROM public.google_business_sync_jobs
   WHERE office_id='aaaaaaaa-0000-0000-0000-000000000001' AND sync_type='REVIEWS') = 1);

-- ===========================================================================
-- 2b. Redelivery after a transient route failure must still route
--
-- The webhook persists first and routes second. If routing fails after the
-- event is stored, Pub/Sub redelivers the SAME messageId; the handler must
-- re-run the (idempotent) route rather than early-returning on "duplicate"
-- and stranding the event with no office, job, or notification.
-- ===========================================================================
DO $$
DECLARE r1 record; r2 record; rr record;
BEGIN
  PERFORM pg_temp.as_service();
  SELECT * INTO r1 FROM public.record_google_business_event(
    'msg-redeliver','NEW_REVIEW','acct-1','111','accounts/acct-1/locations/111/reviews/r5','r5');
  PERFORM pg_temp.chk('first delivery is recorded UNROUTED',
    r1.is_duplicate = false AND r1.routing_status = 'UNROUTED');

  -- Redelivery before routing completed: duplicate, still UNROUTED.
  SELECT * INTO r2 FROM public.record_google_business_event(
    'msg-redeliver','NEW_REVIEW','acct-1','111','accounts/acct-1/locations/111/reviews/r5','r5');
  PERFORM pg_temp.chk('redelivery is a duplicate that is still UNROUTED (handler re-routes)',
    r2.is_duplicate = true AND r2.routing_status = 'UNROUTED');

  SELECT * INTO rr FROM public.route_google_business_event(r1.event_id);
  PERFORM pg_temp.chk('the re-routed event reaches the Berlin office',
    rr.routing_status = 'ROUTED' AND rr.office_id='aaaaaaaa-0000-0000-0000-000000000001');
END $$;

-- ===========================================================================
-- 2c. Claim exposes the triggering event so the worker alerts the right audience
-- ===========================================================================
DO $$
DECLARE e record; c record; f record;
BEGIN
  PERFORM pg_temp.as_service();
  SELECT * INTO e FROM public.record_google_business_event(
    'msg-dup','DUPLICATE_LOCATION','acct-1','111',NULL);
  SELECT * INTO f FROM public.route_google_business_event(e.event_id);
  PERFORM pg_temp.chk('DUPLICATE_LOCATION routes to a HEALTH job', f.sync_type='HEALTH');

  SELECT * INTO c FROM public.claim_google_business_sync_job(
    'aaaaaaaa-0000-0000-0000-000000000001', ARRAY['HEALTH']);
  PERFORM pg_temp.chk('claim reports the triggering event id and type',
    c.trigger_event_id = e.event_id AND c.trigger_event_type = 'DUPLICATE_LOCATION');

  -- Leave the job terminal so later sections see the expected queue.
  PERFORM public.finish_google_business_sync_job(c.job_id, c.lock_token, 'SUCCESS', 0, NULL, NULL);
END $$;

-- ===========================================================================
-- 3. Notification fan-out: office + admin only, correct office
-- ===========================================================================
DO $$
DECLARE v_id uuid; v_n integer;
BEGIN
  SELECT id INTO v_id FROM public.google_business_events WHERE google_message_id='msg-1';
  SELECT public.notify_google_business_event(v_id,'aaaaaaaa-0000-0000-0000-000000000001',
    'NEW_REVIEW','review','r1') INTO v_n;
  PERFORM pg_temp.chk('3 recipients: 2 Berlin operators + 1 admin', v_n = 3, v_n::text);
END $$;

SELECT pg_temp.chk('Berlin primary notified',
  EXISTS (SELECT 1 FROM public.notifications WHERE user_id='22222222-2222-2222-2222-222222222222' AND google_event_type='NEW_REVIEW'));
SELECT pg_temp.chk('Berlin side notified',
  EXISTS (SELECT 1 FROM public.notifications WHERE user_id='33333333-3333-3333-3333-333333333333' AND google_event_type='NEW_REVIEW'));
SELECT pg_temp.chk('Admin notified',
  EXISTS (SELECT 1 FROM public.notifications WHERE user_id='11111111-1111-1111-1111-111111111111' AND google_event_type='NEW_REVIEW'));
SELECT pg_temp.chk('Hamburg primary NOT notified for the Berlin review',
  NOT EXISTS (SELECT 1 FROM public.notifications
              WHERE user_id='44444444-4444-4444-4444-444444444444' AND entity_id='r1'));
SELECT pg_temp.chk('Berlin ordinary member NOT notified',
  NOT EXISTS (SELECT 1 FROM public.notifications WHERE user_id='55555555-5555-5555-5555-555555555555'));
SELECT pg_temp.chk('notification carries office + entity context',
  EXISTS (SELECT 1 FROM public.notifications
          WHERE user_id='22222222-2222-2222-2222-222222222222'
            AND office_id='aaaaaaaa-0000-0000-0000-000000000001'
            AND entity_type='review' AND entity_id='r1'));

-- Duplicate notification attempt must not duplicate.
DO $$
DECLARE v_id uuid; v_n integer;
BEGIN
  SELECT id INTO v_id FROM public.google_business_events WHERE google_message_id='msg-1';
  SELECT public.notify_google_business_event(v_id,'aaaaaaaa-0000-0000-0000-000000000001',
    'NEW_REVIEW','review','r1') INTO v_n;
END $$;
SELECT pg_temp.chk('repeat notification creates no new rows',
  (SELECT count(*) FROM public.notifications WHERE google_event_type='NEW_REVIEW') = 3);

-- ===========================================================================
-- 4. Unknown location / unknown event / unknown account
-- ===========================================================================
DO $$
DECLARE e record; rr record;
BEGIN
  SELECT * INTO e FROM public.record_google_business_event('msg-unknown-loc','NEW_REVIEW','acct-1','999','accounts/acct-1/locations/999/reviews/r9');
  SELECT * INTO rr FROM public.route_google_business_event(e.event_id);
  PERFORM pg_temp.chk('unknown location is not guessed', rr.routing_status = 'UNKNOWN_LOCATION' AND rr.office_id IS NULL);

  SELECT * INTO e FROM public.record_google_business_event('msg-unknown-acct','NEW_REVIEW','acct-X','111','accounts/acct-X/locations/111/reviews/r1');
  SELECT * INTO rr FROM public.route_google_business_event(e.event_id);
  PERFORM pg_temp.chk('unknown account is rejected', rr.routing_status = 'ACCOUNT_MISMATCH', rr.routing_status);

  SELECT * INTO e FROM public.record_google_business_event('msg-newtype','SOMETHING_NEW','acct-1','111',NULL);
  SELECT * INTO rr FROM public.route_google_business_event(e.event_id);
  PERFORM pg_temp.chk('unknown event type is ignored, not a crash', rr.routing_status = 'IGNORED');
END $$;

SELECT pg_temp.chk('unknown-location event touched no office data',
  (SELECT office_id FROM public.google_business_events WHERE google_message_id='msg-unknown-loc') IS NULL);

-- ===========================================================================
-- 5. Health evaluation + change-only history
-- ===========================================================================
DO $$
DECLARE h record;
BEGIN
  SELECT * INTO h FROM public.record_google_location_health(
    'aaaaaaaa-0000-0000-0000-000000000001','111','VERIFIED',NULL,NULL,NULL,'SYNC','HEALTH_CHECK');
  PERFORM pg_temp.chk('clean state is HEALTHY', h.health_status='HEALTHY', h.health_status);

  SELECT * INTO h FROM public.record_google_location_health(
    'aaaaaaaa-0000-0000-0000-000000000001','111',NULL,'LOST',NULL,NULL,'EVENT','VOICE_OF_MERCHANT_UPDATED');
  PERFORM pg_temp.chk('VOM problem is ACTION_REQUIRED and changed', h.health_status='ACTION_REQUIRED' AND h.changed=true, h.health_status);

  SELECT * INTO h FROM public.record_google_location_health(
    'aaaaaaaa-0000-0000-0000-000000000001','111',NULL,'LOST',NULL,NULL,'EVENT','VOICE_OF_MERCHANT_UPDATED');
  PERFORM pg_temp.chk('repeating the same state records no new history', h.changed=false);
END $$;

SELECT pg_temp.chk('health history has exactly 2 transitions',
  (SELECT count(*) FROM public.google_business_health_events
   WHERE office_id='aaaaaaaa-0000-0000-0000-000000000001') = 2);

SELECT pg_temp.chk('health status is deterministic, not a score',
  public.google_health_status_from_states('VERIFIED',NULL,'SUSPENDED',NULL) = 'UNAVAILABLE');

-- ===========================================================================
-- 6. Sync job claim / finish / retry
-- ===========================================================================
DO $$
DECLARE c record; f record;
BEGIN
  SELECT * INTO c FROM public.claim_google_business_sync_job('aaaaaaaa-0000-0000-0000-000000000001', ARRAY['REVIEWS']);
  PERFORM pg_temp.chk('claim returns a token and RUNNING job', c.lock_token IS NOT NULL AND c.sync_type='REVIEWS');

  -- Wrong token cannot finalize.
  SELECT * INTO f FROM public.finish_google_business_sync_job(c.job_id,'wrong','SUCCESS');
  PERFORM pg_temp.chk('foreign token cannot finalize a job', f.finalized = false);

  -- Fail attempt 1 -> retried (PENDING) while attempts remain.
  SELECT * INTO f FROM public.finish_google_business_sync_job(c.job_id,c.lock_token,'FAILED',0,'upstream','503');
  PERFORM pg_temp.chk('transient failure re-queues the job', f.finalized = true AND f.will_retry = true);
  PERFORM pg_temp.chk('job is PENDING again after retry',
    (SELECT status FROM public.google_business_sync_jobs WHERE id=c.job_id) = 'PENDING');
END $$;

-- Exhaust attempts -> stays FAILED, and the caller is told not to retry.
DO $$
DECLARE c record; f record;
BEGIN
  -- Clear the retry backoff so the job is immediately claimable again.
  UPDATE public.google_business_sync_jobs SET scheduled_at = now()
  WHERE office_id='aaaaaaaa-0000-0000-0000-000000000001' AND sync_type='REVIEWS' AND status='PENDING';
  SELECT * INTO c FROM public.claim_google_business_sync_job('aaaaaaaa-0000-0000-0000-000000000001', ARRAY['REVIEWS']);
  UPDATE public.google_business_sync_jobs SET attempt_count = max_attempts WHERE id = c.job_id;
  SELECT * INTO f FROM public.finish_google_business_sync_job(c.job_id, c.lock_token, 'FAILED', 0, 'upstream','503');
  PERFORM pg_temp.chk('job stays FAILED once attempts are exhausted',
    (SELECT status FROM public.google_business_sync_jobs WHERE id = c.job_id) = 'FAILED');
  PERFORM pg_temp.chk('caller is told the failure is terminal (dead-letter path)',
    f.finalized = true AND f.will_retry = false);
END $$;

-- ===========================================================================
-- 7. FULL sync enqueues components; active-job uniqueness
-- ===========================================================================
DO $$
DECLARE r record; r2 record;
BEGIN
  SELECT * INTO r FROM public.create_google_business_sync_job(
    'aaaaaaaa-0000-0000-0000-000000000001','FULL','NORMAL',NULL);
  PERFORM pg_temp.chk('FULL sync created', r.job_id IS NOT NULL);

  SELECT * INTO r2 FROM public.create_google_business_sync_job(
    'aaaaaaaa-0000-0000-0000-000000000001','FULL','NORMAL',NULL);
  PERFORM pg_temp.chk('second FULL sync is deduped to the existing job', r2.is_existing = true);
END $$;

SELECT pg_temp.chk('FULL enqueued every component type',
  (SELECT count(DISTINCT sync_type) FROM public.google_business_sync_jobs
   WHERE office_id='aaaaaaaa-0000-0000-0000-000000000001') = 7);

-- ===========================================================================
-- 8. Cross-office: a Hamburg event never touches Berlin
-- ===========================================================================
DO $$
DECLARE e record; rr record; v_n integer;
BEGIN
  SELECT * INTO e FROM public.record_google_business_event('msg-hamburg','NEW_REVIEW','acct-1','222','accounts/acct-1/locations/222/reviews/r2','r2');
  SELECT * INTO rr FROM public.route_google_business_event(e.event_id);
  PERFORM pg_temp.chk('Hamburg event routes to Hamburg', rr.office_id='aaaaaaaa-0000-0000-0000-000000000002');

  SELECT public.notify_google_business_event(e.event_id, rr.office_id, 'NEW_REVIEW','review','r2') INTO v_n;
  PERFORM pg_temp.chk('Hamburg event notifies Hamburg primary + admin only', v_n = 2, v_n::text);
END $$;

SELECT pg_temp.chk('Berlin operators got no Hamburg notification',
  NOT EXISTS (SELECT 1 FROM public.notifications
              WHERE user_id IN ('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333')
                AND entity_id = 'r2'));

-- ===========================================================================
-- 9. Deactivated member / removed operator receive nothing on the next event
-- ===========================================================================
UPDATE public.profiles SET deactivated_at = now() WHERE id='33333333-3333-3333-3333-333333333333';
DO $$
DECLARE e record; rr record; v_n integer;
BEGIN
  SELECT * INTO e FROM public.record_google_business_event('msg-2','NEW_REVIEW','acct-1','111','accounts/acct-1/locations/111/reviews/r3','r3');
  SELECT * INTO rr FROM public.route_google_business_event(e.event_id);
  SELECT public.notify_google_business_event(e.event_id, rr.office_id, 'NEW_REVIEW','review','r3') INTO v_n;
  PERFORM pg_temp.chk('deactivated side manager is skipped (2 recipients)', v_n = 2, v_n::text);
END $$;

SELECT pg_temp.chk('deactivated side manager received nothing for r3',
  NOT EXISTS (SELECT 1 FROM public.notifications
              WHERE user_id='33333333-3333-3333-3333-333333333333' AND entity_id='r3'));
UPDATE public.profiles SET deactivated_at = NULL WHERE id='33333333-3333-3333-3333-333333333333';

-- ===========================================================================
-- 10. Admin-only reads
-- ===========================================================================
DO $$
DECLARE ok boolean := false;
BEGIN
  PERFORM pg_temp.as_user('22222222-2222-2222-2222-222222222222');
  BEGIN
    PERFORM * FROM public.admin_list_google_business_events(10,0,NULL,NULL);
  EXCEPTION WHEN OTHERS THEN ok := true;
  END;
  PERFORM pg_temp.chk('non-admin cannot read raw events', ok);

  ok := false;
  PERFORM pg_temp.as_user('11111111-1111-1111-1111-111111111111','aal2');
  BEGIN
    PERFORM * FROM public.admin_list_google_business_events(10,0,NULL,NULL);
  EXCEPTION WHEN OTHERS THEN ok := true;
  END;
  PERFORM pg_temp.chk('AAL2 admin can read raw events', NOT ok);

  INSERT INTO auth.mfa_factors (user_id, factor_type, status)
  VALUES ('11111111-1111-1111-1111-111111111111','totp','verified');

  ok := false;
  PERFORM pg_temp.as_user('11111111-1111-1111-1111-111111111111','aal1');
  BEGIN
    PERFORM * FROM public.admin_list_google_business_events(10,0,NULL,NULL);
  EXCEPTION WHEN OTHERS THEN ok := true;
  END;
  PERFORM pg_temp.chk('AAL1 admin cannot read raw events once MFA is enrolled', ok);

  DELETE FROM auth.mfa_factors WHERE user_id='11111111-1111-1111-1111-111111111111';
END $$;

-- ===========================================================================
-- 11. Dead-letter retry
-- ===========================================================================
DO $$
DECLARE e record; r record;
BEGIN
  PERFORM pg_temp.as_service();
  SELECT * INTO e FROM public.record_google_business_event('msg-dl','NEW_REVIEW','acct-1','111',NULL,'r4');
  PERFORM public.route_google_business_event(e.event_id);
  PERFORM public.mark_google_business_event(e.event_id,'DEAD_LETTERED','upstream','boom');

  PERFORM pg_temp.chk('dead-lettered event is visible in the dead-letter list',
    EXISTS (SELECT 1 FROM public.google_business_events WHERE id=e.event_id AND processing_status='DEAD_LETTERED'));

  PERFORM pg_temp.as_user('11111111-1111-1111-1111-111111111111','aal2');
  SELECT * INTO r FROM public.admin_retry_google_business_event(e.event_id);
  PERFORM pg_temp.chk('admin retry re-queues the event', r.processing_status='QUEUED');
END $$;

SELECT pg_temp.chk('connection dead-letter counter incremented',
  (SELECT dead_letter_count FROM public.google_business_connections
   WHERE id='bbbbbbbb-0000-0000-0000-000000000001') >= 1);

-- ===========================================================================
-- 12. Reconciliation enqueue is idempotent per active job
-- ===========================================================================
DO $$
DECLARE n1 integer; n2 integer;
BEGIN
  PERFORM pg_temp.as_service();
  SELECT public.enqueue_google_reconciliation_jobs('REVIEWS','LOW') INTO n1;
  SELECT public.enqueue_google_reconciliation_jobs('REVIEWS','LOW') INTO n2;
  PERFORM pg_temp.chk('reconciliation enqueues 2 offices then adds nothing', n1 = 2, n1::text);
END $$;

SELECT pg_temp.chk('at most one active REVIEWS job per office',
  NOT EXISTS (
    SELECT office_id FROM public.google_business_sync_jobs
    WHERE sync_type='REVIEWS' AND status IN ('PENDING','RUNNING')
    GROUP BY office_id HAVING count(*) > 1));

-- ===========================================================================
-- 12b. GOOGLE_UPDATE / NEW_CUSTOMER_MEDIA fan out at route time
-- ===========================================================================
DO $$
DECLARE e record; rr record; v_before integer;
BEGIN
  PERFORM pg_temp.as_service();

  SELECT count(*) INTO v_before FROM public.notifications
  WHERE google_event_type='GOOGLE_UPDATE' AND user_id='22222222-2222-2222-2222-222222222222';

  SELECT * INTO e FROM public.record_google_business_event(
    'msg-gupdate','GOOGLE_UPDATE','acct-1','111','accounts/acct-1/locations/111');
  SELECT * INTO rr FROM public.route_google_business_event(e.event_id);

  PERFORM pg_temp.chk('GOOGLE_UPDATE routes to Berlin profile sync',
    rr.routing_status='ROUTED' AND rr.sync_type='PROFILE');
  PERFORM pg_temp.chk('GOOGLE_UPDATE notifies the Berlin operator',
    EXISTS (SELECT 1 FROM public.notifications
      WHERE user_id='22222222-2222-2222-2222-222222222222'
        AND google_event_type='GOOGLE_UPDATE' AND office_id='aaaaaaaa-0000-0000-0000-000000000001'));
  PERFORM pg_temp.chk('GOOGLE_UPDATE notifies Admin',
    EXISTS (SELECT 1 FROM public.notifications
      WHERE user_id='11111111-1111-1111-1111-111111111111'
        AND google_event_type='GOOGLE_UPDATE'));
  PERFORM pg_temp.chk('GOOGLE_UPDATE notifies the Berlin side manager',
    EXISTS (SELECT 1 FROM public.notifications
      WHERE user_id='33333333-3333-3333-3333-333333333333'
        AND google_event_type='GOOGLE_UPDATE'));
  PERFORM pg_temp.chk('GOOGLE_UPDATE does not notify another office',
    NOT EXISTS (SELECT 1 FROM public.notifications
      WHERE user_id='44444444-4444-4444-4444-444444444444'
        AND google_event_type='GOOGLE_UPDATE'));

  SELECT * INTO e FROM public.record_google_business_event(
    'msg-media','NEW_CUSTOMER_MEDIA','acct-1','111','accounts/acct-1/locations/111/media/m1');
  PERFORM public.route_google_business_event(e.event_id);

  PERFORM pg_temp.chk('NEW_CUSTOMER_MEDIA notifies the office, not Admin-only',
    EXISTS (SELECT 1 FROM public.notifications
      WHERE user_id='22222222-2222-2222-2222-222222222222'
        AND google_event_type='NEW_CUSTOMER_MEDIA'));
END $$;

-- ===========================================================================
-- 13. Cron-safe reconciliation + worker drain guard
-- ===========================================================================
DO $$
DECLARE n1 integer;
BEGIN
  -- cron_enqueue_google_reconciliation runs as the database owner (not
  -- service_role), so it must work without auth.role() = 'service_role'.
  PERFORM set_config('request.jwt.claim.role','anon',true);
  SELECT public.cron_enqueue_google_reconciliation('MEDIA','NORMAL') INTO n1;
  PERFORM pg_temp.chk('cron enqueue works without service_role', n1 >= 1, n1::text);
END $$;

SELECT pg_temp.chk('cron enqueue is revoked from browser roles',
  has_function_privilege('authenticated','public.cron_enqueue_google_reconciliation(text,text)','EXECUTE') = false);

SELECT pg_temp.chk('worker dispatch is revoked from browser roles',
  has_function_privilege('authenticated','public.dispatch_google_business_worker()','EXECUTE') = false);

SELECT pg_temp.chk('reconciliation enqueue function is installed',
  to_regprocedure('public.cron_enqueue_google_reconciliation(text,text)') IS NOT NULL);
SELECT pg_temp.chk('worker dispatch function is installed',
  to_regprocedure('public.dispatch_google_business_worker()') IS NOT NULL);

\echo ''
\echo '--- Phase 9 behaviour results ---'
SELECT count(*) AS total, count(*) FILTER (WHERE NOT ok) AS failed FROM _t;
SELECT name, detail FROM _t WHERE NOT ok ORDER BY id;

DO $$
DECLARE v_failed integer;
BEGIN
  SELECT count(*) INTO v_failed FROM _t WHERE NOT ok;
  IF v_failed > 0 THEN
    RAISE EXCEPTION 'Phase 9 behaviour harness: % check(s) failed', v_failed;
  END IF;
  RAISE NOTICE 'Phase 9 behaviour harness: all % checks passed', (SELECT count(*) FROM _t);
END $$;

ROLLBACK;
