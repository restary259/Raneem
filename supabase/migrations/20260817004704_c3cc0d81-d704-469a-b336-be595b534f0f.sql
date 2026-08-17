-- 1) Lock down internal SECURITY DEFINER helpers that no client calls.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname IN (
        'enqueue_email','read_email_batch','delete_email','move_to_dlq','email_queue_dispatch',
        'sync_agent_relationship_row','ensure_case_finance_confirmations',
        'get_case_darb_service_total','get_effective_partner_split',
        'get_agent_commission_rate','get_agent_self_referral_rate','get_ambassador_commission_rate',
        'get_partner_commission_rate','get_team_member_commission_rate','get_master_partner_override_rate'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- get_effective_partner_split is called by the partner network page: keep it for signed-in users.
GRANT EXECUTE ON FUNCTION public.get_effective_partner_split(uuid) TO authenticated;

-- 2) Block privilege self-assignment at profile INSERT time.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
  AND COALESCE(is_master_partner, false) = false
  AND COALESCE(is_manager, false) = false
  AND master_partner_id IS NULL
  AND COALESCE(commission_amount, 0) = 0
  AND COALESCE(referral_code_enabled, false) = false
  AND deleted_at IS NULL
  AND iban_confirmed_at IS NULL
  -- agent / case-linking privileges can never be self-assigned on insert
  AND agent_id IS NULL
  AND COALESCE(agent_can_invite_directly, false) = false
  AND COALESCE(agent_can_create_accounts, false) = false
  AND case_id IS NULL
  AND linked_case_id IS NULL
  AND student_status IS NULL
  AND referral_code IS NULL
);