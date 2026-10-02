This one is not read-only — it seeds offices/profiles/operators, then ROLLBACKs at the end. Run it on a scratch/branch database, not production. It also expects the Supabase-shaped auth schema (auth.uid(), auth.role(), auth.jwt()); on Supabase proper it works as-is.

-- Behavioural checks for the Phase 6 authorization fixes.
--
-- Unlike office_google_phase6_deploy_verify.sql (which inspects schema shape),
-- this script exercises real RPC calls to prove the security properties hold:
-- cross-office actors are rejected, high-risk fields require an admin, a
-- remapped office cancels a stale change request, and RLS hides change requests
-- from non-operators.
--
-- Requires the harness schema (roles, auth.users shim, offices/profiles) — see
-- the Phase 6 migration set. Ends with a pass/fail table.
BEGIN;

CREATE TEMP TABLE _beh (name text, ok boolean, detail text);

-- Seed ---------------------------------------------------------------------
DO $$
DECLARE
  v_berlin uuid := '11111111-1111-1111-1111-111111111111';
  v_hamburg uuid := '22222222-2222-2222-2222-222222222222';
  v_admin uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_primary uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  v_side uuid := 'aaaaaaaa-0000-0000-0000-000000000003';
  v_member uuid := 'aaaaaaaa-0000-0000-0000-000000000004';
  v_outsider uuid := 'aaaaaaaa-0000-0000-0000-000000000005';
BEGIN
  INSERT INTO public.offices (id, name) VALUES (v_berlin, 'Berlin'), (v_hamburg, 'Hamburg');
  INSERT INTO public.profiles (id, full_name) VALUES
    (v_admin,'Admin'),(v_primary,'Primary'),(v_side,'Side'),(v_member,'Member'),(v_outsider,'Outsider');
  INSERT INTO auth.users (id, email) VALUES
    (v_admin,'admin@darb'),(v_primary,'primary@darb'),(v_side,'side@darb'),
    (v_member,'member@darb'),(v_outsider,'outsider@darb');
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_admin,'admin'),(v_primary,'team_member'),(v_side,'team_member'),
    (v_member,'team_member'),(v_outsider,'team_member');
  INSERT INTO public.office_members (office_id, user_id, is_active) VALUES
    (v_berlin, v_primary, true),(v_berlin, v_side, true),(v_berlin, v_member, true),
    (v_hamburg, v_outsider, true);
  INSERT INTO public.office_google_operators (office_id, team_member_id, role) VALUES
    (v_berlin, v_primary, 'PRIMARY'),(v_berlin, v_side, 'SIDE_MANAGER');
  INSERT INTO public.office_google_profiles (office_id, google_location_id, google_account_id, profile_version)
    VALUES (v_berlin, 'loc-BERLIN', 'acc-1', 1);
END $$;

-- A. Cross-actor authorization on the server-only apply RPC -----------------
DO $$
DECLARE
  v_berlin uuid := '11111111-1111-1111-1111-111111111111';
  v_admin uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_primary uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  v_member uuid := 'aaaaaaaa-0000-0000-0000-000000000004';
  v_outsider uuid := 'aaaaaaaa-0000-0000-0000-000000000005';
  r record;
BEGIN
  PERFORM set_config('request.jwt.claim.role','service_role',false);

  -- Non-operator office member cannot publish.
  BEGIN
    PERFORM * FROM public.admin_apply_google_profile_update(
      v_berlin, '{"phone_primary":"+49 30 000001"}'::jsonb, NULL, NULL, 200, v_member);
    INSERT INTO _beh VALUES ('member cannot publish', false, 'no exception raised');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _beh VALUES ('member cannot publish', true, 'Forbidden');
  END;

  -- Cross-office user cannot publish.
  BEGIN
    PERFORM * FROM public.admin_apply_google_profile_update(
      v_berlin, '{"phone_primary":"+49 30 000002"}'::jsonb, NULL, NULL, 200, v_outsider);
    INSERT INTO _beh VALUES ('cross-office user cannot publish', false, 'no exception raised');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _beh VALUES ('cross-office user cannot publish', true, 'Forbidden');
  END;

  -- Primary may publish a low-risk field.
  SELECT * INTO r FROM public.admin_apply_google_profile_update(
    v_berlin, '{"phone_primary":"+49 30 111111"}'::jsonb, NULL, 'k-primary-1', 200, v_primary);
  INSERT INTO _beh VALUES ('primary can publish a low-risk field', r.ok, r.status);

  -- Primary may NOT publish a high-risk field.
  BEGIN
    PERFORM * FROM public.admin_apply_google_profile_update(
      v_berlin, '{"primary_category":"Cafe"}'::jsonb, NULL, NULL, 200, v_primary);
    INSERT INTO _beh VALUES ('primary cannot publish high-risk', false, 'no exception raised');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _beh VALUES ('primary cannot publish high-risk', true, 'Forbidden');
  END;

  -- Admin may publish a high-risk field.
  SELECT * INTO r FROM public.admin_apply_google_profile_update(
    v_berlin, '{"primary_category":"Cafe"}'::jsonb, NULL, 'k-admin-1', 200, v_admin);
  INSERT INTO _beh VALUES ('admin can publish high-risk', r.ok, r.status);
