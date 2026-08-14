-- Agent shareable apply link: make an agent's profiles.referral_code resolvable
-- through resolve_referral_code so /apply?ref=<agent-code> attributes the case
-- to the agent (cases.partner_id = agent.id). The commission backend already
-- handles agent self-referral via record_case_commission.
--
-- Agents already receive an auto-generated profiles.referral_code (trigger
-- trg_assign_referral_code, role-agnostic) but resolve_referral_code excluded
-- 'agent' from its profile-fallback role list, so the code never resolved.
-- The partner_links branch already matches any owner regardless of role, so
-- a dedicated partner_links apply code is unnecessary — we reuse the existing
-- profile code. This only adds 'agent' to the fallback role list.

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
      AND ur.role IN ('social_media_partner', 'ambassador', 'student', 'team_member', 'agent')
    LIMIT 1;
  END IF;

  RETURN v_owner;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_referral_code(text) TO anon, authenticated, service_role;
