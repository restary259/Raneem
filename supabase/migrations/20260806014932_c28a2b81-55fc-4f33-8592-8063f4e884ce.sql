ALTER TABLE public.payout_requests
  DROP CONSTRAINT IF EXISTS payout_requests_requestor_id_fkey;

ALTER TABLE public.payout_requests
  ADD CONSTRAINT payout_requests_requestor_id_fkey
  FOREIGN KEY (requestor_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.create_payout_batch(p_reward_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_total numeric;
  v_names text[];
  v_new_id uuid;
  v_not_pending_count integer;
  v_already_requested_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT COUNT(*) INTO v_not_pending_count
  FROM public.rewards
  WHERE id = ANY(p_reward_ids)
    AND status != 'pending';

  IF v_not_pending_count > 0 THEN
    RAISE EXCEPTION 'One or more rewards are not in pending status';
  END IF;

  SELECT COUNT(*) INTO v_already_requested_count
  FROM public.payout_requests
  WHERE status NOT IN ('rejected')
    AND linked_reward_ids && p_reward_ids;

  IF v_already_requested_count > 0 THEN
    RAISE EXCEPTION 'One or more rewards are already in a payout request';
  END IF;

  IF (SELECT COUNT(DISTINCT user_id) FROM public.rewards WHERE id = ANY(p_reward_ids)) > 1 THEN
    RAISE EXCEPTION 'Rewards in a single payout request must belong to one user';
  END IF;

  SELECT user_id, COALESCE(SUM(amount), 0), COALESCE(array_agg(DISTINCT split_part(admin_notes, ' from case ', 1)), '{}')
  INTO v_user_id, v_total, v_names
  FROM public.rewards
  WHERE id = ANY(p_reward_ids);

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No valid rewards found';
  END IF;

  INSERT INTO public.payout_requests (
    requestor_id,
    requestor_role,
    linked_reward_ids,
    linked_student_names,
    amount,
    status,
    admin_notes,
    payment_method
  )
  VALUES (
    v_user_id,
    'partner',
    p_reward_ids,
    v_names,
    v_total,
    'approved',
    'Batch created by admin',
    'bank_transfer'
  )
  RETURNING id INTO v_new_id;

  UPDATE public.rewards
  SET status = 'approved',
      payout_requested_at = NOW()
  WHERE id = ANY(p_reward_ids);

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_payout_batch(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_payout_batch(uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.confirm_payout_batch(
  p_payout_request_id uuid,
  p_payment_method text DEFAULT 'bank_transfer',
  p_transaction_ref text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

  IF v_req.status = 'paid' THEN
    RAISE EXCEPTION 'This payout request is already paid';
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
    type,
    payout_request_id,
    amount,
    approved_by,
    payment_method,
    transaction_ref,
    notes
  )
  VALUES (
    'payout',
    p_payout_request_id,
    v_req.amount,
    auth.uid(),
    p_payment_method,
    p_transaction_ref,
    COALESCE(p_notes, 'Admin confirmed payout')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_payout_batch(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payout_batch(uuid, text, text, text) TO authenticated, service_role;