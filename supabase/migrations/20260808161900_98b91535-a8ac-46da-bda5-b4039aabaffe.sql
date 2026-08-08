CREATE OR REPLACE FUNCTION public.get_effective_partner_split(p_partner_id uuid)
 RETURNS TABLE(pool_amount integer, partner_amount integer, master_share integer, master_partner_id uuid, offer_id uuid, offer_version integer, accepted_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pool integer;
  v_master uuid;
  v_offer RECORD;
  v_has_offer boolean := false;
BEGIN
  v_pool := public.partner_base_pool(p_partner_id);
  SELECT p.master_partner_id INTO v_master FROM profiles p WHERE p.id = p_partner_id;

  IF v_master IS NOT NULL THEN
    SELECT * INTO v_offer
    FROM partner_rate_offers o
    WHERE o.partner_id = p_partner_id
      AND o.master_partner_id = v_master
      AND o.status = 'accepted'
    LIMIT 1;
    v_has_offer := FOUND;
  END IF;

  IF v_has_offer THEN
    RETURN QUERY SELECT v_pool,
                        LEAST(v_offer.partner_amount, v_pool),
                        GREATEST(v_pool - LEAST(v_offer.partner_amount, v_pool), 0),
                        v_master, v_offer.id, v_offer.version, v_offer.responded_at;
  ELSE
    RETURN QUERY SELECT v_pool, v_pool, 0, v_master, NULL::uuid, NULL::integer, NULL::timestamptz;
  END IF;
END;
$function$;