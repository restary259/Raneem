-- 1. Profile flags
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_master_partner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS master_partner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_master_partner ON public.profiles(master_partner_id);

-- guard: no self reference, no multi-level depth
CREATE OR REPLACE FUNCTION public.enforce_master_partner_graph()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.master_partner_id IS NOT NULL THEN
    IF NEW.master_partner_id = NEW.id THEN
      RAISE EXCEPTION 'A partner cannot recruit themselves';
    END IF;
    IF NEW.is_master_partner THEN
      RAISE EXCEPTION 'A master partner cannot be recruited by another master partner';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = NEW.master_partner_id AND p.is_master_partner = true
    ) THEN
      RAISE EXCEPTION 'Recruiter must be a master partner';
    END IF;
  END IF;

  IF NEW.is_master_partner AND NEW.master_partner_id IS NOT NULL THEN
    RAISE EXCEPTION 'A master partner cannot belong to another network';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_master_partner_graph ON public.profiles;
CREATE TRIGGER trg_enforce_master_partner_graph
  BEFORE INSERT OR UPDATE OF is_master_partner, master_partner_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_master_partner_graph();

-- 2. Configurable override rate
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS master_partner_override_rate integer NOT NULL DEFAULT 200;

ALTER TABLE public.partner_commission_overrides
  ADD COLUMN IF NOT EXISTS master_override_amount integer;

-- 3. Reward typing
ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS reward_type text NOT NULL DEFAULT 'referral',
  ADD COLUMN IF NOT EXISTS source_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.rewards
SET reward_type = 'team'
WHERE reward_type = 'referral'
  AND admin_notes ILIKE 'Team commission%';

CREATE INDEX IF NOT EXISTS idx_rewards_type ON public.rewards(reward_type);
CREATE INDEX IF NOT EXISTS idx_rewards_source_user ON public.rewards(source_user_id);

-- 4. Recruit links
ALTER TABLE public.partner_links
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'student';

