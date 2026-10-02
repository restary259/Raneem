-- Phase 10 behaviour harness (offline). Asserts the production-hardening
-- invariants: kill switches, stale-job recovery, integrity audit, and that
-- cached reads survive a pause.
\set ON_ERROR_STOP on
BEGIN;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id) VALUES
  ('11111111-1111-1111-1111-111111111111'), -- admin
  ('22222222-2222-2222-2222-222222222222'), -- berlin primary
  ('44444444-4444-4444-4444-444444444444'), -- hamburg primary
  ('55555555-5555-5555-5555-555555555555'); -- berlin ordinary member

INSERT INTO public.profiles (id, email, full_name) VALUES
  ('11111111-1111-1111-1111-111111111111','admin@x','Admin'),
  ('22222222-2222-2222-2222-222222222222','p@x','Berlin Primary'),
  ('44444444-4444-4444-4444-444444444444','h@x','Hamburg Primary'),
  ('55555555-5555-5555-5555-555555555555','m@x','Berlin Member');

INSERT INTO public.user_roles (user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111','admin'),
  ('22222222-2222-2222-2222-222222222222','team_member'),
  ('44444444-4444-4444-4444-444444444444','team_member'),
  ('55555555-5555-5555-5555-555555555555','team_member');

INSERT INTO public.offices (id, name_en, name_ar, slug) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','Berlin Office','مكتب برلين','berlin'),
  ('aaaaaaaa-0000-0000-0000-000000000002','Hamburg Office','مكتب هامبورغ','hamburg');

INSERT INTO public.office_members (office_id, user_id, is_active) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222', true),
  ('aaaaaaaa-0000-0000-0000-000000000001','55555555-5555-5555-5555-555555555555', true),
  ('aaaaaaaa-0000-0000-0000-000000000002','44444444-4444-4444-4444-444444444444', true);

INSERT INTO public.office_google_operators (office_id, team_member_id, role) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','PRIMARY'),
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
-- Harness helpers
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

-- ===========================================================================
-- 1. Kill-switch defaults: everything on, reads never blocked
-- ===========================================================================
SELECT pg_temp.chk('integration starts enabled',
  (SELECT bool_and(x) FROM public.get_google_business_settings(NULL) s, LATERAL (VALUES (s.global_enabled),(s.read_enabled),(s.write_enabled)) v(x)));
SELECT pg_temp.chk('unmapped office still reports enabled (no override row)',
  (SELECT global_enabled AND read_enabled AND write_enabled AND NOT office_found
   FROM public.get_google_business_settings('aaaaaaaa-0000-0000-0000-000000000001')));
SELECT pg_temp.chk('VIEW is allowed even when nothing else is configured',
  public.google_business_operation_allowed('aaaaaaaa-0000-0000-0000-000000000001','VIEW'));

-- ===========================================================================
-- 2. Global pause blocks live work but not cached reads
-- ===========================================================================
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.admin_set_google_business_settings(p_global_enabled => false, p_reason => 'test pause');
  PERFORM pg_temp.chk('admin global pause applies', r.out_global_enabled = false AND r.out_scope = 'global');
END $$;

SELECT pg_temp.chk('global pause: READ blocked', public.google_business_operation_allowed('aaaaaaaa-0000-0000-0000-000000000001','READ') = false);
SELECT pg_temp.chk('global pause: WRITE blocked', public.google_business_operation_allowed('aaaaaaaa-0000-0000-0000-000000000001','WRITE') = false);
SELECT pg_temp.chk('global pause: EVENT blocked', public.google_business_operation_allowed('aaaaaaaa-0000-0000-0000-000000000001','EVENT') = false);
SELECT pg_temp.chk('global pause: VIEW still allowed (cache readable)', public.google_business_operation_allowed('aaaaaaaa-0000-0000-0000-000000000001','VIEW') = true);
SELECT pg_temp.chk('global pause: authorizer denies a mutation',
  public.authorize_google_office_action('22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000001','GOOGLE_REPLY_REVIEW') = false);
SELECT pg_temp.as_service();
SELECT pg_temp.chk('global pause: authorizer denies a live sync even for service_role',
  public.authorize_google_office_action('22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000001','GOOGLE_SYNC_REVIEWS') = false);
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');

-- Worker must drain nothing while paused.
SELECT pg_temp.as_service();
INSERT INTO public.google_business_sync_jobs (office_id, sync_type, priority, status, scheduled_at)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001','REVIEWS','HIGH','PENDING', now() - interval '1 minute');
SELECT pg_temp.chk('claim returns no job while globally paused',
  (SELECT count(*) FROM public.claim_google_business_sync_job(NULL, ARRAY['REVIEWS'])) = 0);

-- Event routing is held (UNROUTED) rather than queueing Google work.
DO $$
DECLARE v_id uuid; rr record; rec record;
BEGIN
  SELECT * INTO rec FROM public.record_google_business_event(
    'p10-msg-paused','NEW_REVIEW','acct-1','111','accounts/acct-1/locations/111/reviews/rp1','rp1');
  v_id := rec.event_id;
  SELECT * INTO rr FROM public.route_google_business_event(v_id);
  PERFORM pg_temp.chk('paused: event held UNROUTED, no job queued',
    rr.routing_status = 'UNROUTED' AND rr.sync_job_id IS NULL);
END $$;

-- ===========================================================================
-- 3. Resume restores live work; a paused event can be retried
-- ===========================================================================
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.admin_set_google_business_settings(p_global_enabled => true, p_reason => 'resume');
  PERFORM pg_temp.chk('admin resume restores enabled', r.out_global_enabled = true);
END $$;

SELECT pg_temp.as_service();
SELECT pg_temp.chk('claim works again after resume',
  (SELECT count(*) FROM public.claim_google_business_sync_job(NULL, ARRAY['REVIEWS'])) = 1);

-- The event held during the pause is retried now that the integration is live.
DO $$
DECLARE v_id uuid; rr record;
BEGIN
  SELECT id INTO v_id FROM public.google_business_events WHERE google_message_id = 'p10-msg-paused';
  SELECT * INTO rr FROM public.route_google_business_event(v_id);
  PERFORM pg_temp.chk('held event routes to Berlin after resume',
    rr.routing_status = 'ROUTED' AND rr.office_id = 'aaaaaaaa-0000-0000-0000-000000000001');
END $$;

-- ===========================================================================
-- 4. Per-office pause is narrow
-- ===========================================================================
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.admin_set_google_business_settings(
    p_office_id => 'aaaaaaaa-0000-0000-0000-000000000002',
    p_office_enabled => false, p_reason => 'hamburg incident');
  PERFORM pg_temp.chk('office pause recorded', r.out_scope = 'office' AND r.out_office_enabled = false);
END $$;

SELECT pg_temp.chk('paused office: READ blocked',
  public.google_business_operation_allowed('aaaaaaaa-0000-0000-0000-000000000002','READ') = false);
SELECT pg_temp.chk('paused office: VIEW allowed',
  public.google_business_operation_allowed('aaaaaaaa-0000-0000-0000-000000000002','VIEW') = true);
SELECT pg_temp.chk('other office unaffected by the pause',
  public.google_business_operation_allowed('aaaaaaaa-0000-0000-0000-000000000001','READ') = true);

SELECT pg_temp.as_service();
INSERT INTO public.google_business_sync_jobs (office_id, sync_type, priority, status, scheduled_at)
VALUES ('aaaaaaaa-0000-0000-0000-000000000002','PROFILE','NORMAL','PENDING', now() - interval '1 minute');
SELECT pg_temp.chk('claim skips the paused office job',
  (SELECT count(*) FROM public.claim_google_business_sync_job('aaaaaaaa-0000-0000-0000-000000000002', ARRAY['PROFILE'])) = 0);
SELECT pg_temp.chk('claim skipping leaves the paused job PENDING (work preserved)',
  (SELECT status = 'PENDING' AND lock_token IS NULL FROM public.google_business_sync_jobs
   WHERE office_id='aaaaaaaa-0000-0000-0000-000000000002' AND sync_type='PROFILE' ORDER BY created_at DESC LIMIT 1));

-- ===========================================================================
-- 5. Write-only kill switch
-- ===========================================================================
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
DO $$
BEGIN
  PERFORM public.admin_set_google_business_settings(
    p_global_enabled => true, p_read_enabled => true, p_write_enabled => false, p_reason => 'freeze writes');
END $$;
SELECT pg_temp.chk('write freeze: READ stays up', public.google_business_operation_allowed('aaaaaaaa-0000-0000-0000-000000000001','READ') = true);
SELECT pg_temp.chk('write freeze: WRITE down', public.google_business_operation_allowed('aaaaaaaa-0000-0000-0000-000000000001','WRITE') = false);

-- Phase 10 write pre-flight: every mutation action must classify as WRITE, so
-- the frontend gate (authorize_google_office_action) refuses BEFORE Google is
-- called. A VIEW-classified write action would let a paused integration mutate.
SELECT pg_temp.chk('mutation actions classify as WRITE',
  (SELECT bool_and(public.google_business_action_kind(a) = 'WRITE')
   FROM unnest(ARRAY['GOOGLE_REPLY_REVIEW','GOOGLE_UPDATE_PROFILE','GOOGLE_UPDATE_HOURS',
                     'GOOGLE_UPDATE_ATTRIBUTES','GOOGLE_MANAGE_MEDIA','GOOGLE_MANAGE_POSTS',
                     'GOOGLE_MANAGE_CUSTOMER_MEDIA','GOOGLE_UPDATE_CATEGORY',
                     'GOOGLE_UPDATE_ADDRESS','GOOGLE_APPROVE_CHANGE_REQUEST']) a));

-- Evaluated as the Berlin primary, the actor a write pre-flight would use.
SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT pg_temp.chk('write freeze blocks the reply mutation before Google',
  public.authorize_google_office_action('22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000001','GOOGLE_REPLY_REVIEW') = false);
SELECT pg_temp.chk('write freeze blocks media upload before Google',
  public.authorize_google_office_action('22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000001','GOOGLE_MANAGE_MEDIA') = false);
SELECT pg_temp.chk('write freeze blocks post publish before Google',
  public.authorize_google_office_action('22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000001','GOOGLE_MANAGE_POSTS') = false);
SELECT pg_temp.chk('write freeze blocks profile edit before Google',
  public.authorize_google_office_action('22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000001','GOOGLE_UPDATE_PROFILE') = false);
-- The pre-flight also checks VIEW for the read-only resolution step; a VIEW that
-- a paused integration still permits must NOT be enough to pass a WRITE action.
SELECT pg_temp.chk('VIEW stays allowed while writes are frozen',
  public.authorize_google_office_action('22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000001','GOOGLE_VIEW') = true);

SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
DO $$
BEGIN
  PERFORM public.admin_set_google_business_settings(p_write_enabled => true, p_reason => 'unfreeze');
END $$;

-- ===========================================================================
-- 6. Stale-job recovery
-- ===========================================================================
SELECT pg_temp.as_service();
-- A RUNNING job whose lock is old and has attempts left -> re-queued.
INSERT INTO public.google_business_sync_jobs
  (office_id, sync_type, priority, status, scheduled_at, started_at, locked_at, lock_token, attempt_count, max_attempts, updated_at)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','MEDIA','NORMAL','RUNNING', now() - interval '2 hours',
   now() - interval '2 hours', now() - interval '2 hours', 'tok-old', 1, 3, now() - interval '2 hours'),
  -- A RUNNING job with attempts exhausted -> FAILED.
  ('aaaaaaaa-0000-0000-0000-000000000001','POSTS','NORMAL','RUNNING', now() - interval '2 hours',
   now() - interval '2 hours', now() - interval '2 hours', 'tok-old2', 3, 3, now() - interval '2 hours');

DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.recover_stale_google_sync_jobs('15 minutes');
  PERFORM pg_temp.chk('stale recovery re-queues one job', r.recovered >= 1);
  PERFORM pg_temp.chk('stale recovery fails the exhausted job', r.failed >= 1);
END $$;

SELECT pg_temp.chk('mtime: MEDIA re-queued to PENDING',
  (SELECT status = 'PENDING' AND lock_token IS NULL FROM public.google_business_sync_jobs
   WHERE office_id='aaaaaaaa-0000-0000-0000-000000000001' AND sync_type='MEDIA' ORDER BY created_at DESC LIMIT 1));
SELECT pg_temp.chk('mtime: POSTS failed as exhausted',
  (SELECT status = 'FAILED' AND last_error_code = 'STALE_LOCK_EXHAUSTED' FROM public.google_business_sync_jobs
   WHERE office_id='aaaaaaaa-0000-0000-0000-000000000001' AND sync_type='POSTS' ORDER BY created_at DESC LIMIT 1));
SELECT pg_temp.chk('stale recovery is service-role only',
  has_function_privilege('authenticated','public.recover_stale_google_sync_jobs(interval)','EXECUTE') = false);

-- ===========================================================================
-- 7. Integrity audit surfaces planted violations
--
-- The DB already BLOCKS invalid operators and cross-office reviews at write
-- time via triggers (proven below). The audit is the backstop for records that
-- predate the triggers or bypass them. We prove both:
--   a) triggers reject the bad write outright, and
--   b) the audit catches the bad row when the trigger is bypassed.
-- ===========================================================================
-- (a) triggers reject bad writes.
DO $$
DECLARE op_blocked boolean := false;
        rev_blocked boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.office_google_operators (office_id, team_member_id, role)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000002','55555555-5555-5555-5555-555555555555','SIDE_MANAGER');
  EXCEPTION WHEN OTHERS THEN op_blocked := true;
  END;
  PERFORM pg_temp.chk('DB trigger rejects an operator from another office', op_blocked);

  BEGIN
    INSERT INTO public.google_business_reviews
      (office_id, google_account_id, google_location_id, google_review_id, google_review_resource_name, star_rating)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000001','acct-1','222','rev-cross','accounts/acct-1/locations/222/reviews/rev-cross',5);
  EXCEPTION WHEN OTHERS THEN rev_blocked := true;
  END;
  PERFORM pg_temp.chk('DB trigger rejects a cross-office review', rev_blocked);
