CREATE OR REPLACE FUNCTION public.profile_agent_fields_unchanged(
  _id uuid,
  _agent_id uuid,
  _agent_can_invite_directly boolean,
  _agent_can_create_accounts boolean,
  _student_status text,
  _case_id uuid,
  _linked_case_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _id
      AND p.agent_id IS NOT DISTINCT FROM _agent_id
      AND COALESCE(p.agent_can_invite_directly, false) IS NOT DISTINCT FROM COALESCE(_agent_can_invite_directly, false)
      AND COALESCE(p.agent_can_create_accounts, false) IS NOT DISTINCT FROM COALESCE(_agent_can_create_accounts, false)
      AND p.student_status::text IS NOT DISTINCT FROM _student_status
      AND p.case_id IS NOT DISTINCT FROM _case_id
      AND p.linked_case_id IS NOT DISTINCT FROM _linked_case_id
  )
$function$;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING ((auth.uid() = id) AND (deleted_at IS NULL))
WITH CHECK (
  (auth.uid() = id)
  AND (deleted_at IS NULL)
  AND public.profile_privileged_unchanged(id, is_manager, is_master_partner, master_partner_id, (commission_amount)::numeric, referral_code_enabled, iban_confirmed_at, referral_code, deleted_at)
  AND public.profile_agent_fields_unchanged(id, agent_id, agent_can_invite_directly, agent_can_create_accounts, student_status::text, case_id, linked_case_id)
);