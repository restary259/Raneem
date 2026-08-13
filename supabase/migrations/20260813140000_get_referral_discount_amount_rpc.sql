-- ════════════════════════════════════════════════════════════════════════
-- Referral discount amount — student-readable RPC (2026-08-13)
--
-- platform_settings RLS is staff/partner only (20260806005104), so the
-- student ReferralForm banner can never read the real configured discount
-- and silently falls back to a hardcoded 500. Expose exactly one value —
-- the current referral discount amount — through a SECURITY DEFINER RPC.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_referral_discount_amount()
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric;
BEGIN
  -- platform_settings is a singleton settings row; LIMIT 1 mirrors the
  -- established pattern in get_partner_pool_cases (20260806005104).
  SELECT ps.referral_discount_amount
    INTO v_amount
    FROM public.platform_settings ps
   LIMIT 1;
  RETURN v_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.get_referral_discount_amount() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_referral_discount_amount() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_referral_discount_amount() TO authenticated;
