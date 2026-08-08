-- 1. Link payout requests to the chat thread/message that raised them
ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES public.direct_threads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS message_id uuid;

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS payout_request_id uuid REFERENCES public.payout_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payout_requests_thread ON public.payout_requests(thread_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_payout ON public.direct_messages(payout_request_id);

-- Idempotency: one open request per requestor at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_payout_per_requestor
  ON public.payout_requests(requestor_id)
  WHERE status = 'pending';

-- 2. What the caller could request right now (server-computed)
CREATE OR REPLACE FUNCTION public.get_my_payout_preview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
           c.case_reference,
           split_part(COALESCE(c.full_name, ''), ' ', 1) AS student_name,
           rw.created_at + interval '20 days' AS unlock_at,
           (rw.created_at <= now() - interval '20 days') AS eligible
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

-- 3. Partner raises a payout request from the chat.
--    Nothing is taken from the client: amount, rewards, cases and the thread
--    are all derived from the authenticated caller's own records.
CREATE OR REPLACE FUNCTION public.request_payout_via_chat(p_notes text DEFAULT NULL)
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
  v_message uuid;
  v_body text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT (public.has_role(v_me, 'social_media_partner'::app_role)
          OR public.has_role(v_me, 'ambassador'::app_role)) THEN
    RAISE EXCEPTION 'Only partners can request a payout here';
  END IF;

  -- Serialize concurrent / double-clicked requests from the same partner.
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
    AND rw.created_at <= now() - interval '20 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.payout_requests pr
      WHERE pr.status <> 'rejected' AND pr.linked_reward_ids && ARRAY[rw.id]
    );

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'You have no earnings that have cleared the 20-day hold yet';
  END IF;

  SELECT role::text INTO v_role FROM public.user_roles WHERE user_id = v_me LIMIT 1;

  -- The conversation is resolved server-side: an existing admin thread, or a new one.
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
  RETURNING id INTO v_request;

  UPDATE public.rewards
  SET payout_requested_at = now()
  WHERE id = ANY(v_ids);

  v_body := 'Payout request — ' || round(v_amount)::text || ' ILS for '
            || array_length(v_ids, 1)::text || ' case(s).';

  v_message := public.send_direct_message(v_thread, v_body, '[]'::jsonb, '{}'::uuid[]);

  UPDATE public.direct_messages
  SET kind = 'payout_request', payout_request_id = v_request, request_status = 'pending'
  WHERE id = v_message;

  UPDATE public.payout_requests SET message_id = v_message WHERE id = v_request;

  RETURN jsonb_build_object(
    'request_id', v_request,
    'thread_id', v_thread,
    'message_id', v_message,
    'amount', v_amount,
    'case_count', array_length(v_ids, 1)
  );
END;
$$;

-- 4. Full detail behind a request: admin, or the partner who raised it.
CREATE OR REPLACE FUNCTION public.get_payout_request_detail(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
        'reward_status', rw.status,
        'amount', rw.amount,
        'eligible_at', rw.created_at + interval '20 days',
        'case_id', rw.case_id,
        'case_reference', c.case_reference,
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

-- 5. Admin acts on the request and the outcome is posted back into the chat.
CREATE OR REPLACE FUNCTION public.admin_respond_payout_request(
  p_request_id uuid,
  p_action text,
  p_note text DEFAULT NULL,
  p_transaction_ref text DEFAULT NULL
)
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
    IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Only a pending request can be approved'; END IF;
    UPDATE public.payout_requests
    SET status = 'approved', approved_by = v_me, approved_at = now(),
        admin_notes = COALESCE(p_note, admin_notes)
    WHERE id = p_request_id;
    UPDATE public.rewards SET status = 'approved'
    WHERE id = ANY(v_req.linked_reward_ids) AND status = 'pending';
    v_body := 'Payout request approved — ' || round(v_req.amount)::text || ' ILS.';

  ELSIF p_action = 'pay' THEN
    IF v_req.status = 'paid' THEN RAISE EXCEPTION 'This payout request is already paid'; END IF;
    IF v_req.status NOT IN ('pending', 'approved') THEN
      RAISE EXCEPTION 'This request cannot be paid (status: %)', v_req.status;
    END IF;
    PERFORM public.confirm_payout_batch(p_request_id, COALESCE(v_req.payment_method, 'bank_transfer'), p_transaction_ref, p_note);
    v_body := 'Payout paid — ' || round(v_req.amount)::text || ' ILS.';

  ELSIF p_action = 'reject' THEN
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

GRANT EXECUTE ON FUNCTION public.get_my_payout_preview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_payout_via_chat(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payout_request_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_respond_payout_request(uuid, text, text, text) TO authenticated;