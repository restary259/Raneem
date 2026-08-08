-- ============================================================
-- Negotiated recruitment for master partners
-- ============================================================

-- 1. Recruit link codes -----------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS partner_links_code_lower_key
  ON public.partner_links (lower(code));

CREATE OR REPLACE FUNCTION public.ensure_master_recruit_link()
RETURNS TABLE(code text, target_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_code text;
  i int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_me AND is_master_partner = true) THEN
    RAISE EXCEPTION 'Only master partners have recruit links';
  END IF;

  SELECT pl.code INTO v_code
  FROM partner_links pl
  WHERE pl.partner_id = v_me AND pl.purpose = 'recruit' AND pl.active = true
    AND pl.code LIKE 'MP-%'
  LIMIT 1;

  IF v_code IS NULL THEN
    LOOP
      v_code := 'MP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM partner_links pl2 WHERE lower(pl2.code) = lower(v_code));
      i := i + 1;
      IF i > 30 THEN
        v_code := 'MP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
        EXIT;
      END IF;
    END LOOP;

    INSERT INTO partner_links (partner_id, code, label, target_path, purpose, active)
    VALUES (v_me, v_code, 'Recruit partners', '/join/' || v_code, 'recruit', true);
  END IF;

  RETURN QUERY SELECT v_code, '/join/' || v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_master_recruit_link() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ensure_master_recruit_link() TO authenticated;