END $$;

-- B. A coordinate-only Google change advances the version -------------------
DO $$
DECLARE
  v_berlin uuid := '11111111-1111-1111-1111-111111111111';
  v_admin uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_before integer;
  r record;
BEGIN
  PERFORM set_config('request.jwt.claim.role','service_role',false);
  SELECT profile_version INTO v_before FROM public.office_google_profiles WHERE office_id = v_berlin;

  SELECT * INTO r FROM public.admin_sync_google_profile(
    v_berlin, '{"latitude":52.52,"longitude":13.405}'::jsonb, true, v_admin);

  INSERT INTO _beh VALUES ('coordinate-only sync is not "unchanged"',
    r.status <> 'unchanged', r.status);
  INSERT INTO _beh VALUES ('coordinate-only sync advances the version',
    r.profile_version > v_before, 'v' || v_before || ' -> v' || r.profile_version);
END $$;

-- C. A change request bound to a remapped location is cancelled -------------
DO $$
DECLARE
  v_berlin uuid := '11111111-1111-1111-1111-111111111111';
  v_admin uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_primary uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  v_req uuid;
  v_status text;
  v_decided text;
BEGIN
  -- A remap is a mapping operation: perform it as the service-role connector.
  PERFORM set_config('request.jwt.claim.role','service_role',false);
  PERFORM set_config('request.jwt.claim.sub','',false);

  SELECT id INTO v_req FROM public.google_profile_change_requests
   WHERE office_id = v_berlin AND field = 'PRIMARY_CATEGORY' AND status = 'PENDING' LIMIT 1;

  IF v_req IS NULL THEN
    INSERT INTO public.google_profile_change_requests
      (office_id, google_location_id, field, requested_value, requested_by, requested_by_role, status)
    VALUES (v_berlin, 'loc-BERLIN', 'PRIMARY_CATEGORY', '{"primary_category":"Bakery"}',
            v_primary, 'PRIMARY', 'PENDING')
    RETURNING id INTO v_req;
  END IF;

  UPDATE public.office_google_profiles SET google_location_id = 'loc-BERLIN-NEW'
   WHERE office_id = v_berlin;

  -- The decision itself is an Admin action: simulate an AAL2 admin session.
  PERFORM set_config('request.jwt.claim.role','authenticated',false);
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, false);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('aal','aal2')::text, false);

  SELECT r.status INTO v_decided
    FROM public.decide_google_profile_change_request(v_berlin, v_req, 'APPROVED', NULL) r;
  INSERT INTO _beh VALUES ('stale request is not approved', v_decided = 'CANCELLED', v_decided);

  SELECT status INTO v_status FROM public.google_profile_change_requests WHERE id = v_req;
  INSERT INTO _beh VALUES ('stale request is cancelled', v_status = 'CANCELLED', v_status);

  -- Restore for later checks (service-role again).
  PERFORM set_config('request.jwt.claim.role','service_role',false);
  PERFORM set_config('request.jwt.claim.sub','',false);
  UPDATE public.office_google_profiles SET google_location_id = 'loc-BERLIN'
   WHERE office_id = v_berlin;
END $$;

-- D. RLS: only operators of the office can read change requests -------------
DO $$
DECLARE
  v_berlin uuid := '11111111-1111-1111-1111-111111111111';
  v_primary uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  v_side uuid := 'aaaaaaaa-0000-0000-0000-000000000003';
  v_member uuid := 'aaaaaaaa-0000-0000-0000-000000000004';
  v_outsider uuid := 'aaaaaaaa-0000-0000-0000-000000000005';
  v_admin uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  n_member integer; n_outsider integer; n_primary integer; n_side integer; n_admin integer;
