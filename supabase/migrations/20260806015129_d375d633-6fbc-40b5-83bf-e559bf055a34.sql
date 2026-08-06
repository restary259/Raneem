CREATE OR REPLACE FUNCTION public.anonymize_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only admin or the user themselves can anonymize.
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to anonymize this user';
  END IF;

  -- Clear PII from profile and mark deleted.
  UPDATE public.profiles
  SET full_name     = 'Deleted User',
      email        = 'deleted+' || p_user_id::text || '@anon.local',
      phone_number = NULL,
      avatar_url   = NULL,
      iban         = NULL,
      bank_account = NULL,
      deleted_at   = NOW(),
      updated_at   = NOW()
  WHERE id = p_user_id;

  -- Cancel any outstanding rewards so they cannot be paid out.
  UPDATE public.rewards
  SET status = 'cancelled'
  WHERE user_id = p_user_id
    AND status IN ('pending', 'approved');

  -- Remove push subscriptions.
  DELETE FROM public.push_subscriptions WHERE user_id = p_user_id;

  -- Remove any session/identification rows that do not have audit value.
  DELETE FROM public.auth_failure_log WHERE user_id = p_user_id;

  -- Anonymize lead source references that pointed to this user.
  UPDATE public.leads
  SET source_id = NULL, source_type = 'organic'
  WHERE source_id = p_user_id;

  -- Record the action.
  INSERT INTO public.admin_audit_log (admin_id, action, target_id, target_table, details)
  VALUES (auth.uid(), 'user_anonymized', p_user_id::text, 'profiles', 'User account anonymized');
END;
$$;

REVOKE ALL ON FUNCTION public.anonymize_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_user(uuid) TO authenticated, service_role;

-- FK on transaction_log so an approved_by reference never becomes an orphan.
ALTER TABLE public.transaction_log
  DROP CONSTRAINT IF EXISTS transaction_log_approved_by_fkey;

ALTER TABLE public.transaction_log
  ADD CONSTRAINT transaction_log_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- FK on payout_requests (already added in a previous migration; ensure it exists with correct behavior).
ALTER TABLE public.payout_requests
  DROP CONSTRAINT IF EXISTS payout_requests_requestor_id_fkey;

ALTER TABLE public.payout_requests
  ADD CONSTRAINT payout_requests_requestor_id_fkey
  FOREIGN KEY (requestor_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
