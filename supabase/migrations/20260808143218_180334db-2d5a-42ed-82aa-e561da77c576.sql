CREATE OR REPLACE FUNCTION public.list_partner_directory()
RETURNS TABLE(
  partner_id uuid,
  full_name text,
  email text,
  phone_number text,
  city text,
  referral_code text,
  created_at timestamptz,
  students_count bigint,
  total_earned numeric,
  paid_amount numeric,
  locked_amount numeric,
  available_amount numeric,
  open_requests bigint,
  open_request_amount numeric,
  last_request_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH partners AS (
    SELECT p.id, p.full_name, p.email, p.phone_number, p.city,
           p.referral_code, p.created_at
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'social_media_partner'::app_role
      AND p.deleted_at IS NULL
      AND public.has_role(auth.uid(), 'admin'::app_role)
  ),
  open_req AS (
    SELECT pr.requestor_id,
           count(*) AS cnt,
           coalesce(sum(pr.amount), 0) AS amt
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
             WHERE r.status <> 'paid'
               AND r.created_at > now() - interval '20 days'
           ), 0) AS locked_amount,
           coalesce(sum(r.amount) FILTER (
             WHERE r.status <> 'paid'
               AND r.created_at <= now() - interval '20 days'
               AND r.id NOT IN (SELECT reward_id FROM requested_rewards)
           ), 0) AS available_amount
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
         lr.last_at
  FROM partners p
  LEFT JOIN reward_agg ra ON ra.user_id = p.id
  LEFT JOIN case_agg ca ON ca.pid = p.id
  LEFT JOIN open_req orq ON orq.requestor_id = p.id
  LEFT JOIN last_req lr ON lr.requestor_id = p.id
  ORDER BY coalesce(orq.cnt, 0) DESC, coalesce(ra.available_amount, 0) DESC, p.full_name;
$$;

REVOKE ALL ON FUNCTION public.list_partner_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_partner_directory() TO authenticated;