-- 1. Partner pool becomes the authoritative ₪1,000 allocation
UPDATE public.platform_settings SET partner_commission_rate = 1000 WHERE partner_commission_rate IS DISTINCT FROM 1000;

-- 2. Guard: the master recruitment share can never exceed the partner pool
CREATE OR REPLACE FUNCTION public.validate_commission_allocation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.partner_commission_rate, 0) < 0
     OR COALESCE(NEW.master_partner_override_rate, 0) < 0 THEN
    RAISE EXCEPTION 'Commission amounts cannot be negative';
  END IF;
  IF COALESCE(NEW.master_partner_override_rate, 0) > COALESCE(NEW.partner_commission_rate, 0) THEN
    RAISE EXCEPTION 'Master partner share (%) cannot exceed the partner pool (%)',
      NEW.master_partner_override_rate, NEW.partner_commission_rate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_commission_allocation_trg ON public.platform_settings;
CREATE TRIGGER validate_commission_allocation_trg
BEFORE INSERT OR UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION public.validate_commission_allocation();

-- 3. The split now CARVES the master share out of the pool (never adds on top)
DROP FUNCTION IF EXISTS public.get_effective_partner_split(uuid);
CREATE FUNCTION public.get_effective_partner_split(p_partner_id uuid)
RETURNS TABLE(pool_amount integer, partner_amount integer, master_share integer,
              master_partner_id uuid, offer_id uuid, offer_version integer,
              responded_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool     integer;
  v_master   uuid;
  v_offer    RECORD;
  v_has_offer boolean := false;
  v_override integer;
  v_share    integer := 0;
BEGIN
  v_pool := public.partner_base_pool(p_partner_id);
  SELECT p.master_partner_id INTO v_master FROM profiles p WHERE p.id = p_partner_id;

  -- A master partner referring their own case keeps the whole pool.
  IF v_master IS NOT NULL AND v_master = p_partner_id THEN
    v_master := NULL;
  END IF;

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
    -- Negotiated: the offer fixes the recruit's amount, the master keeps the rest of the pool.
    RETURN QUERY SELECT v_pool,
                        LEAST(v_offer.partner_amount, v_pool),
                        GREATEST(v_pool - LEAST(v_offer.partner_amount, v_pool), 0),
                        v_master, v_offer.id, v_offer.version, v_offer.responded_at;
  ELSIF v_master IS NOT NULL THEN
    -- Default recruitment allocation: master share carved out of the same pool.
    SELECT master_override_amount INTO v_override
    FROM partner_commission_overrides WHERE partner_id = v_master;
    IF v_override IS NULL THEN
      SELECT COALESCE(master_partner_override_rate, 0) INTO v_override FROM platform_settings LIMIT 1;
    END IF;
    v_share := LEAST(GREATEST(COALESCE(v_override, 0), 0), v_pool);
    RETURN QUERY SELECT v_pool, v_pool - v_share, v_share,
                        v_master, NULL::uuid, NULL::integer, NULL::timestamptz;
  ELSE
    RETURN QUERY SELECT v_pool, v_pool, 0, NULL::uuid, NULL::uuid, NULL::integer, NULL::timestamptz;
  END IF;
END;
$$;

-- 4. Commission recording: one pool, split between recruit and recruiting master
CREATE OR REPLACE FUNCTION public.record_case_commission(p_case_id uuid, p_total_payment_ils integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case              RECORD;
  v_t_comm            integer := 0;
  v_t_source          text := 'platform_settings';
  v_pool              integer := 0;
  v_partner_comm      integer := 0;
  v_master_share      integer := 0;
  v_master            uuid;
  v_split             RECORD;
  v_admin_remainder   integer := 0;
  v_global_team_rate  integer := 100;
  v_partner_source    text := 'platform_settings';
  v_master_source     text := 'platform_settings';
  v_master_type       text := 'master_override';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('case_commission:' || p_case_id::text));

  SELECT id, assigned_to, source, partner_id, status, case_reference, commission_split_done
  INTO v_case
  FROM cases WHERE id = p_case_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_case.commission_split_done THEN RETURN; END IF;

  IF v_case.status IS DISTINCT FROM 'enrollment_paid' THEN
    RAISE EXCEPTION 'Commission can only be recorded once the case reaches enrollment_paid (current: %)', v_case.status;
  END IF;

  SELECT COALESCE(team_member_commission_rate, 100) INTO v_global_team_rate
  FROM platform_settings LIMIT 1;

  IF v_case.assigned_to IS NOT NULL THEN
    SELECT commission_amount INTO v_t_comm
    FROM team_member_commission_overrides WHERE team_member_id = v_case.assigned_to;

    IF v_t_comm IS NULL THEN
      v_t_comm := v_global_team_rate;
      v_t_source := 'platform_settings';
    ELSE
      v_t_source := 'team_override';
    END IF;

    IF v_t_comm > 0 THEN
      INSERT INTO rewards (user_id, amount, status, case_id, reward_type, admin_notes,
                           recipient_role, case_reference, rate_used, base_amount, rate_source,
                           unlock_at, created_by_event)
      VALUES (
        v_case.assigned_to, v_t_comm, 'pending', p_case_id, 'team',
        'Team commission from case ' || COALESCE(v_case.case_reference, p_case_id::text),
        'team_member', v_case.case_reference, v_t_comm, p_total_payment_ils, v_t_source,
        now() + interval '20 days', 'case_enrollment_paid'
      ) ON CONFLICT (case_id, user_id, reward_type) DO NOTHING;
    END IF;
  END IF;

  IF v_case.partner_id IS NOT NULL THEN
    SELECT * INTO v_split FROM public.get_effective_partner_split(v_case.partner_id);
    v_pool         := COALESCE(v_split.pool_amount, 0);
    v_partner_comm := COALESCE(v_split.partner_amount, 0);
    v_master_share := COALESCE(v_split.master_share, 0);
    v_master       := v_split.master_partner_id;

    IF EXISTS (SELECT 1 FROM partner_commission_overrides WHERE partner_id = v_case.partner_id) THEN
      v_partner_source := 'partner_override';
    END IF;
    IF v_split.offer_id IS NOT NULL THEN
      v_partner_source := 'negotiated_offer';
      v_master_source  := 'negotiated_offer';
      v_master_type    := 'network_split';
    ELSIF v_master IS NOT NULL
      AND EXISTS (SELECT 1 FROM partner_commission_overrides WHERE partner_id = v_master) THEN
      v_master_source := 'partner_override';
    END IF;

    IF v_partner_comm > 0 THEN
      INSERT INTO rewards (user_id, amount, status, case_id, reward_type, admin_notes,
                           recipient_role, case_reference, rate_used, base_amount, rate_source,
                           unlock_at, created_by_event)
      VALUES (
        v_case.partner_id, v_partner_comm, 'pending', p_case_id, 'referral',
        'Partner commission from case ' || COALESCE(v_case.case_reference, p_case_id::text),
        'partner', v_case.case_reference, v_partner_comm, v_pool, v_partner_source,
        now() + interval '20 days', 'case_enrollment_paid'
      ) ON CONFLICT (case_id, user_id, reward_type) DO NOTHING;
    END IF;

    -- Recruiting master: a single carve-out of the same pool, never an extra payment.
    IF v_master IS NOT NULL AND v_master <> v_case.partner_id AND v_master_share > 0 THEN
      INSERT INTO rewards (user_id, amount, status, case_id, reward_type, source_user_id, admin_notes,
                           recipient_role, case_reference, rate_used, base_amount, rate_source,
                           unlock_at, created_by_event)
      VALUES (
        v_master, v_master_share, 'pending', p_case_id, v_master_type, v_case.partner_id,
        'Recruitment share from case ' || COALESCE(v_case.case_reference, p_case_id::text),
        'master_partner', v_case.case_reference, v_master_share, v_pool, v_master_source,
        now() + interval '20 days', 'case_enrollment_paid'
      ) ON CONFLICT (case_id, user_id, reward_type) DO NOTHING;
    END IF;
  END IF;

  v_admin_remainder := GREATEST(0, p_total_payment_ils - v_t_comm - v_pool);

  UPDATE cases SET
    platform_revenue_ils  = v_admin_remainder,
    commission_split_done = true
  WHERE id = p_case_id;

  PERFORM public.log_case_event(
    p_case_id,
    'commission_recorded',
    jsonb_build_object(
      'base_amount', p_total_payment_ils,
      'team_amount', v_t_comm,
      'partner_pool', v_pool,
      'partner_amount', v_partner_comm,
      'master_share', v_master_share,
      'platform_revenue', v_admin_remainder,
      'unlock_at', (now() + interval '20 days')
    ),
    true
  );
END;
$$;