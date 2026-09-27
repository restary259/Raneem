CREATE OR REPLACE FUNCTION public.get_whatsapp_inbound_stats()
RETURNS TABLE(inbound_count bigint, last_inbound_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::bigint, max(created_at)
  FROM public.whatsapp_messages
  WHERE direction = 'inbound'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_member'));
$$;
REVOKE ALL ON FUNCTION public.get_whatsapp_inbound_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_inbound_stats() TO authenticated, service_role;