END $$;

-- (b) the audit catches rows that bypass the triggers.
ALTER TABLE public.google_business_reviews DISABLE TRIGGER USER;
INSERT INTO public.google_business_reviews
  (office_id, google_account_id, google_location_id, google_review_id, google_review_resource_name, star_rating)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001','acct-1','222','rev-cross','accounts/acct-1/locations/222/reviews/rev-cross',5);
ALTER TABLE public.google_business_reviews ENABLE TRIGGER USER;

-- Plant a stuck RUNNING job (no trigger covers this).
INSERT INTO public.google_business_sync_jobs
  (office_id, sync_type, priority, status, scheduled_at, started_at, locked_at, lock_token, attempt_count, max_attempts, updated_at)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001','HEALTH','NORMAL','RUNNING', now() - interval '3 hours',
        now() - interval '3 hours', now() - interval '3 hours', 'tok-stuck', 1, 3, now() - interval '3 hours');

SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
SELECT pg_temp.chk('audit runs for an admin',
  (SELECT count(*) FROM public.audit_google_business_integrity()) > 0);

DO $$
DECLARE v_cross integer; v_stuck integer;
BEGIN
  SELECT violation_count INTO v_cross FROM public.audit_google_business_integrity() WHERE check_key='cross_office_review_location';
  SELECT violation_count INTO v_stuck FROM public.audit_google_business_integrity() WHERE check_key='stuck_sync_jobs';
  PERFORM pg_temp.chk('audit flags the cross-office review', v_cross >= 1);
  PERFORM pg_temp.chk('audit flags the stuck sync job', v_stuck >= 1);
