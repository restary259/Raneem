CREATE OR REPLACE FUNCTION public.backfill_case_attribution(p_case_id uuid, p_partner_id uuid DEFAULT NULL::uuid, p_referred_by uuid DEFAULT NULL::uuid, p_attribution_method text DEFAULT NULL::text)
 RETURNS TABLE(partner_id uuid, referred_by uuid, source_attribution_method text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing RECORD;
  v_patch jsonb := '{}'::jsonb;
BEGIN
  IF p_case_id IS NULL THEN
    RETURN;
  END IF;

  -- Alias the table: the RETURNS TABLE output columns share their names with
  -- the case columns, so unqualified references are ambiguous (42702).
  SELECT c.partner_id, c.referred_by, c.source_attribution_method
    INTO v_existing
  FROM public.cases c
  WHERE c.id = p_case_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Additive only: never overwrite an existing attribution.
  IF p_partner_id IS NOT NULL AND v_existing.partner_id IS NULL THEN
    v_patch := v_patch || jsonb_build_object('partner_id', p_partner_id);
  END IF;
  IF p_referred_by IS NOT NULL AND v_existing.referred_by IS NULL THEN
    v_patch := v_patch || jsonb_build_object('referred_by', p_referred_by);
  END IF;
  IF p_attribution_method IS NOT NULL AND v_existing.source_attribution_method IS NULL THEN
    v_patch := v_patch || jsonb_build_object('source_attribution_method', p_attribution_method);
  END IF;

  IF v_patch = '{}'::jsonb THEN
    RETURN QUERY SELECT v_existing.partner_id, v_existing.referred_by, v_existing.source_attribution_method;
    RETURN;
  END IF;

  -- Trusted internal write: bypass the financial-column guard for this update.
  PERFORM set_config('app.internal_commission_split', 'on', true);
  UPDATE public.cases c
     SET partner_id                = COALESCE((v_patch->>'partner_id')::uuid, c.partner_id),
         referred_by               = COALESCE((v_patch->>'referred_by')::uuid, c.referred_by),
         source_attribution_method = COALESCE(v_patch->>'source_attribution_method', c.source_attribution_method)
   WHERE c.id = p_case_id;
  PERFORM set_config('app.internal_commission_split', 'off', true);

  RETURN QUERY
  SELECT c.partner_id, c.referred_by, c.source_attribution_method
  FROM public.cases c
  WHERE c.id = p_case_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.backfill_case_attribution(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_case_attribution(uuid, uuid, uuid, text) TO service_role;