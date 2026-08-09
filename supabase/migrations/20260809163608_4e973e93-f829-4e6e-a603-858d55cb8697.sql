-- ============ PHASE A: commission snapshot ============
ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS recipient_role text,
  ADD COLUMN IF NOT EXISTS case_reference text,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS rate_used numeric,
  ADD COLUMN IF NOT EXISTS base_amount numeric,
  ADD COLUMN IF NOT EXISTS rate_source text,
  ADD COLUMN IF NOT EXISTS unlock_at timestamptz,
  ADD COLUMN IF NOT EXISTS commission_reference text,
  ADD COLUMN IF NOT EXISTS created_by_event text;

CREATE SEQUENCE IF NOT EXISTS public.commission_reference_seq;

CREATE OR REPLACE FUNCTION public.assign_commission_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.commission_reference IS NULL THEN
    NEW.commission_reference := 'COM-'
      || to_char(COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Jerusalem', 'YYYY')
      || '-' || LPAD(nextval('public.commission_reference_seq')::text, 6, '0');
  END IF;
  IF NEW.unlock_at IS NULL THEN
    NEW.unlock_at := COALESCE(NEW.created_at, now()) + interval '20 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_commission_reference ON public.rewards;
CREATE TRIGGER trg_assign_commission_reference
BEFORE INSERT ON public.rewards
FOR EACH ROW EXECUTE FUNCTION public.assign_commission_reference();

-- Backfill legacy rows (never rewrite history with today's rates)
UPDATE public.rewards r
SET unlock_at = COALESCE(r.unlock_at, r.created_at + interval '20 days'),
    rate_source = COALESCE(r.rate_source, 'legacy_backfill'),
    base_amount = COALESCE(r.base_amount, r.amount),
    rate_used = COALESCE(r.rate_used, r.amount),
    case_reference = COALESCE(r.case_reference, c.case_reference)
FROM public.cases c
WHERE c.id = r.case_id AND (r.unlock_at IS NULL OR r.rate_source IS NULL);

UPDATE public.rewards
SET unlock_at = COALESCE(unlock_at, created_at + interval '20 days'),
    rate_source = COALESCE(rate_source, 'legacy_backfill'),
    base_amount = COALESCE(base_amount, amount),
    rate_used = COALESCE(rate_used, amount)
WHERE unlock_at IS NULL OR rate_source IS NULL;

UPDATE public.rewards
SET commission_reference = 'COM-' || to_char(created_at AT TIME ZONE 'Asia/Jerusalem', 'YYYY')
    || '-' || LPAD(nextval('public.commission_reference_seq')::text, 6, '0')
WHERE commission_reference IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rewards_case_recipient_type_unique
  ON public.rewards (case_id, user_id, reward_type)
  WHERE case_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rewards_commission_reference_unique
  ON public.rewards (commission_reference);

CREATE INDEX IF NOT EXISTS idx_rewards_unlock_at ON public.rewards (unlock_at);

-- ============ PHASE A/B: authoritative commission engine ============
CREATE OR REPLACE FUNCTION public.record_case_commission(p_case_id uuid, p_total_payment_ils integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_case              RECORD;
  v_t_comm            integer := 0;
  v_t_source          text := 'platform_settings';
  v_pool              integer := 0;
  v_partner_comm      integer := 0;
  v_master_share      integer := 0;
  v_override          integer := 0;
  v_override_source   text := 'platform_settings';
  v_master            uuid;
  v_split             RECORD;
  v_admin_remainder   integer := 0;
  v_global_team_rate  integer := 100;
  v_partner_source    text := 'platform_settings';
  v_created           integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('case_commission:' || p_case_id::text));

  SELECT id, assigned_to, source, partner_id, status, case_reference, commission_split_done
  INTO v_case
  FROM cases WHERE id = p_case_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_case.commission_split_done THEN RETURN; END IF;

  -- Authoritative event: the case must have reached the paid-enrollment milestone
  -- (student's money reached the language school and admin finished enrollment).
  IF v_case.status IS DISTINCT FROM 'enrollment_paid' THEN
    RAISE EXCEPTION 'Commission can only be recorded once the case reaches enrollment_paid (current: %)', v_case.status;
  END IF;

  SELECT COALESCE(team_member_commission_rate, 100)
  INTO v_global_team_rate
  FROM platform_settings LIMIT 1;

  -- Team commission: goes to the team member the case is assigned to at enrollment.
  IF v_case.assigned_to IS NOT NULL THEN
    SELECT commission_amount INTO v_t_comm
    FROM team_member_commission_overrides
    WHERE team_member_id = v_case.assigned_to;

    IF v_t_comm IS NULL THEN
      v_t_comm := v_global_team_rate;
      v_t_source := 'platform_settings';
    ELSE
      v_t_source := 'team_override';
    END IF;

    IF v_t_comm > 0 THEN
      INSERT INTO rewards (user_id, amount, status, case_id, reward_type, admin_notes,
                           recipient_role, case_reference, rate_used, base_amount, rate_source,
                           unlock_at, created_by_event)
      VALUES (
        v_case.assigned_to, v_t_comm, 'pending', p_case_id, 'team',
        'Team commission from case ' || COALESCE(v_case.case_reference, p_case_id::text),
        'team_member', v_case.case_reference, v_t_comm, p_total_payment_ils, v_t_source,
        now() + interval '20 days', 'case_enrollment_paid'
      ) ON CONFLICT (case_id, user_id, reward_type) DO NOTHING;
      GET DIAGNOSTICS v_created = ROW_COUNT;
    END IF;
  END IF;

  IF v_case.partner_id IS NOT NULL THEN
    SELECT * INTO v_split FROM public.get_effective_partner_split(v_case.partner_id);
    v_pool         := COALESCE(v_split.pool_amount, 0);
    v_partner_comm := COALESCE(v_split.partner_amount, 0);
    v_master_share := COALESCE(v_split.master_share, 0);
    v_master       := v_split.master_partner_id;

    IF EXISTS (SELECT 1 FROM partner_commission_overrides WHERE partner_id = v_case.partner_id) THEN
      v_partner_source := 'partner_override';
    END IF;
    IF v_split.offer_id IS NOT NULL THEN
      v_partner_source := 'negotiated_offer';
    END IF;

    IF v_partner_comm > 0 THEN
      INSERT INTO rewards (user_id, amount, status, case_id, reward_type, admin_notes,
                           recipient_role, case_reference, rate_used, base_amount, rate_source,
                           unlock_at, created_by_event)
      VALUES (
        v_case.partner_id, v_partner_comm, 'pending', p_case_id, 'referral',
        'Partner commission from case ' || COALESCE(v_case.case_reference, p_case_id::text),
        'partner', v_case.case_reference, v_partner_comm, v_pool, v_partner_source,
        now() + interval '20 days', 'case_enrollment_paid'
      ) ON CONFLICT (case_id, user_id, reward_type) DO NOTHING;
    END IF;

    IF v_master IS NOT NULL AND v_master <> v_case.partner_id THEN
      IF v_master_share > 0 THEN
        INSERT INTO rewards (user_id, amount, status, case_id, reward_type, source_user_id, admin_notes,
                             recipient_role, case_reference, rate_used, base_amount, rate_source,
                             unlock_at, created_by_event)
        VALUES (
          v_master, v_master_share, 'pending', p_case_id, 'network_split', v_case.partner_id,
          'Negotiated network split from case ' || COALESCE(v_case.case_reference, p_case_id::text),
          'master_partner', v_case.case_reference, v_master_share, v_pool, 'negotiated_offer',
          now() + interval '20 days', 'case_enrollment_paid'
        ) ON CONFLICT (case_id, user_id, reward_type) DO NOTHING;
      END IF;

      SELECT master_override_amount INTO v_override
      FROM partner_commission_overrides
      WHERE partner_id = v_master;

      IF v_override IS NULL THEN
        SELECT COALESCE(master_partner_override_rate, 0) INTO v_override
        FROM platform_settings LIMIT 1;
        v_override_source := 'platform_settings';
      ELSE
        v_override_source := 'partner_override';
      END IF;

      IF v_override > 0 THEN
        INSERT INTO rewards (user_id, amount, status, case_id, reward_type, source_user_id, admin_notes,
                             recipient_role, case_reference, rate_used, base_amount, rate_source,
                             unlock_at, created_by_event)
        VALUES (
          v_master, v_override, 'pending', p_case_id, 'master_override', v_case.partner_id,
          'Network override from case ' || COALESCE(v_case.case_reference, p_case_id::text),
          'master_partner', v_case.case_reference, v_override, p_total_payment_ils, v_override_source,
          now() + interval '20 days', 'case_enrollment_paid'
        ) ON CONFLICT (case_id, user_id, reward_type) DO NOTHING;
      END IF;
    END IF;
  END IF;

  v_admin_remainder := GREATEST(
    0,
    p_total_payment_ils - v_t_comm - v_pool - COALESCE(v_override, 0)
  );

  UPDATE cases SET
    platform_revenue_ils  = v_admin_remainder,
    commission_split_done = true
  WHERE id = p_case_id;

  PERFORM public.log_case_event(
    p_case_id,
    'commission_recorded',
    jsonb_build_object(
      'base_amount', p_total_payment_ils,
      'team_amount', v_t_comm,
      'partner_pool', v_pool,
      'partner_amount', v_partner_comm,
      'master_share', v_master_share,
      'master_override', COALESCE(v_override, 0),
      'platform_revenue', v_admin_remainder,
      'unlock_at', (now() + interval '20 days')
    ),
    true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_case_commission(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_case_commission(uuid, integer) TO service_role;

-- ============ PHASE C: locks and balances ============
CREATE OR REPLACE FUNCTION public.get_my_payout_preview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT jsonb_build_object(
    'eligible_amount', COALESCE(SUM(r.amount) FILTER (WHERE r.eligible), 0),
    'eligible_count',  COUNT(*) FILTER (WHERE r.eligible),
    'locked_amount',   COALESCE(SUM(r.amount) FILTER (WHERE NOT r.eligible), 0),
    'locked_count',    COUNT(*) FILTER (WHERE NOT r.eligible),
    'next_unlock_at',  MIN(r.unlock_at) FILTER (WHERE NOT r.eligible),
    'has_open_request', EXISTS (
        SELECT 1 FROM public.payout_requests pr
        WHERE pr.requestor_id = v_me AND pr.status = 'pending'
    ),
    'cases', COALESCE(jsonb_agg(
        jsonb_build_object(
          'reward_id', r.id,
          'commission_reference', r.commission_reference,
          'case_id', r.case_id,
          'case_reference', r.case_reference,
          'student_name', r.student_name,
          'amount', r.amount,
          'unlock_at', r.unlock_at
        ) ORDER BY r.unlock_at
      ) FILTER (WHERE r.eligible), '[]'::jsonb)
  )
  INTO v_result
  FROM (
    SELECT rw.id,
           rw.amount,
           rw.case_id,
           rw.commission_reference,
           COALESCE(rw.case_reference, c.case_reference) AS case_reference,
           split_part(COALESCE(c.full_name, ''), ' ', 1) AS student_name,
           COALESCE(rw.unlock_at, rw.created_at + interval '20 days') AS unlock_at,
           (COALESCE(rw.unlock_at, rw.created_at + interval '20 days') <= now()) AS eligible
    FROM public.rewards rw
    LEFT JOIN public.cases c ON c.id = rw.case_id
    WHERE rw.user_id = v_me
      AND rw.status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM public.payout_requests pr
        WHERE pr.status <> 'rejected' AND pr.linked_reward_ids && ARRAY[rw.id]
      )
  ) r;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_earnings_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_out jsonb;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  WITH base AS (
    SELECT rw.id,
           rw.amount,
           rw.status,
           rw.reward_type,
           rw.recipient_role,
           rw.rate_used,
           rw.base_amount,
           rw.rate_source,
           rw.commission_reference,
           rw.created_at,
           rw.case_id,
           COALESCE(rw.case_reference, c.case_reference) AS case_reference,
           split_part(COALESCE(c.full_name, ''), ' ', 1)  AS student_name,
           COALESCE(rw.unlock_at, rw.created_at + interval '20 days') AS unlock_at,
           EXISTS (
             SELECT 1 FROM public.payout_requests pr
             WHERE pr.status IN ('pending','approved') AND pr.linked_reward_ids && ARRAY[rw.id]
           ) AS in_open_request
    FROM public.rewards rw
    LEFT JOIN public.cases c ON c.id = rw.case_id
    WHERE rw.user_id = v_me
  ),
  classified AS (
    SELECT b.*,
      CASE
        WHEN b.status = 'paid' THEN 'paid'
        WHEN b.in_open_request OR b.status = 'approved' THEN 'requested'
        WHEN b.status = 'pending' AND b.unlock_at > now() THEN 'locked'
        WHEN b.status = 'pending' THEN 'available'
        ELSE 'other'
      END AS bucket
    FROM base b
  )
  SELECT jsonb_build_object(
    'total',     COALESCE(SUM(amount) FILTER (WHERE bucket <> 'other'), 0),
    'locked',    COALESCE(SUM(amount) FILTER (WHERE bucket = 'locked'), 0),
    'available', COALESCE(SUM(amount) FILTER (WHERE bucket = 'available'), 0),
    'requested', COALESCE(SUM(amount) FILTER (WHERE bucket = 'requested'), 0),
    'paid',      COALESCE(SUM(amount) FILTER (WHERE bucket = 'paid'), 0),
    'next_unlock_at', MIN(unlock_at) FILTER (WHERE bucket = 'locked'),
    'has_open_request', EXISTS (
      SELECT 1 FROM public.payout_requests pr
      WHERE pr.requestor_id = v_me AND pr.status = 'pending'
    ),
    'items', COALESCE(jsonb_agg(jsonb_build_object(
        'reward_id', id,
        'commission_reference', commission_reference,
        'case_id', case_id,
        'case_reference', case_reference,
        'student_name', student_name,
        'reward_type', reward_type,
        'recipient_role', recipient_role,
        'rate_used', rate_used,
        'base_amount', base_amount,
        'rate_source', rate_source,
        'amount', amount,
        'status', bucket,
        'created_at', created_at,
        'unlock_at', unlock_at
      ) ORDER BY created_at DESC), '[]'::jsonb)
  )
  INTO v_out
  FROM classified;

  RETURN COALESCE(v_out, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_earnings_summary() TO authenticated;

-- ============ PHASE D: payouts ============
CREATE OR REPLACE FUNCTION public.request_payout(p_reward_ids uuid[], p_amount numeric, p_notes text DEFAULT NULL::text, p_payment_method text DEFAULT NULL::text, p_requestor_role text DEFAULT 'influencer'::text, p_student_names text[] DEFAULT '{}'::text[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_not_owned_count integer;
  v_not_pending_count integer;
  v_locked_count integer;
  v_already_requested_count integer;
  v_amount numeric;
  v_new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_reward_ids IS NULL OR array_length(p_reward_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No rewards selected';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('payout_request:' || auth.uid()::text));

  SELECT COUNT(*) INTO v_not_owned_count
  FROM rewards WHERE id = ANY(p_reward_ids) AND user_id != auth.uid();
  IF v_not_owned_count > 0 THEN
    RAISE EXCEPTION 'One or more rewards do not belong to you';
  END IF;

  SELECT COUNT(*) INTO v_not_pending_count
  FROM rewards WHERE id = ANY(p_reward_ids) AND status != 'pending';
  IF v_not_pending_count > 0 THEN
    RAISE EXCEPTION 'One or more rewards are not in pending status';
  END IF;

  SELECT COUNT(*) INTO v_locked_count
  FROM rewards
  WHERE id = ANY(p_reward_ids)
    AND COALESCE(unlock_at, created_at + interval '20 days') > now();
  IF v_locked_count > 0 THEN
    RAISE EXCEPTION 'One or more rewards are still within the 20-day lock period. Please wait before requesting payout.';
  END IF;

  SELECT COUNT(*) INTO v_already_requested_count
  FROM payout_requests
  WHERE status NOT IN ('rejected') AND linked_reward_ids && p_reward_ids;
  IF v_already_requested_count > 0 THEN
    RAISE EXCEPTION 'One or more rewards are already included in a pending payout request';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_amount
  FROM rewards WHERE id = ANY(p_reward_ids);

  INSERT INTO payout_requests (
    requestor_id, requestor_role, linked_reward_ids, linked_student_names,
    amount, status, payment_method, admin_notes
  )
  VALUES (
    auth.uid(), p_requestor_role, p_reward_ids, COALESCE(p_student_names, '{}'::text[]),
    v_amount, 'pending', COALESCE(p_payment_method, 'bank_transfer'), left(COALESCE(p_notes, ''), 1000)
  )
  RETURNING id INTO v_new_id;

  UPDATE rewards SET payout_requested_at = now() WHERE id = ANY(p_reward_ids);

  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_payout_via_chat(p_notes text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_role text;
  v_thread uuid;
  v_admin uuid;
  v_ids uuid[];
  v_names text[];
  v_amount numeric := 0;
  v_request uuid;
  v_reference text;
  v_message uuid;
  v_body text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT (public.has_role(v_me, 'social_media_partner'::app_role)
          OR public.has_role(v_me, 'ambassador'::app_role)
          OR public.has_role(v_me, 'team_member'::app_role)) THEN
    RAISE EXCEPTION 'Only partners and team members can request a payout here';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('payout_request:' || v_me::text));

  IF EXISTS (SELECT 1 FROM public.payout_requests
             WHERE requestor_id = v_me AND status = 'pending') THEN
    RAISE EXCEPTION 'You already have a payout request awaiting review';
  END IF;

  SELECT array_agg(rw.id ORDER BY rw.created_at),
         array_agg(COALESCE(split_part(c.full_name, ' ', 1), 'Student') ORDER BY rw.created_at),
         COALESCE(SUM(rw.amount), 0)
  INTO v_ids, v_names, v_amount
  FROM public.rewards rw
  LEFT JOIN public.cases c ON c.id = rw.case_id
  WHERE rw.user_id = v_me
    AND rw.status = 'pending'
    AND COALESCE(rw.unlock_at, rw.created_at + interval '20 days') <= now()
    AND NOT EXISTS (
      SELECT 1 FROM public.payout_requests pr
      WHERE pr.status <> 'rejected' AND pr.linked_reward_ids && ARRAY[rw.id]
    );

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'You have no earnings that have cleared the 20-day hold yet';
  END IF;

  SELECT role::text INTO v_role FROM public.user_roles WHERE user_id = v_me LIMIT 1;

  SELECT dtp.thread_id INTO v_thread
  FROM public.direct_thread_participants dtp
  JOIN public.direct_thread_participants other
    ON other.thread_id = dtp.thread_id AND other.user_id <> dtp.user_id
  WHERE dtp.user_id = v_me
    AND public.has_role(other.user_id, 'admin'::app_role)
  ORDER BY dtp.thread_id
  LIMIT 1;

  IF v_thread IS NULL THEN
    SELECT ur.user_id INTO v_admin
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'admin' AND p.deleted_at IS NULL
    ORDER BY p.created_at
    LIMIT 1;

    IF v_admin IS NULL THEN RAISE EXCEPTION 'No administrator is available right now'; END IF;
    v_thread := public.start_direct_thread(v_admin);
  END IF;

  INSERT INTO public.payout_requests (
    requestor_id, requestor_role, linked_reward_ids, linked_student_names,
    amount, status, payment_method, admin_notes, thread_id
  )
  VALUES (
    v_me,
    COALESCE(v_role, 'social_media_partner'),
    v_ids,
    v_names,
    v_amount,
    'pending',
    'bank_transfer',
    left(COALESCE(p_notes, ''), 1000),
    v_thread
  )
  RETURNING id, payout_reference INTO v_request, v_reference;

  UPDATE public.rewards
  SET payout_requested_at = now()
  WHERE id = ANY(v_ids);

  v_body := 'Payout request ' || COALESCE(v_reference, '') || ' — ' || round(v_amount)::text
            || ' ILS for ' || array_length(v_ids, 1)::text || ' case(s).';

  v_message := public.send_direct_message(v_thread, v_body, '[]'::jsonb, '{}'::uuid[]);

  UPDATE public.direct_messages
  SET kind = 'payout_request', payout_request_id = v_request, request_status = 'pending'
  WHERE id = v_message;

  RETURN jsonb_build_object(
    'request_id', v_request,
    'payout_reference', v_reference,
    'thread_id', v_thread,
    'message_id', v_message,
    'amount', v_amount,
    'cases', array_length(v_ids, 1)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_payout_batch(p_payout_request_id uuid, p_payment_method text DEFAULT 'bank_transfer'::text, p_transaction_ref text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_req RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT id, requestor_id, status, linked_reward_ids, amount
  INTO v_req
  FROM public.payout_requests
  WHERE id = p_payout_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout request not found';
  END IF;

  -- Idempotent: a repeat confirmation is a no-op, not a second payment.
  IF v_req.status = 'paid' THEN
    RETURN;
  END IF;

  IF v_req.status NOT IN ('approved', 'pending') THEN
    RAISE EXCEPTION 'Payout request cannot be confirmed (status: %)', v_req.status;
  END IF;

  UPDATE public.payout_requests
  SET status = 'paid',
      paid_by = auth.uid(),
      paid_at = NOW(),
      payment_method = COALESCE(p_payment_method, payment_method),
      transaction_ref = p_transaction_ref,
      admin_notes = COALESCE(p_notes, admin_notes)
  WHERE id = p_payout_request_id;

  IF v_req.linked_reward_ids IS NOT NULL AND array_length(v_req.linked_reward_ids, 1) > 0 THEN
    UPDATE public.rewards
    SET status = 'paid',
        paid_at = NOW()
    WHERE id = ANY(v_req.linked_reward_ids)
      AND status IN ('approved', 'pending');
  END IF;

  INSERT INTO public.transaction_log (
    type, payout_request_id, amount, approved_by, payment_method, transaction_ref, notes
  )
  VALUES (
    'payout', p_payout_request_id, v_req.amount, auth.uid(),
    p_payment_method, p_transaction_ref, COALESCE(p_notes, 'Admin confirmed payout')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_respond_payout_request(p_request_id uuid, p_action text, p_note text DEFAULT NULL::text, p_transaction_ref text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_req public.payout_requests%ROWTYPE;
  v_body text;
BEGIN
  IF NOT public.has_role(v_me, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_req FROM public.payout_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payout request not found'; END IF;

  IF p_action = 'approve' THEN
    IF v_req.status = 'approved' THEN RETURN; END IF;
    IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Only a pending request can be approved'; END IF;
    UPDATE public.payout_requests
    SET status = 'approved', approved_by = v_me, approved_at = now(),
        admin_notes = COALESCE(p_note, admin_notes)
    WHERE id = p_request_id;
    UPDATE public.rewards SET status = 'approved'
    WHERE id = ANY(v_req.linked_reward_ids) AND status = 'pending';
    v_body := 'Payout request approved — ' || round(v_req.amount)::text || ' ILS.';

  ELSIF p_action = 'pay' THEN
    IF v_req.status = 'paid' THEN RETURN; END IF;
    IF v_req.status NOT IN ('pending', 'approved') THEN
      RAISE EXCEPTION 'This request cannot be paid (status: %)', v_req.status;
    END IF;
    PERFORM public.confirm_payout_batch(p_request_id, COALESCE(v_req.payment_method, 'bank_transfer'), p_transaction_ref, p_note);
    v_body := 'Payout paid — ' || round(v_req.amount)::text || ' ILS.';

  ELSIF p_action = 'reject' THEN
    IF v_req.status = 'rejected' THEN RETURN; END IF;
    IF v_req.status = 'paid' THEN RAISE EXCEPTION 'A paid request cannot be rejected'; END IF;
    UPDATE public.payout_requests
    SET status = 'rejected', reject_reason = left(COALESCE(p_note, 'No reason given'), 1000)
    WHERE id = p_request_id;
    UPDATE public.rewards
    SET status = 'pending', payout_requested_at = NULL
    WHERE id = ANY(v_req.linked_reward_ids) AND status IN ('pending', 'approved');
    v_body := 'Payout request rejected — ' || left(COALESCE(p_note, 'No reason given'), 300);

  ELSE
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;

  IF v_req.thread_id IS NOT NULL THEN
    PERFORM public.send_direct_message(v_req.thread_id, v_body, '[]'::jsonb, '{}'::uuid[]);
    UPDATE public.direct_messages
    SET request_status = CASE WHEN p_action = 'pay' THEN 'paid'
                              WHEN p_action = 'approve' THEN 'approved'
                              ELSE 'rejected' END
    WHERE payout_request_id = p_request_id AND kind = 'payout_request';
  END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_id, target_table, details)
  VALUES (v_me, 'payout_' || p_action, p_request_id::text, 'payout_requests', v_body);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_payout_request_detail(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_req public.payout_requests%ROWTYPE;
  v_out jsonb;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_req FROM public.payout_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payout request not found'; END IF;

  IF NOT (public.has_role(v_me, 'admin'::app_role) OR v_req.requestor_id = v_me) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT jsonb_build_object(
    'id', v_req.id,
    'payout_reference', v_req.payout_reference,
    'partner_id', v_req.requestor_id,
    'partner_name', (SELECT full_name FROM public.profiles WHERE id = v_req.requestor_id),
    'partner_role', v_req.requestor_role,
    'amount', v_req.amount,
    'status', v_req.status,
    'requested_at', v_req.requested_at,
    'approved_at', v_req.approved_at,
    'paid_at', v_req.paid_at,
    'paid_by_name', (SELECT full_name FROM public.profiles WHERE id = v_req.paid_by),
    'payment_method', v_req.payment_method,
    'transaction_ref', v_req.transaction_ref,
    'reject_reason', v_req.reject_reason,
    'thread_id', v_req.thread_id,
    'cases', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'reward_id', rw.id,
        'commission_reference', rw.commission_reference,
        'reward_status', rw.status,
        'reward_type', rw.reward_type,
        'recipient_role', rw.recipient_role,
        'rate_used', rw.rate_used,
        'base_amount', rw.base_amount,
        'rate_source', rw.rate_source,
        'amount', rw.amount,
        'eligible_at', COALESCE(rw.unlock_at, rw.created_at + interval '20 days'),
        'case_id', rw.case_id,
        'case_reference', COALESCE(rw.case_reference, c.case_reference),
        'case_status', c.status,
        'student_name', CASE WHEN public.has_role(v_me, 'admin'::app_role)
                             THEN c.full_name
                             ELSE split_part(COALESCE(c.full_name, ''), ' ', 1) END
      ) ORDER BY rw.created_at)
      FROM public.rewards rw
      LEFT JOIN public.cases c ON c.id = rw.case_id
      WHERE rw.id = ANY(v_req.linked_reward_ids)
    ), '[]'::jsonb)
  ) INTO v_out;

  RETURN v_out;
END;
$$;