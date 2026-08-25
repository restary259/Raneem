CREATE OR REPLACE FUNCTION public.is_admin_session()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
     AND (
       COALESCE(auth.jwt() ->> 'aal', '') = 'aal2'
       OR NOT EXISTS (
         SELECT 1 FROM auth.mfa_factors f
         WHERE f.user_id = auth.uid() AND f.status = 'verified'
       )
     );
$$;

REVOKE ALL ON FUNCTION public.is_admin_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_session() TO authenticated, service_role;

DO $do$
DECLARE
  r record;
  new_qual text;
  new_check text;
  needle text := 'has_role(auth.uid(), ''admin''::app_role)';
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual LIKE '%' || needle || '%' OR with_check LIKE '%' || needle || '%')
  LOOP
    new_qual  := replace(COALESCE(r.qual, ''), needle, 'is_admin_session()');
    new_check := replace(COALESCE(r.with_check, ''), needle, 'is_admin_session()');

    EXECUTE format(
      'ALTER POLICY %I ON %I.%I %s %s',
      r.policyname, r.schemaname, r.tablename,
      CASE WHEN r.qual IS NULL THEN '' ELSE 'USING (' || new_qual || ')' END,
      CASE WHEN r.with_check IS NULL THEN '' ELSE 'WITH CHECK (' || new_check || ')' END
    );
  END LOOP;
END
$do$;