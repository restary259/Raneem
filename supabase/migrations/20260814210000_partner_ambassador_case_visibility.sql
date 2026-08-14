-- Fix: ambassadors were invisible to the partner/ambassador dashboard.
--
-- The partner dashboard (PartnerOverviewPage / PartnerStudentsPage /
-- PartnerEarningsPage) is shared by BOTH `social_media_partner` (lawyers) and
-- `ambassador` (influencers) roles — they share the `/partner/*` routes
-- (App.tsx) and the same sidebar (DashboardLayout PARTNER_BASE_NAV). All
-- three pages read their case list + KPI counts through `get_partner_pool_cases`.
--
-- But `get_partner_pool_cases` only gated on
--   has_role(auth.uid(), 'social_media_partner')
-- so an ambassador (role = 'ambassador') ALWAYS got an empty set, even when a
-- case was correctly attributed to them (cases.partner_id = ambassador) and
-- Admin could see it. The ambassador's "Students registered" / KPI / case list
-- therefore never updated after a referral — the exact reported symptom.
--
-- Fix: accept BOTH roles. This is additive (ambassadors gain visibility they
-- should already have had); partners are unaffected. The ownership scoping
-- (partner_id = auth.uid() OR referred_by = auth.uid() OR pool-mode global)
-- is unchanged, so an ambassador still only ever sees cases attributed to
-- themselves (or the agency pool when enabled) — never another ambassador's.
--
-- Security: SECURITY DEFINER + search_path public unchanged; no RLS weakened;
-- no new grants (still `authenticated` only, revoked from anon/public).

