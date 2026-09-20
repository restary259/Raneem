-- 1. service_catalog: only accounts that hold an app role may read, and only active entries.
DROP POLICY IF EXISTS "Signed-in users read the catalog" ON public.service_catalog;
CREATE POLICY "Roled users read active catalog entries"
ON public.service_catalog
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
);

-- 2. checklist_items: same, restrict to accounts that hold an app role.
DROP POLICY IF EXISTS "Authenticated users can view checklist items" ON public.checklist_items;
CREATE POLICY "Roled users can view checklist items"
ON public.checklist_items
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

-- 3. login_attempts: written only by the auth-guard edge function (service role, bypasses RLS).
DROP POLICY IF EXISTS "System can insert login attempts v2" ON public.login_attempts;
REVOKE INSERT ON public.login_attempts FROM anon, authenticated;

-- 4. auth_failure_log: written only by shared edge-function auth helper (service role).
DROP POLICY IF EXISTS "Anyone can record an auth failure" ON public.auth_failure_log;
REVOKE INSERT ON public.auth_failure_log FROM anon, authenticated;

-- 5. contact_submissions: public form stays open, but the written row is validated.
DROP POLICY IF EXISTS "Anyone can insert contact submissions v2" ON public.contact_submissions;
CREATE POLICY "Public contact form submissions are validated"
ON public.contact_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  form_source IS NOT NULL
  AND length(form_source) BETWEEN 1 AND 64
  AND data IS NOT NULL
  AND jsonb_typeof(data) = 'object'
  AND length(data::text) <= 8000
  AND admin_notes IS NULL
  AND (status IS NULL OR status = 'new')
);

-- 6. storage: school-assets is a public bucket (public URLs keep working),
--    but stop anonymous clients from listing/enumerating its objects.
DROP POLICY IF EXISTS "Public can view school-assets" ON storage.objects;
CREATE POLICY "Signed-in users can list school-assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'school-assets');