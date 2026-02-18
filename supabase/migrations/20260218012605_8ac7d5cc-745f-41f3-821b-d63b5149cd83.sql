
-- ============================================================
-- PHASE 6 MIGRATION 2: request_payout RPC + source_id audit trigger
-- ============================================================

-- 1. Server-side validated payout request function
-- Validates: ownership, pending status, 20-day lock, no duplicate active request
CREATE OR REPLACE FUNCTION public.request_payout(
  p_reward_ids uuid[],
  p_amount numeric,
  p_notes text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_requestor_role text DEFAULT 'influencer',
  p_student_names text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_not_owned_count integer;
  v_not_pending_count integer;
  v_locked_count integer;
  v_already_requested_count integer;
  v_new_id uuid;
BEGIN
  -- 1. All rewards must belong to the caller
  SELECT COUNT(*) INTO v_not_owned_count
  FROM rewards
  WHERE id = ANY(p_reward_ids)
    AND user_id != auth.uid();

  IF v_not_owned_count > 0 THEN
    RAISE EXCEPTION 'One or more rewards do not belong to you';
  END IF;

  -- 2. All rewards must be in pending status
  SELECT COUNT(*) INTO v_not_pending_count
  FROM rewards
  WHERE id = ANY(p_reward_ids)
    AND status != 'pending';

  IF v_not_pending_count > 0 THEN
    RAISE EXCEPTION 'One or more rewards are not in pending status';
  END IF;

  -- 3. 20-day lock: rewards must be at least 20 days old
  SELECT COUNT(*) INTO v_locked_count
  FROM rewards
  WHERE id = ANY(p_reward_ids)
    AND (NOW() - created_at) < INTERVAL '20 days';

  IF v_locked_count > 0 THEN
    RAISE EXCEPTION 'One or more rewards are still within the 20-day lock period. Please wait before requesting payout.';
  END IF;

  -- 4. No reward already in an active (non-rejected) payout request
  SELECT COUNT(*) INTO v_already_requested_count
  FROM payout_requests
  WHERE status NOT IN ('rejected')
    AND linked_reward_ids && p_reward_ids;

  IF v_already_requested_count > 0 THEN
    RAISE EXCEPTION 'One or more rewards are already included in a pending payout request';
  END IF;

  -- 5. Insert the payout request atomically
  INSERT INTO payout_requests (
    requestor_id,
    requestor_role,
    linked_reward_ids,
    linked_student_names,
    amount,
    admin_notes,
    payment_method
  )
  VALUES (
    auth.uid(),
    p_requestor_role,
    p_reward_ids,
    p_student_names,
    p_amount,
    p_notes,
    p_payment_method
  )
  RETURNING id INTO v_new_id;

  -- 6. Mark rewards as approved so they cannot be re-requested
  UPDATE rewards
  SET status = 'approved',
      payout_requested_at = NOW()
  WHERE id = ANY(p_reward_ids);

  RETURN v_new_id;
END;
$$;

-- 2. Trigger to audit any change to leads.source_id by admins
CREATE OR REPLACE FUNCTION public.audit_lead_source_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only log if source_id actually changed
  IF NEW.source_id IS DISTINCT FROM OLD.source_id THEN
    INSERT INTO public.admin_audit_log (
      admin_id,
      action,
      target_id,
      target_table,
      details
    )
    VALUES (
      auth.uid(),
      'LEAD_SOURCE_CHANGED',
      NEW.id::text,
      'leads',
      'source_id changed from ' || COALESCE(OLD.source_id::text, 'NULL')
        || ' to ' || COALESCE(NEW.source_id::text, 'NULL')
        || ' | source_type: ' || COALESCE(NEW.source_type, 'NULL')
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Attach audit trigger to leads table (drop first to avoid duplicate)
DROP TRIGGER IF EXISTS trg_audit_source_id_change ON public.leads;
CREATE TRIGGER trg_audit_source_id_change
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_lead_source_change();