END $$;

-- Clean up the planted rows; the audit must return to zero.
DELETE FROM public.google_business_reviews WHERE google_review_id = 'rev-cross';
DELETE FROM public.google_business_sync_jobs WHERE sync_type = 'HEALTH' AND lock_token = 'tok-stuck';
SELECT pg_temp.chk('audit returns to zero after cleanup',
  (SELECT COALESCE(sum(violation_count),0) = 0 FROM public.audit_google_business_integrity()));

-- ===========================================================================
-- 8. Per-office readiness report
-- ===========================================================================
SELECT pg_temp.chk('office audit reports mapping ok for Berlin',
  (SELECT ok FROM public.audit_office_google_integrity('aaaaaaaa-0000-0000-0000-000000000001') WHERE item='Mapping'));
SELECT pg_temp.chk('office audit reports Primary ok for Berlin',
  (SELECT ok FROM public.audit_office_google_integrity('aaaaaaaa-0000-0000-0000-000000000001') WHERE item='Primary'));

-- ===========================================================================
-- 9. Audit tables are append-only for operators (privilege-level proof)
-- ===========================================================================
SELECT pg_temp.chk('authenticated cannot UPDATE google_business_activity',
  has_table_privilege('authenticated','public.google_business_activity','UPDATE') = false);