CREATE OR REPLACE FUNCTION public.get_partner_pool_cases(p_sources text[] DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  full_name text,
  status text,
  source text,
  created_at timestamptz,
  education_level text,
  degree_interest text,
  partner_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.full_name, c.status, c.source, c.created_at,
         c.education_level, c.degree_interest, c.partner_id
  FROM public.cases c
  WHERE c.deleted_at IS NULL
    AND (
      public.has_role(auth.uid(), 'social_media_partner'::app_role)
      OR public.has_role(auth.uid(), 'ambassador'::app_role)
    )
    AND (
      p_sources IS NULL
      OR c.source = ANY(p_sources)
    )
    AND (
      c.partner_id = auth.uid()
      OR c.referred_by = auth.uid()
      OR COALESCE(
        (SELECT ps.partner_dashboard_show_all_cases FROM public.platform_settings ps LIMIT 1),
        false
      ) = true
    )
$$;

REVOKE ALL ON FUNCTION public.get_partner_pool_cases(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_pool_cases(text[]) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- Agent KPI / student-list consistency.
--
-- `get_my_agent_network` returned `students_count` using
--   COALESCE(c.partner_id, c.referred_by) = r.id
-- while `paid_cases` used only `c.partner_id = r.id`. The recruit's id can
-- only ever appear in `cases.partner_id` (a partner/ambassador referral
-- resolves to partner_id, never referred_by — referred_by is reserved for
-- student-to-student referrals), so the COALESCE was a no-op for real recruits
-- but created a KPI-vs-list mismatch: the count could in principle include a
-- `referred_by`-attributed row that the agent's cases SELECT policy and the
-- AgentStudentsPage `.in('partner_id', ...)` filter do not surface. Align the
-- count to the same `partner_id` basis used everywhere else so the KPI can
-- never exceed what the agent can actually see. Behaviour is unchanged for
-- every real recruit (their cases are partner_id-attributed).
CREATE OR REPLACE FUNCTION public.get_my_agent_network()
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
  override_earned numeric,
  agent_amount integer,
  role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH me AS (
    SELECT id FROM public.profiles
    WHERE id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'agent')
  ),
  recruits AS (
    SELECT p.id, p.full_name, p.email, p.city, p.referral_code, p.created_at
    FROM public.profiles p
    JOIN me ON p.agent_id = me.id
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
           WHERE c.partner_id = r.id),
         (SELECT count(*) FROM public.cases c
           WHERE c.partner_id = r.id AND c.commission_split_done = true),
         (SELECT COALESCE(sum(rw.amount), 0) FROM public.rewards rw
           WHERE rw.user_id = auth.uid()
             AND rw.reward_type = 'agent_override'
             AND rw.source_user_id = r.id),
         COALESCE((SELECT eas.agent_amount FROM public.get_effective_agent_split(auth.uid(), r.id) eas), 0),
         COALESCE((SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = r.id AND ur.role IN ('social_media_partner','ambassador') LIMIT 1), 'social_media_partner')
  FROM recruits r
  ORDER BY r.created_at DESC
$function$;

REVOKE ALL ON FUNCTION public.get_my_agent_network() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_agent_network() TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- backfill_case_attribution: retroactively attach referral attribution to an
-- existing case that was created WITHOUT it (e.g. an earlier contact_form /
-- apply_page submission that the same student later re-submits through a
-- partner's referral link).
--
-- Why this is a SECURITY DEFINER RPC and not a direct UPDATE from the
-- create-case-from-apply edge function:
--   The `restrict_cases_financial_columns` BEFORE UPDATE trigger guards
--   partner_id / referred_by / source_attribution_method against non-admin
--   writes. A service-role Edge Function write has auth.uid() = NULL, so
--   has_role(NULL,'admin') = false and the trigger would RAISE on a guarded
--   column change. This RPC sets the trusted `app.internal_commission_split`
--   GUC (the same escape hatch `record_case_commission` uses) so the trigger
--   permits the backfill, exactly like the commission split does.
--
-- Security:
--   * Backfill is ADDITIVE ONLY — a column is set only when it is currently
--     NULL, so a later submission can never steal or overwrite an attribution
--     already on the case (no re-attribution / no hijacking another partner).
--   * Granted to the service_role only — the only legitimate caller is the
--     create-case-from-apply Edge Function (service-role key). Anon and
--     authenticated cannot invoke it, so no dashboard client can rewrite
--     attribution.
--   * All attribution values passed in are ALREADY server-resolved by the
--     edge function (from the JWT / resolve_referral_code), never client-
--     supplied-trusted.

CREATE OR REPLACE FUNCTION public.backfill_case_attribution(
  p_case_id uuid,
  p_partner_id uuid DEFAULT NULL,
  p_referred_by uuid DEFAULT NULL,
  p_attribution_method text DEFAULT NULL
)
RETURNS TABLE(partner_id uuid, referred_by uuid, source_attribution_method text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_existing RECORD;
  v_patch jsonb := '{}'::jsonb;
BEGIN
  IF p_case_id IS NULL THEN
    RETURN;
  END IF;

  SELECT partner_id, referred_by, source_attribution_method
    INTO v_existing
  FROM public.cases
  WHERE id = p_case_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Additive only: never overwrite an existing attribution.
  IF p_partner_id IS NOT NULL AND v_existing.partner_id IS NULL THEN
    v_patch := v_patch || jsonb_build_object('partner_id', p_partner_id);
  END IF;
  IF p_referred_by IS NOT NULL AND v_existing.referred_by IS NULL THEN
    v_patch := v_patch || jsonb_build_object('referred_by', p_referred_by);
  END IF;
  IF p_attribution_method IS NOT NULL AND v_existing.source_attribution_method IS NULL THEN
    v_patch := v_patch || jsonb_build_object('source_attribution_method', p_attribution_method);
  END IF;

  IF v_patch = '{}'::jsonb THEN
    RETURN QUERY SELECT v_existing.partner_id, v_existing.referred_by, v_existing.source_attribution_method;
    RETURN;
  END IF;

  -- Trusted internal write: bypass the financial-column guard for this update.
  PERFORM set_config('app.internal_commission_split', 'on', true);
  UPDATE public.cases
    SET partner_id                = COALESCE((v_patch->>'partner_id')::uuid, partner_id),
        referred_by               = COALESCE((v_patch->>'referred_by')::uuid, referred_by),
        source_attribution_method = COALESCE(v_patch->>'source_attribution_method', source_attribution_method)
    WHERE id = p_case_id;
  PERFORM set_config('app.internal_commission_split', 'off', true);

  RETURN QUERY
    SELECT c.partner_id, c.referred_by, c.source_attribution_method
    FROM public.cases c
    WHERE c.id = p_case_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.backfill_case_attribution(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_case_attribution(uuid, uuid, uuid, text) TO service_role;
