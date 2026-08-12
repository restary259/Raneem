-- Fix: attribution asymmetry between the referral resolvers.
--
-- The public apply flow validated a referral code client-side via
-- check_referral_code (which checks partner_links first, then falls back to
-- resolve_referral_code), but the create-case-from-apply edge function
-- attributed partners using resolve_referral_code alone — which only consults
-- profiles.referral_code (and gates on referral_code_enabled). A code that
-- existed in partner_links (or whose profile referral_code_enabled = false)
-- therefore passed the client health check yet produced a case with
-- partner_id = NULL, invisible to the partner dashboard.
--
-- This makes resolve_referral_code consult partner_links (active) first, then
-- fall back to profiles.referral_code (enabled) — identical semantics to
-- check_referral_code — so the two resolvers can never disagree. The edge
-- function already calls resolve_referral_code, so no app-code change is
-- required for attribution to work.

CREATE OR REPLACE FUNCTION public.resolve_referral_code(p_code text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_owner uuid;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN NULL;
  END IF;

  -- 1) Named partner links take precedence (per-link active flag).
  SELECT pl.partner_id INTO v_owner
  FROM public.partner_links pl
  WHERE lower(pl.code) = lower(btrim(p_code)) AND pl.active = true
  LIMIT 1;

  -- 2) Fall back to the profile's own referral code (must be enabled).
  IF v_owner IS NULL THEN
    SELECT p.id INTO v_owner
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE lower(p.referral_code) = lower(btrim(p_code))
      AND p.referral_code_enabled = true
      AND p.deleted_at IS NULL
      AND ur.role IN ('social_media_partner', 'ambassador', 'student', 'team_member')
    LIMIT 1;
  END IF;

  RETURN v_owner;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_referral_code(text) TO anon, authenticated, service_role;
