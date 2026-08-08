CREATE OR REPLACE FUNCTION public.master_send_rate_offer(
  p_partner_id uuid,
  p_partner_amount integer,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_pool integer;
  v_version integer;
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_me AND is_master_partner = true) THEN
    RAISE EXCEPTION 'Only master partners can set partner rates';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_partner_id AND master_partner_id = v_me AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'You can only set rates for partners you recruited';
  END IF;

  v_pool := public.partner_base_pool(p_partner_id);

  IF p_partner_amount IS NULL OR p_partner_amount < 0 OR p_partner_amount > v_pool THEN
    RAISE EXCEPTION 'Rate must be between 0 and %', v_pool;
  END IF;

  -- Direct override: no negotiation round-trip. Terms are agreed offline in
  -- the signed recruitment contract, so the new rate applies immediately and
  -- the prior active rate is archived for audit.
  UPDATE partner_rate_offers
  SET status = 'superseded', responded_at = now()
  WHERE partner_id = p_partner_id AND status = 'pending';

  UPDATE partner_rate_offers
  SET status = 'replaced', responded_at = now()
  WHERE partner_id = p_partner_id AND status = 'accepted';

  SELECT COALESCE(max(version), 0) + 1 INTO v_version
  FROM partner_rate_offers WHERE partner_id = p_partner_id;

  INSERT INTO partner_rate_offers
    (master_partner_id, partner_id, pool_amount, partner_amount, master_amount,
     version, note, status, responded_at)
  VALUES
    (v_me, p_partner_id, v_pool, p_partner_amount, v_pool - p_partner_amount,
     v_version, left(btrim(p_note), 500), 'accepted', now())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.master_send_rate_offer(uuid, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.master_send_rate_offer(uuid, integer, text) TO authenticated;