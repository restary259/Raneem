-- =========================================================
-- C1: revoke anonymous EXECUTE on SECURITY DEFINER functions
-- =========================================================

-- Public site needs these two (apply form + referral link validation)
-- so they intentionally keep anon access.

REVOKE ALL ON FUNCTION public.get_forgotten_cases() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_forgotten_cases() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_influencer_lead_ids(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_influencer_lead_ids(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.record_case_commission(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_case_commission(uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.log_activity(uuid, text, text, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_activity(uuid, text, text, text, uuid, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.log_user_activity(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_user_activity(text, text, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.request_payout(uuid[], numeric, text, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_payout(uuid[], numeric, text, text, text, text[]) TO authenticated, service_role;

-- has_role() and get_my_role() are evaluated inside RLS policies by the
-- calling role, including anon on public-facing tables. They must stay
-- executable by PUBLIC or anonymous reads of public tables will error.

-- =========================================================
-- H3: team members cannot reassign a case away from themselves
-- =========================================================

DROP POLICY IF EXISTS "Team can manage assigned cases" ON public.cases;
CREATE POLICY "Team can manage assigned cases"
ON public.cases
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'team_member'::app_role) AND assigned_to = auth.uid())
WITH CHECK (has_role(auth.uid(), 'team_member'::app_role) AND assigned_to = auth.uid());

-- =========================================================
-- H2: payout requests must go through request_payout()
-- =========================================================

DROP POLICY IF EXISTS "Users can insert own payout requests" ON public.payout_requests;
DROP POLICY IF EXISTS "Users can cancel own pending payout requests" ON public.payout_requests;
DROP POLICY IF EXISTS "Users can restore own rewards on cancellation" ON public.rewards;

-- Single safe cancel path: flips the request to rejected and releases the
-- linked rewards back to pending, atomically, with ownership enforced.
CREATE OR REPLACE FUNCTION public.cancel_payout_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_req RECORD;
BEGIN
  SELECT id, requestor_id, status, linked_reward_ids
  INTO v_req
  FROM public.payout_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout request not found';
  END IF;

  IF v_req.requestor_id <> auth.uid() THEN
    RAISE EXCEPTION 'This payout request does not belong to you';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending payout requests can be cancelled';
  END IF;

  UPDATE public.payout_requests
  SET status = 'rejected',
      reject_reason = 'Cancelled by user'
  WHERE id = p_request_id;

  IF v_req.linked_reward_ids IS NOT NULL AND array_length(v_req.linked_reward_ids, 1) > 0 THEN
    UPDATE public.rewards
    SET status = 'pending',
        payout_requested_at = NULL
    WHERE id = ANY(v_req.linked_reward_ids)
      AND user_id = auth.uid()
      AND status = 'approved';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_payout_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_payout_request(uuid) TO authenticated, service_role;

-- =========================================================
-- H5: case_payments / case_service_snapshots had RLS on, zero policies
-- =========================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_payments TO authenticated;
GRANT ALL ON public.case_payments TO service_role;

CREATE POLICY "Admins can manage case payments"
ON public.case_payments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can view payments for assigned cases"
ON public.case_payments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_payments.case_id AND c.assigned_to = auth.uid()
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_service_snapshots TO authenticated;
GRANT ALL ON public.case_service_snapshots TO service_role;

CREATE POLICY "Admins can manage case service snapshots"
ON public.case_service_snapshots
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can view snapshots for assigned cases"
ON public.case_service_snapshots
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_service_snapshots.case_id AND c.assigned_to = auth.uid()
  )
);

-- =========================================================
-- M8: only the partner actually linked to the case gets a commission
-- =========================================================

CREATE OR REPLACE FUNCTION public.record_case_commission(p_case_id uuid, p_total_payment_ils integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_case              RECORD;
  v_t_comm            integer := 0;
  v_total_partner     integer := 0;
  v_admin_remainder   integer := 0;
  v_override          RECORD;
  v_global_team_rate  integer := 100;
  v_partner_id        uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM cases WHERE id = p_case_id AND commission_split_done = true
  ) THEN
    RETURN;
  END IF;

  SELECT id, assigned_to, source, partner_id, referred_by
  INTO v_case
  FROM cases WHERE id = p_case_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(team_member_commission_rate, 100)
  INTO v_global_team_rate
  FROM platform_settings LIMIT 1;

  -- Team member commission
  IF v_case.assigned_to IS NOT NULL THEN
    SELECT COALESCE(commission_amount, v_global_team_rate)
    INTO v_t_comm
    FROM team_member_commission_overrides
    WHERE team_member_id = v_case.assigned_to;
    IF NOT FOUND THEN v_t_comm := v_global_team_rate; END IF;

    IF v_t_comm > 0 THEN
      INSERT INTO rewards (user_id, amount, status, admin_notes)
      VALUES (
        v_case.assigned_to, v_t_comm, 'pending',
        'Team commission from case ' || p_case_id::text
      );
    END IF;
  END IF;

  -- Partner commission: ONLY the partner actually linked to this case.
  v_partner_id := COALESCE(v_case.partner_id, v_case.referred_by);

  IF v_partner_id IS NOT NULL THEN
    SELECT partner_id, commission_amount, show_all_cases
    INTO v_override
    FROM partner_commission_overrides
    WHERE partner_id = v_partner_id;

    IF FOUND AND v_override.commission_amount > 0 THEN
      IF (
        v_override.show_all_cases = true
        OR (v_override.show_all_cases = false AND v_case.source IN (
              'apply_page', 'contact_form', 'submit_new_student', 'manual'
            ))
        OR (v_override.show_all_cases IS NULL AND v_case.source = 'referral')
      ) THEN
        INSERT INTO rewards (user_id, amount, status, admin_notes)
        VALUES (
          v_partner_id,
          v_override.commission_amount,
          'pending',
          'Partner commission from case ' || p_case_id::text
        );

        v_total_partner := v_override.commission_amount;
      END IF;
    END IF;
  END IF;

  v_admin_remainder := GREATEST(0, p_total_payment_ils - v_t_comm - v_total_partner);

  UPDATE cases SET
    platform_revenue_ils  = v_admin_remainder,
    commission_split_done = true
  WHERE id = p_case_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_case_commission(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_case_commission(uuid, integer) TO service_role;