-- 5. Commission split with the master override layer
CREATE OR REPLACE FUNCTION public.record_case_commission(p_case_id uuid, p_total_payment_ils integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_case              RECORD;
  v_t_comm            integer := 0;
  v_partner_comm      integer := 0;
  v_override          integer := 0;
  v_master            uuid;
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
    SELECT commission_amount INTO v_partner_comm
    FROM partner_commission_overrides
    WHERE partner_id = v_case.partner_id;

    IF v_partner_comm IS NULL THEN
      SELECT COALESCE(partner_commission_rate, 0) INTO v_partner_comm
      FROM platform_settings LIMIT 1;
    END IF;

    IF v_partner_comm > 0 THEN
      INSERT INTO rewards (user_id, amount, status, case_id, reward_type, admin_notes)
      VALUES (
        v_case.partner_id, v_partner_comm, 'pending', p_case_id, 'referral',
        'Partner commission from case ' || p_case_id::text
      ) ON CONFLICT DO NOTHING;
    END IF;

    -- Master partner network override: only for the recruiting master of THIS partner.
    SELECT master_partner_id INTO v_master FROM profiles WHERE id = v_case.partner_id;

    IF v_master IS NOT NULL AND v_master <> v_case.partner_id THEN
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

  v_admin_remainder := GREATEST(0, p_total_payment_ils - v_t_comm - v_partner_comm - COALESCE(v_override, 0));

  UPDATE cases SET
    platform_revenue_ils  = v_admin_remainder,
    commission_split_done = true
  WHERE id = p_case_id;
END;
$function$;

-- 6. Resolve link now exposes purpose + recruiter status
DROP FUNCTION IF EXISTS public.resolve_partner_link(text);
CREATE OR REPLACE FUNCTION public.resolve_partner_link(p_code text)
RETURNS TABLE(link_id uuid, partner_id uuid, partner_name text, target_path text, purpose text, is_master_partner boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT pl.id, pl.partner_id, pr.full_name, pl.target_path, pl.purpose,
         COALESCE(pr.is_master_partner, false)
  FROM public.partner_links pl
  LEFT JOIN public.profiles pr ON pr.id = pl.partner_id
  WHERE lower(pl.code) = lower(trim(p_code)) AND pl.active = true
  LIMIT 1
$function$;

-- 7. Master partner network view (own network only)
CREATE OR REPLACE FUNCTION public.get_my_network()
RETURNS TABLE(
  partner_id uuid,
  full_name text,
  email text,
  city text,
  referral_code text,
  joined_at timestamptz,
  status text,
  students_count bigint,
  paid_cases bigint,
  override_earned numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  WITH me AS (
    SELECT id FROM public.profiles
    WHERE id = auth.uid() AND is_master_partner = true
  ),
  recruits AS (
    SELECT p.id, p.full_name, p.email, p.city, p.referral_code, p.created_at
    FROM public.profiles p
    JOIN me ON p.master_partner_id = me.id
    WHERE p.deleted_at IS NULL
  )
  SELECT r.id,
         r.full_name,
         r.email,
         r.city,
         r.referral_code,
         r.created_at,
         'active'::text,
         (SELECT count(*) FROM public.cases c
           WHERE COALESCE(c.partner_id, c.referred_by) = r.id),
         (SELECT count(*) FROM public.cases c
           WHERE c.partner_id = r.id AND c.commission_split_done = true),
         (SELECT COALESCE(sum(rw.amount), 0) FROM public.rewards rw
           WHERE rw.user_id = auth.uid()
             AND rw.reward_type = 'master_override'
             AND rw.source_user_id = r.id)
  FROM recruits r
  ORDER BY r.created_at DESC
$function$;

REVOKE ALL ON FUNCTION public.get_my_network() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_network() TO authenticated;

-- 8. Admin directory: expose master partner data
DROP FUNCTION IF EXISTS public.list_partner_directory();
CREATE OR REPLACE FUNCTION public.list_partner_directory()
RETURNS TABLE(partner_id uuid, full_name text, email text, phone_number text, city text, referral_code text, created_at timestamp with time zone, students_count bigint, total_earned numeric, paid_amount numeric, locked_amount numeric, available_amount numeric, open_requests bigint, open_request_amount numeric, last_request_at timestamp with time zone, is_master_partner boolean, master_partner_name text, recruited_count bigint, earned_referral numeric, earned_override numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  WITH partners AS (
    SELECT p.id, p.full_name, p.email, p.phone_number, p.city,
           p.referral_code, p.created_at,
           COALESCE(p.is_master_partner, false) AS is_master_partner,
           p.master_partner_id
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'social_media_partner'::app_role
      AND p.deleted_at IS NULL
      AND public.has_role(auth.uid(), 'admin'::app_role)
  ),
  open_req AS (
    SELECT pr.requestor_id, count(*) AS cnt, coalesce(sum(pr.amount), 0) AS amt
    FROM public.payout_requests pr
    WHERE pr.status IN ('pending', 'approved')
    GROUP BY pr.requestor_id
  ),
  last_req AS (
    SELECT pr.requestor_id, max(pr.requested_at) AS last_at
    FROM public.payout_requests pr
    GROUP BY pr.requestor_id
  ),
  requested_rewards AS (
    SELECT DISTINCT unnest(pr.linked_reward_ids) AS reward_id
    FROM public.payout_requests pr
    WHERE pr.status IN ('pending', 'approved')
  ),
  reward_agg AS (
    SELECT r.user_id,
           coalesce(sum(r.amount), 0) AS total_earned,
           coalesce(sum(r.amount) FILTER (WHERE r.status = 'paid'), 0) AS paid_amount,
           coalesce(sum(r.amount) FILTER (
             WHERE r.status <> 'paid' AND r.created_at > now() - interval '20 days'
           ), 0) AS locked_amount,
           coalesce(sum(r.amount) FILTER (
             WHERE r.status <> 'paid'
               AND r.created_at <= now() - interval '20 days'
               AND r.id NOT IN (SELECT reward_id FROM requested_rewards)
           ), 0) AS available_amount,
           coalesce(sum(r.amount) FILTER (WHERE r.reward_type = 'master_override'), 0) AS earned_override,
           coalesce(sum(r.amount) FILTER (WHERE r.reward_type <> 'master_override'), 0) AS earned_referral
    FROM public.rewards r
    GROUP BY r.user_id
  ),
  case_agg AS (
    SELECT x.pid, count(*) AS students_count
    FROM (
      SELECT coalesce(c.partner_id, c.referred_by) AS pid
      FROM public.cases c
      WHERE coalesce(c.partner_id, c.referred_by) IS NOT NULL
    ) x
    GROUP BY x.pid
  ),
  network AS (
    SELECT p2.master_partner_id AS mid, count(*) AS recruited
    FROM public.profiles p2
    WHERE p2.master_partner_id IS NOT NULL AND p2.deleted_at IS NULL
    GROUP BY p2.master_partner_id
  )
  SELECT p.id,
         p.full_name,
         p.email,
         p.phone_number,
         p.city,
         p.referral_code,
         p.created_at,
         coalesce(ca.students_count, 0),
         coalesce(ra.total_earned, 0),
         coalesce(ra.paid_amount, 0),
         coalesce(ra.locked_amount, 0),
         coalesce(ra.available_amount, 0),
         coalesce(orq.cnt, 0),
         coalesce(orq.amt, 0),
         lr.last_at,
         p.is_master_partner,
         mp.full_name,
         coalesce(nw.recruited, 0),
         coalesce(ra.earned_referral, 0),
         coalesce(ra.earned_override, 0)
  FROM partners p
  LEFT JOIN reward_agg ra ON ra.user_id = p.id
  LEFT JOIN case_agg ca ON ca.pid = p.id
  LEFT JOIN open_req orq ON orq.requestor_id = p.id
  LEFT JOIN last_req lr ON lr.requestor_id = p.id
  LEFT JOIN network nw ON nw.mid = p.id
  LEFT JOIN public.profiles mp ON mp.id = p.master_partner_id
  ORDER BY coalesce(orq.cnt, 0) DESC, coalesce(ra.available_amount, 0) DESC, p.full_name;
$function$;
