-- ════════════════════════════════════════════════════════════════════════
-- Surface profiles.agent_id on the admin ambassador directory so the profile
-- panel can show / reassign the Agent who recruited an ambassador. Recreates
-- list_ambassador_directory() with one appended column (agent_id); otherwise
-- identical to the definition from 20260814150000.
-- ════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.list_ambassador_directory();
CREATE OR REPLACE FUNCTION public.list_ambassador_directory()
RETURNS TABLE(
  requester_id uuid,
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
  earned_referral numeric,
  agent_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH ambassadors AS (
    SELECT p.id, p.full_name, p.email, p.phone_number, p.city,
           p.referral_code, p.created_at, p.agent_id
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'ambassador'::app_role
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
           coalesce(sum(r.amount) FILTER (WHERE r.reward_type = 'referral'), 0) AS earned_referral
    FROM public.rewards r
    GROUP BY r.user_id
  ),
  case_agg AS (
    SELECT x.pid, count(*) AS students_count
    FROM (
      SELECT coalesce(c.partner_id, c.referred_by) AS pid
      FROM public.cases c
      WHERE coalesce(c.partner_id, c.referred_by) IS NOT NULL
        AND c.deleted_at IS NULL
    ) x
    GROUP BY x.pid
  )
  SELECT a.id,
         a.full_name,
         a.email,
         a.phone_number,
         a.city,
         a.referral_code,
         a.created_at,
         coalesce(ca.students_count, 0),
         coalesce(ra.total_earned, 0),
         coalesce(ra.paid_amount, 0),
         coalesce(ra.locked_amount, 0),
         coalesce(ra.available_amount, 0),
         coalesce(orq.cnt, 0),
         coalesce(orq.amt, 0),
         lr.last_at,
         coalesce(ra.earned_referral, 0),
         a.agent_id
  FROM ambassadors a
  LEFT JOIN reward_agg ra ON ra.user_id = a.id
  LEFT JOIN case_agg ca ON ca.pid = a.id
  LEFT JOIN open_req orq ON orq.requestor_id = a.id
  LEFT JOIN last_req lr ON lr.requestor_id = a.id
  ORDER BY coalesce(orq.cnt, 0) DESC, coalesce(ra.available_amount, 0) DESC, a.full_name;
$function$;

REVOKE ALL ON FUNCTION public.list_ambassador_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_ambassador_directory() TO authenticated;
