-- ════════════════════════════════════════════════════════════════════════
-- Role-segmented payout directories (admin).
--
-- Four new SECURITY DEFINER, STABLE, SET search_path = public functions that
-- generalize list_partner_directory() (20260808144751, later recreated with
-- agent_id by 20260814140300) to every payable role: team members, agents,
-- ambassadors and students. Each returns the SAME core payout columns
-- (total_earned / paid_amount / locked_amount / available_amount /
-- open_requests / open_request_amount / last_request_at) computed with the
-- exact reward_agg locked/available 20-day logic so KPIs match partners, plus
-- role-specific extras:
--
--   list_team_directory()      — team_member scope; assigned/closed cases.
--   list_agent_directory()     — agent scope; recruited_count via
--                                profiles.agent_id, earned_override filtered
--                                on reward_type = 'agent_override'.
--   list_ambassador_directory()— ambassador scope; students_count + earned
--                                referral (same CTEs as the partner directory).
--   list_student_directory()   — student scope, LIMITED to students that have
--                                at least one payout_requests row (students
--                                rarely have rewards); referrals made + linked
--                                cases.
--
-- The admin payout UI consumes these one directory per role. Each function is
-- admin-gated with public.has_role(auth.uid(),'admin'::app_role) inside the
-- profiles WHERE clause (the same pattern as list_partner_directory) and is
-- REVOKE'd from PUBLIC/anon then GRANT'd to authenticated.
-- ════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────
-- 1. list_team_directory()
-- ────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.list_team_directory();
CREATE OR REPLACE FUNCTION public.list_team_directory()
RETURNS TABLE(
  requester_id uuid,
  full_name text,
  email text,
  phone_number text,
  city text,
  created_at timestamp with time zone,
  total_earned numeric,
  paid_amount numeric,
  locked_amount numeric,
  available_amount numeric,
  open_requests bigint,
  open_request_amount numeric,
  last_request_at timestamp with time zone,
  assigned_cases bigint,
  closed_cases bigint,
  team_reward_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH team AS (
    SELECT p.id, p.full_name, p.email, p.phone_number, p.city, p.created_at
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'team_member'::app_role
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
           coalesce(sum(r.amount) FILTER (WHERE r.reward_type = 'team'), 0) AS team_reward_total
    FROM public.rewards r
    GROUP BY r.user_id
  ),
  team_cases AS (
    SELECT c.assigned_to AS tid,
           count(*) AS assigned,
           count(*) FILTER (WHERE c.status = 'enrollment_paid') AS closed
    FROM public.cases c
    WHERE c.assigned_to IS NOT NULL AND c.deleted_at IS NULL
    GROUP BY c.assigned_to
  )
  SELECT t.id,
         t.full_name,
         t.email,
         t.phone_number,
         t.city,
         t.created_at,
         coalesce(ra.total_earned, 0),
         coalesce(ra.paid_amount, 0),
         coalesce(ra.locked_amount, 0),
         coalesce(ra.available_amount, 0),
         coalesce(orq.cnt, 0),
         coalesce(orq.amt, 0),
         lr.last_at,
         coalesce(tc.assigned, 0),
         coalesce(tc.closed, 0),
         coalesce(ra.team_reward_total, 0)
  FROM team t
  LEFT JOIN reward_agg ra ON ra.user_id = t.id
  LEFT JOIN team_cases tc ON tc.tid = t.id
  LEFT JOIN open_req orq ON orq.requestor_id = t.id
  LEFT JOIN last_req lr ON lr.requestor_id = t.id
  ORDER BY coalesce(orq.cnt, 0) DESC, coalesce(ra.available_amount, 0) DESC, t.full_name;
$function$;

REVOKE ALL ON FUNCTION public.list_team_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_team_directory() TO authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- 2. list_agent_directory()
-- ────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.list_agent_directory();
CREATE OR REPLACE FUNCTION public.list_agent_directory()
RETURNS TABLE(
  requester_id uuid,
  full_name text,
  email text,
  phone_number text,
  city text,
  created_at timestamp with time zone,
  total_earned numeric,
  paid_amount numeric,
  locked_amount numeric,
  available_amount numeric,
  open_requests bigint,
  open_request_amount numeric,
  last_request_at timestamp with time zone,
  recruited_count bigint,
  earned_override numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH agents AS (
    SELECT p.id, p.full_name, p.email, p.phone_number, p.city, p.created_at
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'agent'::app_role
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
           coalesce(sum(r.amount) FILTER (WHERE r.reward_type = 'agent_override'), 0) AS earned_override
    FROM public.rewards r
    GROUP BY r.user_id
  ),
  agent_network AS (
    SELECT p2.agent_id AS aid, count(*) AS recruited
    FROM public.profiles p2
    WHERE p2.agent_id IS NOT NULL AND p2.deleted_at IS NULL
    GROUP BY p2.agent_id
  )
  SELECT a.id,
         a.full_name,
         a.email,
         a.phone_number,
         a.city,
         a.created_at,
         coalesce(ra.total_earned, 0),
         coalesce(ra.paid_amount, 0),
         coalesce(ra.locked_amount, 0),
         coalesce(ra.available_amount, 0),
         coalesce(orq.cnt, 0),
         coalesce(orq.amt, 0),
         lr.last_at,
         coalesce(an.recruited, 0),
         coalesce(ra.earned_override, 0)
  FROM agents a
  LEFT JOIN reward_agg ra ON ra.user_id = a.id
  LEFT JOIN agent_network an ON an.aid = a.id
  LEFT JOIN open_req orq ON orq.requestor_id = a.id
  LEFT JOIN last_req lr ON lr.requestor_id = a.id
  ORDER BY coalesce(orq.cnt, 0) DESC, coalesce(ra.available_amount, 0) DESC, a.full_name;
$function$;

REVOKE ALL ON FUNCTION public.list_agent_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_agent_directory() TO authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- 3. list_ambassador_directory()
-- ────────────────────────────────────────────────────────────────────────
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
  earned_referral numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH ambassadors AS (
    SELECT p.id, p.full_name, p.email, p.phone_number, p.city,
           p.referral_code, p.created_at
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
         coalesce(ra.earned_referral, 0)
  FROM ambassadors a
  LEFT JOIN reward_agg ra ON ra.user_id = a.id
  LEFT JOIN case_agg ca ON ca.pid = a.id
  LEFT JOIN open_req orq ON orq.requestor_id = a.id
  LEFT JOIN last_req lr ON lr.requestor_id = a.id
  ORDER BY coalesce(orq.cnt, 0) DESC, coalesce(ra.available_amount, 0) DESC, a.full_name;
$function$;

REVOKE ALL ON FUNCTION public.list_ambassador_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_ambassador_directory() TO authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- 4. list_student_directory()
--    Only students that have at least one payout_requests row appear here —
--    students rarely have rewards, so a full student list would be noise.
-- ────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.list_student_directory();
CREATE OR REPLACE FUNCTION public.list_student_directory()
RETURNS TABLE(
  requester_id uuid,
  full_name text,
  email text,
  city text,
  created_at timestamp with time zone,
  total_earned numeric,
  paid_amount numeric,
  locked_amount numeric,
  available_amount numeric,
  open_requests bigint,
  open_request_amount numeric,
  last_request_at timestamp with time zone,
  referrals_made bigint,
  linked_cases bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH students AS (
    SELECT DISTINCT p.id, p.full_name, p.email, p.city, p.created_at
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    JOIN public.payout_requests pr ON pr.requestor_id = p.id
    WHERE ur.role = 'student'::app_role
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
           ), 0) AS available_amount
    FROM public.rewards r
    GROUP BY r.user_id
  ),
  student_links AS (
    SELECT c.referred_by AS sid, count(*) AS referrals
    FROM public.cases c
    WHERE c.referred_by IS NOT NULL AND c.deleted_at IS NULL
    GROUP BY c.referred_by
  ),
  student_cases AS (
    SELECT c.student_user_id AS sid, count(*) AS linked
    FROM public.cases c
    WHERE c.student_user_id IS NOT NULL AND c.deleted_at IS NULL
    GROUP BY c.student_user_id
  )
  SELECT s.id,
         s.full_name,
         s.email,
         s.city,
         s.created_at,
         coalesce(ra.total_earned, 0),
         coalesce(ra.paid_amount, 0),
         coalesce(ra.locked_amount, 0),
         coalesce(ra.available_amount, 0),
         coalesce(orq.cnt, 0),
         coalesce(orq.amt, 0),
         lr.last_at,
         coalesce(sl.referrals, 0),
         coalesce(sc.linked, 0)
  FROM students s
  LEFT JOIN reward_agg ra ON ra.user_id = s.id
  LEFT JOIN student_links sl ON sl.sid = s.id
  LEFT JOIN student_cases sc ON sc.sid = s.id
  LEFT JOIN open_req orq ON orq.requestor_id = s.id
  LEFT JOIN last_req lr ON lr.requestor_id = s.id
  ORDER BY coalesce(orq.cnt, 0) DESC, coalesce(ra.available_amount, 0) DESC, s.full_name;
$function$;

REVOKE ALL ON FUNCTION public.list_student_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_student_directory() TO authenticated;