BEGIN
  INSERT INTO public.google_profile_change_requests
    (office_id, google_location_id, field, requested_value, requested_by, requested_by_role, status)
  VALUES (v_berlin, 'loc-BERLIN', 'ADDRESS', '{"city":"Berlin"}', v_primary, 'PRIMARY', 'PENDING');

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.role','authenticated',true);

  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  SELECT count(*) INTO n_member FROM public.google_profile_change_requests WHERE office_id = v_berlin;

  PERFORM set_config('request.jwt.claim.sub', v_outsider::text, true);
  SELECT count(*) INTO n_outsider FROM public.google_profile_change_requests WHERE office_id = v_berlin;

  PERFORM set_config('request.jwt.claim.sub', v_primary::text, true);
  SELECT count(*) INTO n_primary FROM public.google_profile_change_requests WHERE office_id = v_berlin;

  PERFORM set_config('request.jwt.claim.sub', v_side::text, true);
  SELECT count(*) INTO n_side FROM public.google_profile_change_requests WHERE office_id = v_berlin;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('aal','aal2')::text, true);
  SELECT count(*) INTO n_admin FROM public.google_profile_change_requests WHERE office_id = v_berlin;

  RESET ROLE;

  INSERT INTO _beh VALUES
    ('RLS: ordinary member reads no change requests', n_member = 0, n_member::text),
    ('RLS: cross-office member reads no change requests', n_outsider = 0, n_outsider::text),
    ('RLS: primary reads change requests', n_primary > 0, n_primary::text),
    ('RLS: side manager reads change requests', n_side > 0, n_side::text),
    ('RLS: admin session reads change requests', n_admin > 0, n_admin::text);
END $$;

-- E. Server-only RPCs re-check the actor's office and role ------------------
DO $$
DECLARE
  v_berlin uuid := '11111111-1111-1111-1111-111111111111';
  v_primary uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  v_outsider uuid := 'aaaaaaaa-0000-0000-0000-000000000005';
  v_admin uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_req uuid;
BEGIN
  PERFORM set_config('request.jwt.claim.role','service_role',false);

  BEGIN
    PERFORM public.admin_mark_google_profile_sync_error(v_berlin, 'boom', 'x', v_outsider);
    INSERT INTO _beh VALUES ('mark-error rejects foreign actor', false, 'no exception');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _beh VALUES ('mark-error rejects foreign actor', true, 'Forbidden');
  END;

  BEGIN
    PERFORM public.admin_mark_google_profile_sync_error(v_berlin, 'boom', 'x', v_primary);
    INSERT INTO _beh VALUES ('mark-error allows office operator', true, 'ok');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _beh VALUES ('mark-error allows office operator', false, SQLERRM);
  END;

  INSERT INTO public.google_profile_change_requests
    (office_id, google_location_id, field, requested_value, requested_by, requested_by_role, status)
  VALUES (v_berlin, 'loc-BERLIN', 'ADDRESS', '{"city":"Berlin"}', v_primary, 'PRIMARY', 'APPROVED')
  RETURNING id INTO v_req;

  BEGIN
    PERFORM public.admin_finalize_google_change_request(v_berlin, v_req, true, NULL, NULL, v_primary);
    INSERT INTO _beh VALUES ('finalize rejects non-admin actor', false, 'no exception');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _beh VALUES ('finalize rejects non-admin actor', true, 'Forbidden');
  END;

  BEGIN
    PERFORM public.admin_finalize_google_change_request(v_berlin, v_req, true, NULL, NULL, v_admin);
    INSERT INTO _beh VALUES ('finalize allows admin actor', true, 'ok');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _beh VALUES ('finalize allows admin actor', false, SQLERRM);
  END;
END $$;

SELECT name, ok, detail FROM _beh ORDER BY name;
SELECT count(*) FILTER (WHERE ok) AS passed, count(*) AS total,
       CASE WHEN count(*) FILTER (WHERE NOT ok) = 0 THEN 'ALL BEHAVIOUR CHECKS PASSED'
            ELSE 'FAILURES ABOVE' END AS summary
FROM _beh;

ROLLBACK;
How to run and what to expect
Apply the migration (SQL editor or psql). Watch for cannot change return type — you should not see it now; if you do, you're applying an older copy.
Run deploy verifier → expect one result set ending 123 | 123 | 0 | ALL CHECKS PASSED.
Run behaviour verifier on a non-production database → expect 18 | 18 | ALL BEHAVIOUR CHECKS PASSED.
Both were confirmed on postgres:17 for a fresh apply and for the old-revision-then-new upgrade path. Files are committed on branch phase-6-google-profile-management (356c456) — I did not push or open a PR, since that wasn't requested.

One thing to flag for your review: the migration grants submit_google_profile_change_request, list_google_profile_change_requests and decide_google_profile_change_request to authenticated, which is correct — each re-checks the office/role server-side. The four admin_* RPCs are service_role-only. If your connector calls them with the admin's browser session rather than the service role, that path will now raise Forbidden; it must use the service-role client (the TS call sites already pass p_actor_user_id).