SELECT pg_temp.chk('authenticated cannot DELETE google_business_activity',
  has_table_privilege('authenticated','public.google_business_activity','DELETE') = false);
SELECT pg_temp.chk('authenticated cannot INSERT google_business_activity',
  has_table_privilege('authenticated','public.google_business_activity','INSERT') = false);
SELECT pg_temp.chk('anon has no access to google_business_activity',
  has_table_privilege('anon','public.google_business_activity','SELECT') = false);
SELECT pg_temp.chk('authenticated cannot write google_business_settings directly',
  has_table_privilege('authenticated','public.google_business_settings','INSERT') = false
  AND has_table_privilege('authenticated','public.google_business_settings','UPDATE') = false);

-- ===========================================================================
-- 10. Functions installed + grants
-- ===========================================================================
SELECT pg_temp.chk('integrity audit function installed',
  to_regprocedure('public.audit_google_business_integrity()') IS NOT NULL);
SELECT pg_temp.chk('office audit function installed',
  to_regprocedure('public.audit_office_google_integrity(uuid)') IS NOT NULL);
SELECT pg_temp.chk('settings getter installed',
  to_regprocedure('public.get_google_business_settings(uuid)') IS NOT NULL);
SELECT pg_temp.chk('admin settings writer revoked from anon',
  has_function_privilege('anon','public.admin_set_google_business_settings(boolean,boolean,boolean,uuid,boolean,boolean,boolean,text)','EXECUTE') = false);
SELECT pg_temp.chk('stale recovery cron wrapper installed',
  to_regprocedure('public.cron_recover_stale_google_sync_jobs()') IS NOT NULL);

\echo ''
\echo '--- Phase 10 behaviour results ---'
SELECT count(*) AS total, count(*) FILTER (WHERE NOT ok) AS failed FROM _t;
SELECT name, detail FROM _t WHERE NOT ok ORDER BY id;

DO $$
DECLARE v_failed integer;
BEGIN
  SELECT count(*) INTO v_failed FROM _t WHERE NOT ok;
  IF v_failed > 0 THEN
    RAISE EXCEPTION 'Phase 10 behaviour harness: % check(s) failed', v_failed;
  END IF;
  RAISE NOTICE 'Phase 10 behaviour harness: all % checks passed', (SELECT count(*) FROM _t);
END $$;

ROLLBACK;
