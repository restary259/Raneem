-- Resolve display names (id, full_name only) for partner/referrer ids shown on a
-- case overview. Team members cannot SELECT arbitrary profiles rows (RLS restricts
-- to self / own students / admin), so partner_id / referred_by names silently fell
-- back to "Not set yet." This SECURITY DEFINER RPC exposes only the minimal columns
-- needed for display (no bank/IBAN/passport/identity fields), granted to authenticated.
CREATE OR REPLACE FUNCTION public.resolve_profile_names(p_ids uuid[])
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name
  FROM public.profiles p
  WHERE p.id = ANY(p_ids)
    AND p.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.resolve_profile_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_profile_names(uuid[]) TO authenticated;
