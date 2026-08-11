CREATE OR REPLACE FUNCTION public.profile_privileged_unchanged(
  _id uuid,
  _is_manager boolean,
  _is_master_partner boolean,
  _master_partner_id uuid,
  _commission_amount numeric,
  _referral_code_enabled boolean,
  _iban_confirmed_at timestamptz,
  _referral_code text,
  _deleted_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _id
      AND COALESCE(p.is_manager, false) IS NOT DISTINCT FROM COALESCE(_is_manager, false)
      AND COALESCE(p.is_master_partner, false) IS NOT DISTINCT FROM COALESCE(_is_master_partner, false)
      AND p.master_partner_id IS NOT DISTINCT FROM _master_partner_id
      AND COALESCE(p.commission_amount, 0) IS NOT DISTINCT FROM COALESCE(_commission_amount, 0)
      AND COALESCE(p.referral_code_enabled, false) IS NOT DISTINCT FROM COALESCE(_referral_code_enabled, false)
      AND p.iban_confirmed_at IS NOT DISTINCT FROM _iban_confirmed_at
      AND p.referral_code IS NOT DISTINCT FROM _referral_code
      AND p.deleted_at IS NOT DISTINCT FROM _deleted_at
  )
$$;

GRANT EXECUTE ON FUNCTION public.profile_privileged_unchanged(uuid, boolean, boolean, uuid, numeric, boolean, timestamptz, text, timestamptz) TO authenticated;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id AND deleted_at IS NULL)
WITH CHECK (
  auth.uid() = id
  AND deleted_at IS NULL
  AND public.profile_privileged_unchanged(
    id, is_manager, is_master_partner, master_partner_id,
    commission_amount, referral_code_enabled, iban_confirmed_at,
    referral_code, deleted_at
  )
);