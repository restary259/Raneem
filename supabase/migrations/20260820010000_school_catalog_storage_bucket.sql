-- School catalog: public storage bucket for school/program/accommodation/insurance photos
--
-- The seeded catalog photos live under /lovable-uploads/schools/... (Vite public assets,
-- bundled into the deployed build), so they render with zero storage setup. This bucket
-- is for photos the admin adds later via the admin PhotoUploader, which stores public URLs
-- in the `photos text[]` columns:
--   https://<ref>.supabase.co/storage/v1/object/public/school-assets/<path>
--
-- Bucket is PUBLIC (photos must render on the public marketing/student pages with no auth).
-- WRITE is admin-only (admin insert/update/delete); anyone may read.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('school-assets', 'school-assets', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Everyone (anon + authenticated) can read public school photos.
CREATE POLICY "Public can view school-assets" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'school-assets');

-- Only admins can upload / replace / delete photos.
CREATE POLICY "Admins can insert school-assets" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'school-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update school-assets" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'school-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete school-assets" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'school-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));