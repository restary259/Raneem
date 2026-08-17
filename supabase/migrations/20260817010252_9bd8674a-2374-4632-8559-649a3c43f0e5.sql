-- These functions still carried a PUBLIC grant, which keeps them anon-callable.
REVOKE EXECUTE ON FUNCTION public.chat_sender_label(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_sender_label(uuid, uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_my_earnings_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_earnings_summary() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_staff_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_directory() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.issue_case_invoice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_case_invoice(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.submit_case_payment(uuid, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_case_payment(uuid, numeric, text, text, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.swap_accommodation_photo_order(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.swap_accommodation_photo_order(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.profile_privileged_unchanged(uuid, boolean, boolean, uuid, numeric, boolean, timestamptz, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_privileged_unchanged(uuid, boolean, boolean, uuid, numeric, boolean, timestamptz, text, timestamptz) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.profile_agent_fields_unchanged(uuid, uuid, boolean, boolean, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_agent_fields_unchanged(uuid, uuid, boolean, boolean, text, uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.mark_invoice_email(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_invoice_email(uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invoice_email(uuid, text, text) TO service_role;
