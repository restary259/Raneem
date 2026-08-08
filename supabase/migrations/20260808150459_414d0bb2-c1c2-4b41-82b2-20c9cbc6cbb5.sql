-- ── Human-readable payout reference ────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.payout_reference_seq;

ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS payout_reference text;

CREATE OR REPLACE FUNCTION public.assign_payout_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.payout_reference IS NULL THEN
    NEW.payout_reference := 'PAY-'
      || to_char(COALESCE(NEW.requested_at, now()) AT TIME ZONE 'Asia/Jerusalem', 'YYYY')
      || '-' || LPAD(nextval('public.payout_reference_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_payout_reference ON public.payout_requests;
CREATE TRIGGER trg_assign_payout_reference
  BEFORE INSERT ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.assign_payout_reference();

WITH ordered AS (
  SELECT id, requested_at, row_number() OVER (ORDER BY requested_at, id) AS rn
  FROM public.payout_requests
  WHERE payout_reference IS NULL
)
UPDATE public.payout_requests pr
SET payout_reference = 'PAY-'
  || to_char(COALESCE(o.requested_at, now()) AT TIME ZONE 'Asia/Jerusalem', 'YYYY')
  || '-' || LPAD(o.rn::text, 6, '0')
FROM ordered o
WHERE pr.id = o.id;

SELECT setval('public.payout_reference_seq',
              GREATEST((SELECT count(*) FROM public.payout_requests), 1));

CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_requests_reference
  ON public.payout_requests (payout_reference);

CREATE INDEX IF NOT EXISTS idx_cases_reference_lower
  ON public.cases (lower(case_reference) text_pattern_ops);

-- ── Expose the reference through the payout RPCs ───────────────────────
DROP FUNCTION IF EXISTS public.list_payout_requests();
CREATE FUNCTION public.list_payout_requests()
RETURNS TABLE(
  id uuid,
  payout_reference text,
  requestor_id uuid,
  requestor_name text,
  requestor_email text,
  requestor_role text,
  amount numeric,
  status text,
  linked_student_names text[],
  linked_reward_ids uuid[],
  case_ids uuid[],
  case_references text[],
  payment_method text,
  transaction_ref text,
  admin_notes text,
  reject_reason text,
  thread_id uuid,
  requested_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT pr.id,
         pr.payout_reference,
         pr.requestor_id,
         p.full_name,
         p.email,
         pr.requestor_role,
         pr.amount,
         pr.status,
         pr.linked_student_names,
         pr.linked_reward_ids,
         COALESCE(rc.case_ids, '{}'::uuid[]),
         COALESCE(rc.case_refs, '{}'::text[]),
         pr.payment_method,
         pr.transaction_ref,
         pr.admin_notes,
         pr.reject_reason,
         pr.thread_id,
         pr.requested_at,
         pr.approved_at,
         pr.paid_at
  FROM public.payout_requests pr
  LEFT JOIN public.profiles p ON p.id = pr.requestor_id
  LEFT JOIN LATERAL (
    SELECT array_agg(DISTINCT c.id) AS case_ids,
           array_agg(DISTINCT c.case_reference) FILTER (WHERE c.case_reference IS NOT NULL) AS case_refs
    FROM public.rewards rw
    JOIN public.cases c ON c.id = rw.case_id
    WHERE rw.id = ANY(pr.linked_reward_ids)
  ) rc ON true
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY pr.requested_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_payout_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_payout_requests() TO authenticated;

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

-- The chat message a payout request posts now carries its reference.
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
  v_reference text;
  v_message uuid;
  v_body text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT (public.has_role(v_me, 'social_media_partner'::app_role)
          OR public.has_role(v_me, 'ambassador'::app_role)) THEN
    RAISE EXCEPTION 'Only partners can request a payout here';
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
    AND rw.created_at <= now() - interval '20 days'
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