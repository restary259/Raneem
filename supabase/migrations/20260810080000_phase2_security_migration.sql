-- Phase 2: Security migration (v2 plan step 1).
--
-- Re-scan of the live migrations found that C1 (the named functions), H3 (cases
-- WITH CHECK) and the H2 self-service reward/status policies were ALREADY fixed
-- in migration 20260806001221. This migration addresses the gaps that remain:
--
-- C1 (remaining): six SECURITY DEFINER functions that are API-exposed (present
--   in the generated Functions list, hence RPC-callable) still rely on the
--   Postgres default EXECUTE-on-PUBLIC and can be invoked by anon. REVOKE
--   them from PUBLIC/anon and GRANT to authenticated/service_role only.
--   (Trigger-only functions that cannot be RPC'd are also REVOKEd for hygiene.)
--
-- H5: case_payments and case_service_snapshots have RLS enabled with zero
--   policies (all prior policies were dropped and never replaced). Direct
--   client access is fully blocked. case_payments is read by useCasePayments
--   (currently returns empty silently) — add case-scoped read + admin/team
--   write policies. case_service_snapshots is only touched by the service-role
--   selective-delete Edge Function → leave server-only (no client policies).
--
-- H2 (remaining): payout_requests has RLS enabled with zero policies. The
--   partner earnings page reads its own requests directly (currently broken).
--   Add a self-read SELECT policy. Admin writes already go through the
--   admin_respond_payout_request RPC (SECURITY DEFINER) per usePayoutActions.
--   The "Users can insert own rewards" policy is now dead (no client inserts
--   rewards — all via record_case_commission RPC); tighten to admin-only.
--
-- All statements are idempotent (IF NOT EXISTS / CREATE OR REPLACE). No data
-- is modified. This reduces access, never increases it beyond what each role
-- already legitimately needs.

-- ════════════════════════════════════════════════════════════════════════
-- C1: REVOKE EXECUTE FROM anon/PUBLIC on remaining SECURITY DEFINER functions
-- ════════════════════════════════════════════════════════════════════════
-- Postgres grants EXECUTE to PUBLIC by default. SECURITY DEFINER functions
-- that don't have an explicit REVOKE are therefore anon-callable. The six
-- API-exposed functions below are RPC-callable by anon today.

-- get_effective_partner_split(p_partner_id uuid) -> jsonb
REVOKE ALL ON FUNCTION public.get_effective_partner_split(p_partner_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_effective_partner_split(p_partner_id uuid) TO authenticated, service_role;

-- get_my_earnings_summary() -> jsonb  (uses auth.uid() internally; safe to
-- restrict to authenticated)
REVOKE ALL ON FUNCTION public.get_my_earnings_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_earnings_summary() TO authenticated, service_role;

-- issue_case_invoice(p_case_id uuid) -> jsonb  (creates an invoice)
REVOKE ALL ON FUNCTION public.issue_case_invoice(p_case_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_case_invoice(p_case_id uuid) TO authenticated, service_role;

-- mark_invoice_email(p_invoice_id uuid, p_status text, p_error text DEFAULT NULL)
REVOKE ALL ON FUNCTION public.mark_invoice_email(p_invoice_id uuid, p_status text, p_error text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_invoice_email(p_invoice_id uuid, p_status text, p_error text) TO authenticated, service_role;

-- partner_base_pool(p_partner_id uuid) -> TABLE
REVOKE ALL ON FUNCTION public.partner_base_pool(p_partner_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_base_pool(p_partner_id uuid) TO authenticated, service_role;

-- submit_case_for_review(p_case_id uuid) -> jsonb
REVOKE ALL ON FUNCTION public.submit_case_for_review(p_case_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_case_for_review(p_case_id uuid) TO authenticated, service_role;

-- Trigger-only SECURITY DEFINER functions (not RPC-callable, but REVOKE for
-- hygiene — defence in depth in case a future signature change exposes them).
REVOKE ALL ON FUNCTION public.audit_lead_source_change() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auto_split_payment() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_case_stage_transition() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_submission_school_consistency() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_influencer_tier_commission(p_influencer_id uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_lawyer_lead_ids(_lawyer_id uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_case_event() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_case_status_change() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_contact_submission() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_influencer_case_created() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_payout_status_change() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_recruit_application() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_referral_accepted() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_student_profile_update() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_student_signin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_visa_status_email() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_admin_must_change_password() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_appointment_reminders() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_student_case_profile_link() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trg_case_payment_audit() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_case_activity() FROM PUBLIC, anon;

-- ════════════════════════════════════════════════════════════════════════
-- H5: case_payments — RLS enabled, zero policies → broken reads
-- ════════════════════════════════════════════════════════════════════════
-- useCasePayments.ts reads case_payments by case_id and currently gets nothing
-- (RLS blocks with no policies). Add case-scoped read + admin/team write.
-- Mirrors the cases policies: a user can read/modify payments for a case they
-- are assigned to or own.
DROP POLICY IF EXISTS "Admins manage all case payments" ON public.case_payments;
DROP POLICY IF EXISTS "Team manage payments on their cases" ON public.case_payments;
DROP POLICY IF EXISTS "Students read payments on their case" ON public.case_payments;
DROP POLICY IF EXISTS "Team insert payments on their cases" ON public.case_payments;

-- Admins: full access.
CREATE POLICY "Admins manage all case payments"
  ON public.case_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Team: read + write for cases assigned to them.
CREATE POLICY "Team manage payments on assigned cases"
  ON public.case_payments FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'team_member')
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_payments.case_id AND c.assigned_to = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'team_member')
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_payments.case_id AND c.assigned_to = auth.uid()
    )
  );

-- Students: read-only on their own case's payments.
CREATE POLICY "Students read payments on their case"
  ON public.case_payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_payments.case_id AND c.student_user_id = auth.uid()
    )
  );

-- case_service_snapshots: only accessed via service-role Edge Function
-- (selective-delete). Leave server-only — no client policies needed. The
-- existing ENABLE RLS with no policies correctly blocks all client access.

-- ════════════════════════════════════════════════════════════════════════
-- H2 (remaining): payout_requests self-read + rewards INSERT tightening
-- ════════════════════════════════════════════════════════════════════════
-- payout_requests has RLS enabled, zero policies. Admin writes go through the
-- admin_respond_payout_request RPC (SECURITY DEFINER, bypasses RLS). But
-- PartnerEarningsPage reads its own requests directly and currently gets empty.
-- Add a self-read SELECT policy. Admins get full access for the admin UI.
DROP POLICY IF EXISTS "Users read own payout requests" ON public.payout_requests;
DROP POLICY IF EXISTS "Admins manage payout requests" ON public.payout_requests;

CREATE POLICY "Users read own payout requests"
  ON public.payout_requests FOR SELECT TO authenticated
  USING (requestor_id = auth.uid());

CREATE POLICY "Admins manage payout requests"
  ON public.payout_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- rewards: the "Users can insert own rewards" policy is dead code — no client
-- inserts rewards (all via record_case_commission SECURITY DEFINER RPC). Drop
-- it so a compromised/curious user can't mint reward rows directly.
DROP POLICY IF EXISTS "Users can insert own rewards" ON public.rewards;
