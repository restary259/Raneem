REVOKE ALL ON FUNCTION public.enqueue_push_for_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notification_category_for_source(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notification_category_for_source(text) TO authenticated, service_role;