-- Public resolver: reveals only the recruiter's display name.
CREATE OR REPLACE FUNCTION public.resolve_recruit_code(p_code text)
RETURNS TABLE(valid boolean, recruiter_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT true, pr.full_name
  FROM public.partner_links pl
  JOIN public.profiles pr ON pr.id = pl.partner_id
  WHERE lower(pl.code) = lower(btrim(p_code))
    AND pl.active = true
    AND pl.purpose = 'recruit'
    AND pr.is_master_partner = true
    AND pr.deleted_at IS NULL
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.resolve_recruit_code(text) TO anon, authenticated;

-- 2. Recruit applications ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_recruit_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruit_code text NOT NULL,
  master_partner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  city text,
  social_link text,
  note text,
  status text NOT NULL DEFAULT 'pending',
  created_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recruit_apps_master ON public.partner_recruit_applications(master_partner_id);
CREATE INDEX IF NOT EXISTS idx_recruit_apps_status ON public.partner_recruit_applications(status);

GRANT SELECT ON public.partner_recruit_applications TO authenticated;
GRANT ALL ON public.partner_recruit_applications TO service_role;

ALTER TABLE public.partner_recruit_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage recruit applications" ON public.partner_recruit_applications;
CREATE POLICY "admins manage recruit applications"
  ON public.partner_recruit_applications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "master reads own recruit applications" ON public.partner_recruit_applications;
CREATE POLICY "master reads own recruit applications"
  ON public.partner_recruit_applications FOR SELECT TO authenticated
  USING (master_partner_id = auth.uid());

DROP TRIGGER IF EXISTS trg_recruit_apps_updated ON public.partner_recruit_applications;
CREATE TRIGGER trg_recruit_apps_updated
  BEFORE UPDATE ON public.partner_recruit_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Anonymous submission: recruiter is resolved server-side from the code.
CREATE OR REPLACE FUNCTION public.submit_recruit_application(
  p_code text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_city text DEFAULT NULL,
  p_social_link text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master uuid;
  v_id uuid;
BEGIN
  SELECT pl.partner_id INTO v_master
  FROM partner_links pl
  JOIN profiles pr ON pr.id = pl.partner_id
  WHERE lower(pl.code) = lower(btrim(p_code))
    AND pl.active = true AND pl.purpose = 'recruit'
    AND pr.is_master_partner = true AND pr.deleted_at IS NULL
  LIMIT 1;

  IF v_master IS NULL THEN
    RAISE EXCEPTION 'Invalid recruit link';
  END IF;

  IF btrim(COALESCE(p_full_name, '')) = '' OR btrim(COALESCE(p_email, '')) = ''
     OR btrim(COALESCE(p_phone, '')) = '' THEN
    RAISE EXCEPTION 'Name, email and phone are required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM partner_recruit_applications
    WHERE lower(email) = lower(btrim(p_email)) AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'An application with this email is already pending';
  END IF;

  INSERT INTO partner_recruit_applications
    (recruit_code, master_partner_id, full_name, email, phone, city, social_link, note)
  VALUES
    (upper(btrim(p_code)), v_master, left(btrim(p_full_name), 100), lower(btrim(p_email)),
     left(btrim(p_phone), 30), left(btrim(p_city), 80), left(btrim(p_social_link), 300),
     left(btrim(p_note), 1000))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_recruit_application(text, text, text, text, text, text, text) TO anon, authenticated;

-- Admin links an approved application to the created partner account.
CREATE OR REPLACE FUNCTION public.approve_recruit_application(p_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT master_partner_id INTO v_master
  FROM partner_recruit_applications WHERE id = p_id;
  IF v_master IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;

  UPDATE profiles SET master_partner_id = v_master WHERE id = p_user_id;

  UPDATE partner_recruit_applications
  SET status = 'approved', created_user_id = p_user_id,
      reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_recruit_application(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.approve_recruit_application(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_recruit_application(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  UPDATE partner_recruit_applications
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_id AND status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.reject_recruit_application(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reject_recruit_application(uuid) TO authenticated;

-- 3. Negotiated rate offers -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_rate_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_partner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pool_amount integer NOT NULL,
  partner_amount integer NOT NULL,
  master_amount integer NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  note text,
  offered_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_offers_partner ON public.partner_rate_offers(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_rate_offers_master ON public.partner_rate_offers(master_partner_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_rate_offer_accepted
  ON public.partner_rate_offers(partner_id) WHERE status = 'accepted';

GRANT SELECT ON public.partner_rate_offers TO authenticated;
GRANT ALL ON public.partner_rate_offers TO service_role;

ALTER TABLE public.partner_rate_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage rate offers" ON public.partner_rate_offers;
CREATE POLICY "admins manage rate offers"
  ON public.partner_rate_offers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "participants read rate offers" ON public.partner_rate_offers;
CREATE POLICY "participants read rate offers"
  ON public.partner_rate_offers FOR SELECT TO authenticated
  USING (master_partner_id = auth.uid() OR partner_id = auth.uid());

DROP TRIGGER IF EXISTS trg_rate_offers_updated ON public.partner_rate_offers;
CREATE TRIGGER trg_rate_offers_updated
  BEFORE UPDATE ON public.partner_rate_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Base pool for a partner (per-person override wins, else global default).
CREATE OR REPLACE FUNCTION public.partner_base_pool(p_partner_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pool integer;
BEGIN
  SELECT commission_amount INTO v_pool
  FROM partner_commission_overrides WHERE partner_id = p_partner_id;
  IF v_pool IS NULL THEN
    SELECT COALESCE(partner_commission_rate, 0) INTO v_pool FROM platform_settings LIMIT 1;
  END IF;
  RETURN COALESCE(v_pool, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.partner_base_pool(uuid) TO authenticated;

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
    RAISE EXCEPTION 'Only master partners can send rate offers';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_partner_id AND master_partner_id = v_me AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'You can only negotiate with partners you recruited';
  END IF;

  v_pool := public.partner_base_pool(p_partner_id);

  IF p_partner_amount IS NULL OR p_partner_amount < 0 OR p_partner_amount > v_pool THEN
    RAISE EXCEPTION 'Offer must be between 0 and %', v_pool;
  END IF;

  UPDATE partner_rate_offers
  SET status = 'superseded', responded_at = now()
  WHERE partner_id = p_partner_id AND master_partner_id = v_me AND status = 'pending';

  SELECT COALESCE(max(version), 0) + 1 INTO v_version
  FROM partner_rate_offers WHERE partner_id = p_partner_id;

  INSERT INTO partner_rate_offers
    (master_partner_id, partner_id, pool_amount, partner_amount, master_amount, version, note)
  VALUES
    (v_me, p_partner_id, v_pool, p_partner_amount, v_pool - p_partner_amount, v_version, left(btrim(p_note), 500))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.master_send_rate_offer(uuid, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.master_send_rate_offer(uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.partner_respond_rate_offer(p_offer_id uuid, p_accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_offer RECORD;
BEGIN
  SELECT * INTO v_offer FROM partner_rate_offers WHERE id = p_offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offer not found'; END IF;
  IF v_offer.partner_id <> v_me THEN RAISE EXCEPTION 'Only the receiving partner can respond'; END IF;
  IF v_offer.status <> 'pending' THEN RAISE EXCEPTION 'Offer is no longer pending'; END IF;

  IF p_accept THEN
    UPDATE partner_rate_offers
    SET status = 'replaced', responded_at = now()
    WHERE partner_id = v_me AND status = 'accepted';

    UPDATE partner_rate_offers
    SET status = 'accepted', responded_at = now()
    WHERE id = p_offer_id;
  ELSE
    UPDATE partner_rate_offers
    SET status = 'declined', responded_at = now()
    WHERE id = p_offer_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.partner_respond_rate_offer(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.partner_respond_rate_offer(uuid, boolean) TO authenticated;

-- Effective split for a partner: pool never changes, only how it is divided.
CREATE OR REPLACE FUNCTION public.get_effective_partner_split(p_partner_id uuid)
RETURNS TABLE(
  pool_amount integer,
  partner_amount integer,
  master_share integer,
  master_partner_id uuid,
  offer_id uuid,
  offer_version integer,
  accepted_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool integer;
  v_master uuid;
  v_offer RECORD;
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
  END IF;

  IF v_offer.id IS NOT NULL THEN
    RETURN QUERY SELECT v_pool,
                        LEAST(v_offer.partner_amount, v_pool),
                        GREATEST(v_pool - LEAST(v_offer.partner_amount, v_pool), 0),
                        v_master, v_offer.id, v_offer.version, v_offer.responded_at;
  ELSE
    RETURN QUERY SELECT v_pool, v_pool, 0, v_master, NULL::uuid, NULL::integer, NULL::timestamptz;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_partner_split(uuid) TO authenticated;

-- 4. Commission split honouring the negotiated agreement --------------------
CREATE OR REPLACE FUNCTION public.record_case_commission(p_case_id uuid, p_total_payment_ils integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_case              RECORD;
  v_t_comm            integer := 0;
  v_pool              integer := 0;
  v_partner_comm      integer := 0;
  v_master_share      integer := 0;
  v_override          integer := 0;
  v_master            uuid;
  v_split             RECORD;
  v_admin_remainder   integer := 0;
  v_global_team_rate  integer := 100;
BEGIN
  IF EXISTS (SELECT 1 FROM cases WHERE id = p_case_id AND commission_split_done = true) THEN
    RETURN;
  END IF;

  SELECT id, assigned_to, source, partner_id
  INTO v_case
  FROM cases WHERE id = p_case_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(team_member_commission_rate, 100)
  INTO v_global_team_rate
  FROM platform_settings LIMIT 1;

  IF v_case.assigned_to IS NOT NULL THEN
    SELECT COALESCE(commission_amount, v_global_team_rate)
    INTO v_t_comm
    FROM team_member_commission_overrides
    WHERE team_member_id = v_case.assigned_to;
    IF NOT FOUND THEN v_t_comm := v_global_team_rate; END IF;

    IF v_t_comm > 0 THEN
      INSERT INTO rewards (user_id, amount, status, case_id, reward_type, admin_notes)
      VALUES (
        v_case.assigned_to, v_t_comm, 'pending', p_case_id, 'team',
        'Team commission from case ' || p_case_id::text
      ) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  IF v_case.partner_id IS NOT NULL THEN
    SELECT * INTO v_split FROM public.get_effective_partner_split(v_case.partner_id);
    v_pool         := COALESCE(v_split.pool_amount, 0);
    v_partner_comm := COALESCE(v_split.partner_amount, 0);
    v_master_share := COALESCE(v_split.master_share, 0);
    v_master       := v_split.master_partner_id;

    IF v_partner_comm > 0 THEN
      INSERT INTO rewards (user_id, amount, status, case_id, reward_type, admin_notes)
      VALUES (
        v_case.partner_id, v_partner_comm, 'pending', p_case_id, 'referral',
        'Partner commission from case ' || p_case_id::text
      ) ON CONFLICT DO NOTHING;
    END IF;

    IF v_master IS NOT NULL AND v_master <> v_case.partner_id THEN
      -- (a) negotiated share of the SAME pool — never extra cost to Darb
      IF v_master_share > 0 THEN
        INSERT INTO rewards (user_id, amount, status, case_id, reward_type, source_user_id, admin_notes)
        VALUES (
          v_master, v_master_share, 'pending', p_case_id, 'network_split', v_case.partner_id,
          'Negotiated network split from case ' || p_case_id::text
        ) ON CONFLICT DO NOTHING;
      END IF;

      -- (b) flat override paid out of Darb's margin
      SELECT master_override_amount INTO v_override
      FROM partner_commission_overrides
      WHERE partner_id = v_master;

      IF v_override IS NULL THEN
        SELECT COALESCE(master_partner_override_rate, 0) INTO v_override
        FROM platform_settings LIMIT 1;
      END IF;

      IF v_override > 0 THEN
        INSERT INTO rewards (user_id, amount, status, case_id, reward_type, source_user_id, admin_notes)
        VALUES (
          v_master, v_override, 'pending', p_case_id, 'master_override', v_case.partner_id,
          'Network override from case ' || p_case_id::text
        ) ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  v_admin_remainder := GREATEST(
    0,
    p_total_payment_ils - v_t_comm - v_pool - COALESCE(v_override, 0)
  );

  UPDATE cases SET
    platform_revenue_ils  = v_admin_remainder,
    commission_split_done = true
  WHERE id = p_case_id;
END;
$function$;

-- Offers visible to a partner / master through a safe RPC
CREATE OR REPLACE FUNCTION public.get_my_rate_offers()
RETURNS TABLE(
  id uuid,
  master_partner_id uuid,
  master_name text,
  partner_id uuid,
  partner_name text,
  pool_amount integer,
  partner_amount integer,
  master_amount integer,
  version integer,
  status text,
  note text,
  offered_at timestamptz,
  responded_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.master_partner_id, mp.full_name, o.partner_id, pp.full_name,
         o.pool_amount, o.partner_amount, o.master_amount, o.version, o.status,
         o.note, o.offered_at, o.responded_at
  FROM public.partner_rate_offers o
  LEFT JOIN public.profiles mp ON mp.id = o.master_partner_id
  LEFT JOIN public.profiles pp ON pp.id = o.partner_id
  WHERE o.master_partner_id = auth.uid() OR o.partner_id = auth.uid()
  ORDER BY o.offered_at DESC
$$;

REVOKE ALL ON FUNCTION public.get_my_rate_offers() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_rate_offers() TO authenticated;