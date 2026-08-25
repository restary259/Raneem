CREATE OR REPLACE FUNCTION public.get_member_locked_rewards(p_member_id uuid)
RETURNS TABLE (
  reward_id uuid,
  amount numeric,
  case_id uuid,
  case_reference text,
  student_name text,
  reward_type text,
  created_at timestamptz,
  unlock_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can view locked rewards';
  END IF;

  RETURN QUERY
  SELECT rw.id,
         rw.amount,
         rw.case_id,
         COALESCE(rw.case_reference, c.case_reference),
         split_part(COALESCE(c.full_name, ''), ' ', 1),
         rw.reward_type,
         rw.created_at,
         COALESCE(rw.unlock_at, rw.created_at + interval '20 days')
  FROM public.rewards rw
  LEFT JOIN public.cases c ON c.id = rw.case_id
  WHERE rw.user_id = p_member_id
    AND rw.status = 'pending'
    AND COALESCE(rw.unlock_at, rw.created_at + interval '20 days') > now()
  ORDER BY COALESCE(rw.unlock_at, rw.created_at + interval '20 days');
END;
$$;

REVOKE ALL ON FUNCTION public.get_member_locked_rewards(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_locked_rewards(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_early_release_rewards(
  p_member_id uuid,
  p_reward_ids uuid[],
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_total numeric := 0;
  v_ids uuid[];
  v_names text[];
  v_request_id uuid;
BEGIN
  IF NOT has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can release payouts early';
  END IF;

  IF p_reward_ids IS NULL OR array_length(p_reward_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No rewards selected';
  END IF;

  IF COALESCE(btrim(p_note), '') = '' THEN
    RAISE EXCEPTION 'A note is required for an early release';
  END IF;

  IF NOT has_role(p_member_id, 'team_member'::app_role) THEN
    RAISE EXCEPTION 'Early release is only available for team members';
  END IF;

  -- Lock and validate: only this member's still-pending rewards are eligible.
  SELECT array_agg(rw.id), COALESCE(SUM(rw.amount), 0)
    INTO v_ids, v_total
  FROM (
    SELECT r.id, r.amount
    FROM public.rewards r
    WHERE r.id = ANY(p_reward_ids)
      AND r.user_id = p_member_id
      AND r.status = 'pending'
    FOR UPDATE
  ) rw;

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    -- Idempotent: nothing left to release (already paid / not eligible).
    RETURN jsonb_build_object('released_count', 0, 'total_amount', 0, 'payout_request_id', NULL);
  END IF;

  UPDATE public.rewards
     SET status = 'paid',
         paid_at = now(),
         unlock_at = now(),
         admin_notes = COALESCE(admin_notes, '') || ' | Early release: ' || btrim(p_note)
   WHERE id = ANY(v_ids);

  SELECT array_agg(DISTINCT split_part(COALESCE(c.full_name, ''), ' ', 1))
    INTO v_names
  FROM public.rewards r
  LEFT JOIN public.cases c ON c.id = r.case_id
  WHERE r.id = ANY(v_ids) AND COALESCE(c.full_name, '') <> '';

  INSERT INTO public.payout_requests (
    requestor_id, requestor_role, linked_reward_ids, linked_student_names,
    amount, status, requested_at, approved_at, paid_at,
    approved_by, paid_by, admin_notes
  ) VALUES (
    p_member_id, 'team_member', v_ids, COALESCE(v_names, '{}'::text[]),
    v_total, 'paid', now(), now(), now(),
    v_admin, v_admin, 'Early release: ' || btrim(p_note)
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_id, target_table, details)
  VALUES (
    v_admin,
    'team_early_payout_release',
    p_member_id,
    'rewards',
    jsonb_build_object(
      'reward_ids', to_jsonb(v_ids),
      'total_amount', v_total,
      'note', btrim(p_note),
      'payout_request_id', v_request_id
    )::text
  );

  RETURN jsonb_build_object(
    'released_count', array_length(v_ids, 1),
    'total_amount', v_total,
    'payout_request_id', v_request_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_early_release_rewards(uuid, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_early_release_rewards(uuid, uuid[], text) TO authenticated;