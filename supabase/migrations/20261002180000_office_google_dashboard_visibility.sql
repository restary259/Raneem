-- ============================================================================
-- Google Business dashboard visibility gate
-- ============================================================================
-- The Google Business pages/tabs in the Team dashboard are hidden by default.
-- A team member only sees them once they are assigned as the PRIMARY or
-- SIDE_MANAGER operator of at least one office (Phase 4 delegation).
--
-- `has_google_business_access()` is the single boolean the UI asks for. It is
-- deliberately boolean-only: it never reveals which office or role the caller
-- holds, so it cannot be used to enumerate other members' assignments. It
-- mirrors `authorize_google_office_action()`: an assignment only counts while
-- the caller is an active team member AND still an active member of that
-- office, so a deactivated member loses the page immediately.
--
-- `office_google_operators` is added to the realtime publication so the open
-- dashboard reacts the moment an assignment is granted or revoked. RLS still
-- governs every delivered row.
--
-- Timestamp is newer than 20261002160000 (Phase 9) so this deploys last.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_google_business_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT auth.uid() IS NOT NULL
     AND public.is_active_team_member(auth.uid())
     AND EXISTS (
       SELECT 1
       FROM public.office_google_operators ogo
       JOIN public.offices o
         ON o.id = ogo.office_id AND o.deleted_at IS NULL
       JOIN public.office_members om
         ON om.office_id = ogo.office_id
        AND om.user_id = ogo.team_member_id
        AND om.is_active = true
       WHERE ogo.team_member_id = auth.uid()
     );
$fn$;

REVOKE ALL ON FUNCTION public.has_google_business_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_google_business_access() TO authenticated, service_role;

-- Realtime: the dashboard gate subscribes to this table.
DO $pub$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'office_google_operators'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.office_google_operators;
  END IF;
END $pub$;
