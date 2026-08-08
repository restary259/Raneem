REVOKE EXECUTE ON FUNCTION public.get_my_payout_preview() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_payout_via_chat(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_payout_request_detail(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_respond_payout_request(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_payout_preview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_payout_via_chat(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payout_request_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_respond_payout_request(uuid, text, text, text) TO authenticated;