-- ═══════════════════════════════════════════════════════════════════════
-- Unified admin members directory RPC.
-- Returns a consistent column set for all staff roles (team_member, agent,
-- social_media_partner, ambassador) with role-specific KPIs.
-- Admin-only, SECURITY DEFINER, filters deleted/deactivated profiles.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_members_directory(p_role public.app_role DEFAULT NULL)
RETURNS TABLE(
  requester_id uuid,
  full_name text,
  email text,
  phone_number text,
  city text,
  created_at timestamp with time zone,
  role text,
  referral_code text,
  is_master_partner boolean,
  master_partner_id uuid,
  agent_id uuid,
  is_deactivated boolean,
  -- Team member KPIs
  assigned_cases bigint,
  enrolled_cases bigint,
  team_reward_total numeric,
  -- Agent KPIs
  recruited_count bigint,
  earned_override numeric,
  -- Partner/Ambassador KPIs
  students_count bigint,
  earned_referral numeric,
  earned_master_override numeric,
  -- Common payout KPIs
  total_earned numeric,
  paid_amount numeric,
  locked_amount numeric,
  available_amount numeric,
  open_requests bigint,
  open_request_amount numeric,
  last_request_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH base AS (
    SELECT p.id,
           p.full_name,
           p.email,
           p.phone_number,
           p.city,
           p.created_at,
           ur.role::text AS role,
           p.referral_code,
           COALESCE(p.is_master_partner, false) AS is_master_partner,
           p.master_partner_id,
           p.agent_id,
           (p.deactivated_at IS NOT NULL) AS is_deactivated
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.deleted_at IS NULL
      AND public.has_role(auth.uid(), 'admin'::app_role)
      AND (p_role IS NULL OR ur.role = p_role)
      AND ur.role IN ('team_member', 'agent', 'social_media_partner', 'ambassador')
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
             WHERE r.status <> 'paid' AND r.created_at > now() - interval '20 days'
           ), 0) AS locked_amount,
           coalesce(sum(r.amount) FILTER (
             WHERE r.status <> 'paid'
               AND r.created_at <= now() - interval '20 days'
               AND r.id NOT IN (SELECT reward_id FROM requested_rewards)
           ), 0) AS available_amount,
           coalesce(sum(r.amount) FILTER (WHERE r.reward_type = 'team'), 0) AS team_reward_total,
           coalesce(sum(r.amount) FILTER (WHERE r.reward_type = 'agent_override'), 0) AS earned_override,
           coalesce(sum(r.amount) FILTER (WHERE r.reward_type = 'referral'), 0) AS earned_referral,
           coalesce(sum(r.amount) FILTER (WHERE r.reward_type = 'master_override'), 0) AS earned_master_override
    FROM public.rewards r
    GROUP BY r.user_id
  ),
  team_cases AS (
    SELECT c.assigned_to AS tid,
           count(*) AS assigned,
           count(*) FILTER (WHERE c.status = 'enrollment_paid') AS enrolled
    FROM public.cases c
    WHERE c.assigned_to IS NOT NULL AND c.deleted_at IS NULL
    GROUP BY c.assigned_to
  ),
  agent_network AS (
    SELECT p2.agent_id AS aid, count(*) AS recruited
    FROM public.profiles p2
    WHERE p2.agent_id IS NOT NULL AND p2.deleted_at IS NULL
    GROUP BY p2.agent_id
  ),
  partner_cases AS (
    SELECT x.pid, count(*) AS students_count
    FROM (
      SELECT coalesce(c.partner_id, c.referred_by) AS pid
      FROM public.cases c
      WHERE coalesce(c.partner_id, c.referred_by) IS NOT NULL
        AND c.deleted_at IS NULL
    ) x
    GROUP BY x.pid
  ),
  master_network AS (
    SELECT p2.master_partner_id AS mid, count(*) AS recruited
    FROM public.profiles p2
    WHERE p2.master_partner_id IS NOT NULL AND p2.deleted_at IS NULL
    GROUP BY p2.master_partner_id
  )
  SELECT b.id,
         b.full_name,
         b.email,
         b.phone_number,
         b.city,
         b.created_at,
         b.role,
         b.referral_code,
         b.is_master_partner,
         b.master_partner_id,
         b.agent_id,
         b.is_deactivated,
         coalesce(tc.assigned, 0) AS assigned_cases,
         coalesce(tc.enrolled, 0) AS enrolled_cases,
         coalesce(ra.team_reward_total, 0) AS team_reward_total,
         coalesce(an.recruited, 0) AS recruited_count,
         coalesce(ra.earned_override, 0) AS earned_override,
         coalesce(pc.students_count, 0) AS students_count,
         coalesce(ra.earned_referral, 0) AS earned_referral,
         coalesce(ra.earned_master_override, 0) AS earned_master_override,
         coalesce(ra.total_earned, 0) AS total_earned,
         coalesce(ra.paid_amount, 0) AS paid_amount,
         coalesce(ra.locked_amount, 0) AS locked_amount,
         coalesce(ra.available_amount, 0) AS available_amount,
         coalesce(orq.cnt, 0) AS open_requests,
         coalesce(orq.amt, 0) AS open_request_amount,
         lr.last_at AS last_request_at
  FROM base b
  LEFT JOIN reward_agg ra ON ra.user_id = b.id
  LEFT JOIN team_cases tc ON tc.tid = b.id
  LEFT JOIN agent_network an ON an.aid = b.id
  LEFT JOIN partner_cases pc ON pc.pid = b.id
  LEFT JOIN master_network mn ON mn.mid = b.id
  LEFT JOIN open_req orq ON orq.requestor_id = b.id
  LEFT JOIN last_req lr ON lr.requestor_id = b.id
  ORDER BY b.role, coalesce(orq.cnt, 0) DESC, coalesce(ra.available_amount, 0) DESC, b.full_name;
$function$;

REVOKE ALL ON FUNCTION public.get_members_directory(app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_members_directory(app_role) TO authenticated;