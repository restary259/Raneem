-- ════════════════════════════════════════════════════════════════════════
-- Commission Hub overview: exclude soft-deleted profiles from role totals
-- (KPI-017..024, MINOR)
-- ════════════════════════════════════════════════════════════════════════
-- The Hub overview role counts (team_members_total, partners_total,
-- ambassadors_total, agents_total, students_total) counted rows in user_roles
-- without joining profiles, so a soft-deleted user (profiles.deleted_at IS NOT
-- NULL) was still counted. This CREATE OR REPLACE joins user_roles to profiles
-- and adds `p.deleted_at IS NULL` so the Hub totals match the Members directory
-- (which already filters deleted_at via get_members_directory).
--
-- Because `partners_at_zero` joins the now-filtered `partners` CTE, it is also
-- affected (it no longer counts zero-override rows for deleted partners) — a
-- consistent, intended side effect of the single filtered CTE.
-- `independent_partners` and `master_partners` already filtered deleted_at
-- directly; they are unchanged. Every other field in the JSON payload is
-- byte-for-byte identical to the prior definition (20260816020000).
--
-- ⚠️ Requires Supabase admin/service-role DDL — NOT applied by the Vercel
-- frontend build or ci.yml. Run via `supabase db push` or the dashboard SQL
-- editor. The anon/authenticated JWT cannot run DDL.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_commission_hub_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_admin uuid := auth.uid(); v_result jsonb;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  WITH roles AS (
    SELECT ur.user_id, ur.role
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role IN ('team_member','social_media_partner','ambassador','agent','student')
      AND p.deleted_at IS NULL
  ),
  partners AS (
    SELECT r.user_id FROM roles r WHERE r.role IN ('social_media_partner','ambassador')
  )
  SELECT jsonb_build_object(
    'team_members_total',     (SELECT count(*) FROM roles WHERE role = 'team_member'),
    'partners_total',         (SELECT count(*) FROM partners),
    'partners_custom',        (SELECT count(*) FROM partner_commission_overrides),
    'partners_at_zero',       (SELECT count(*) FROM partners p
                                JOIN partner_commission_overrides o ON o.partner_id = p.user_id
                                WHERE o.commission_amount = 0),
    'ambassadors_total',      (SELECT count(*) FROM roles WHERE role = 'ambassador'),
    'agents_total',           (SELECT count(*) FROM roles WHERE role = 'agent'),
    'agents_custom',          (SELECT count(*) FROM agent_commission_overrides),
    'students_total',         (SELECT count(*) FROM roles WHERE role = 'student'),
    'student_overrides',      (SELECT count(*) FROM student_referral_reward_overrides),
    'independent_partners',   (SELECT count(*) FROM public.profiles p
                                JOIN roles r ON r.user_id = p.id
                                WHERE r.role IN ('social_media_partner','ambassador')
                                  AND p.agent_id IS NULL AND p.master_partner_id IS NULL
                                  AND p.deleted_at IS NULL),
    'master_partners',        (SELECT count(*) FROM public.profiles p
                                WHERE p.is_master_partner = true AND p.deleted_at IS NULL),
    'global_rates', (SELECT jsonb_build_object(
        'partner', partner_commission_rate,
        'ambassador', ambassador_commission_rate,
        'team', team_member_commission_rate,
        'master_share', master_partner_override_rate,
        'agent', agent_commission_rate,
        'agent_self_referral', agent_self_referral_rate,
        'referral_discount', referral_discount_amount,
        'student_friend_discount', student_refer_friend_discount,
        'student_friend_reward', student_refer_friend_reward,
        'student_family_discount', student_refer_family_discount,
        'student_family_reward', student_refer_family_reward
      ) FROM platform_settings LIMIT 1),
    'recent_changes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', h.id, 'entity_type', h.entity_type, 'entity_id', h.entity_id,
        'rate_kind', h.rate_kind, 'old_value', h.old_value, 'new_value', h.new_value,
        'changed_by', h.changed_by, 'changed_at', h.changed_at, 'reason', h.reason
      ) ORDER BY h.changed_at DESC)
      FROM (SELECT * FROM commission_rate_history ORDER BY changed_at DESC LIMIT 20) h
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_commission_hub_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_commission_hub_overview() TO authenticated;
