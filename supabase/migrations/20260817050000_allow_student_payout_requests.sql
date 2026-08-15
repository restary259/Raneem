-- Allow students to request payouts via the chatbox, mirroring partners,
-- ambassadors, agents and team members. Students earn `student_referral`
-- rewards (margin-funded, D3) that clear the same 20-day hold; this unlocks
-- the same `request_payout_via_chat` path so those requests land in the
-- admin Payouts → Students directory.
--
-- Recreated from the live definition (20260814140100) with the `student`
-- role added to the eligibility check; otherwise byte-for-byte identical.

CREATE OR REPLACE FUNCTION public.request_payout_via_chat(p_notes text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
          OR public.has_role(v_me, 'team_member'::app_role)
          OR public.has_role(v_me, 'agent'::app_role)
          OR public.has_role(v_me, 'student'::app_role)) THEN
    RAISE EXCEPTION 'Only partners, agents, team members and students can request a payout here';
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

REVOKE ALL ON FUNCTION public.request_payout_via_chat(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_payout_via_chat(text) TO authenticated;
