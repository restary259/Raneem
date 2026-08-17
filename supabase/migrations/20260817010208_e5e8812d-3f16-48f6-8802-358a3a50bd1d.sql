-- 1) has_role: block anonymous enumeration of other users' roles.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Signed-out callers may never probe another account's role.
    WHEN auth.uid() IS NULL AND _user_id IS NOT NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
  END
$$;

-- 2) Revoke anon EXECUTE on SECURITY DEFINER helpers that are not public surfaces.
REVOKE EXECUTE ON FUNCTION public.chat_sender_label(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.confirm_german_finance_item(uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_earnings_summary() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_staff_directory() FROM anon;
REVOKE EXECUTE ON FUNCTION public.issue_case_invoice(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_document_access(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_invoice_email(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.profile_agent_fields_unchanged(uuid, uuid, boolean, boolean, text, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.profile_privileged_unchanged(uuid, boolean, boolean, uuid, numeric, boolean, timestamptz, text, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_case_payment(uuid, numeric, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.swap_accommodation_photo_order(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.team_can_view_student_role(uuid) FROM anon;
