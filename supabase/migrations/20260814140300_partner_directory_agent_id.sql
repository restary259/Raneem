-- ════════════════════════════════════════════════════════════════════════
-- Surface profiles.agent_id on the admin partner directory so the partner
-- profile panel can show / reassign the Agent who recruited a partner or
-- ambassador. Recreates list_partner_directory() with one extra column
-- (agent_id) and an optional agent name join; otherwise identical to the live
-- definition from 20260808144751.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.list_partner_directory()
RETURNS TABLE(
  partner_id uuid,
  full_name text,
  email text,
  phone_number text,
  city text,
  referral_code text,
  created_at timestamp with time zone,
  students_count bigint,
  total_earned numeric,
  paid_amount numeric,
  locked_amount numeric,
  available_amount numeric,
  open_requests bigint,
  open_request_amount numeric,
  last_request_at timestamp with time zone,
  is_master_partner boolean,
  master_partner_name text,
  agent_id uuid,
  recruited_count bigint,
  earned_referral numeric,
  earned_override numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH partners AS (
    SELECT p.id, p.full_name, p.email, p.phone_number, p.city,
           p.referral_code, p.created_at,
           COALESCE(p.is_master_partner, false) AS is_master_partner,
           p.master_partner_id,
           p.agent_id
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
         p.agent_id,
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

REVOKE ALL ON FUNCTION public.list_partner_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_partner_directory() TO authenticated;
