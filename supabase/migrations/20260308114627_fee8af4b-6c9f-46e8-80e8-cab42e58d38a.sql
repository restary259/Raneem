
-- Partners can read their own commission override
CREATE POLICY "Partners can read own override"
ON public.partner_commission_overrides FOR SELECT
USING (partner_id = auth.uid());

-- Team members can read their own commission override (guard in case table doesn't exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'team_member_commission_overrides'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Team members can read own override"
      ON public.team_member_commission_overrides FOR SELECT
      USING (team_member_id = auth.uid())
    $policy$;
  END IF;
END;
$$;
