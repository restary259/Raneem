CREATE OR REPLACE FUNCTION public.list_payout_requests()
RETURNS TABLE(
  id uuid,
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

CREATE OR REPLACE FUNCTION public.delete_chat_message(p_message_id uuid, p_kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_found integer := 0;
BEGIN
  IF NOT public.has_role(v_me, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_kind = 'case' THEN
    UPDATE public.case_messages SET deleted_at = now()
    WHERE id = p_message_id AND deleted_at IS NULL;
    GET DIAGNOSTICS v_found = ROW_COUNT;
  ELSIF p_kind = 'direct' THEN
    UPDATE public.direct_messages SET deleted_at = now()
    WHERE id = p_message_id AND deleted_at IS NULL;
    GET DIAGNOSTICS v_found = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'Unknown thread kind %', p_kind;
  END IF;

  IF v_found = 0 THEN RETURN; END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_id, target_table, details)
  VALUES (v_me, 'chat_message_deleted', p_message_id::text,
          CASE WHEN p_kind = 'case' THEN 'case_messages' ELSE 'direct_messages' END,
          'Message soft-deleted by admin');
END;
$$;

REVOKE ALL ON FUNCTION public.delete_chat_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_chat_message(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_case_thread(p_case_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_count integer := 0;
BEGIN
  IF NOT public.has_role(v_me, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.case_messages SET deleted_at = now()
  WHERE case_id = p_case_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.admin_audit_log (admin_id, action, target_id, target_table, details)
  VALUES (v_me, 'case_thread_cleared', p_case_id::text, 'case_messages',
          v_count::text || ' messages soft-deleted by admin');

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_case_thread(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_case_thread(uuid) TO authenticated;