CREATE OR REPLACE FUNCTION public.master_announce_to_network(p_body text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_name text;
  v_count integer := 0;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF coalesce(trim(p_body), '') = '' THEN RAISE EXCEPTION 'Message body required'; END IF;
  IF length(p_body) > 2000 THEN RAISE EXCEPTION 'Message too long'; END IF;

  SELECT full_name INTO v_name
  FROM public.profiles
  WHERE id = v_me AND is_master_partner = true;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Only a master partner can announce to a network';
  END IF;

  INSERT INTO public.notifications (user_id, title, body, source, metadata, title_ar, title_en, body_ar, body_en)
  SELECT p.id,
         'Network announcement',
         trim(p_body),
         'master_partner',
         jsonb_build_object('master_partner_id', v_me),
         'إعلان من ' || v_name,
         'Announcement from ' || v_name,
         trim(p_body),
         trim(p_body)
  FROM public.profiles p
  WHERE p.master_partner_id = v_me AND p.deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.master_announce_to_network(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.master_announce_to_network(text) TO authenticated;