-- ── accommodation_photos ─────────────────────────────────────────────────
-- Photos for accommodations, shown on the read-only Team Catalog page and
-- managed (upload/reorder/delete) by admins from inside AdminProgramsPage.
-- Photos are stored in the private `accommodation-photos` storage bucket and
-- served via signed URLs (matches the student-documents convention).
--
-- Requires Supabase admin/service-role DDL access. NOT applied by the Vercel
-- frontend build or the ci.yml workflow. Run via `supabase db push` or the
-- Supabase dashboard SQL editor.

CREATE TABLE IF NOT EXISTS public.accommodation_photos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id UUID NOT NULL REFERENCES public.accommodations(id) ON DELETE CASCADE,
  storage_path     TEXT NOT NULL,
  display_order    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accommodation_photos_accommodation
  ON public.accommodation_photos(accommodation_id);

ALTER TABLE public.accommodation_photos ENABLE ROW LEVEL SECURITY;

-- Authenticated (team members) can read photos to render the catalog slideshow.
CREATE POLICY "authenticated_read_accommodation_photos"
  ON public.accommodation_photos FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Admins manage photos (upload / reorder / delete) from AdminProgramsPage.
CREATE POLICY "admin_insert_accommodation_photos"
  ON public.accommodation_photos FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_update_accommodation_photos"
  ON public.accommodation_photos FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_delete_accommodation_photos"
  ON public.accommodation_photos FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accommodation_photos TO authenticated;

-- ── Atomic photo reorder (swap display_order of two photos in one txn) ───
-- Prevents the non-atomic two-UPDATE race where a failed second UPDATE
-- leaves both rows sharing the same display_order. SECURITY DEFINER so the
-- caller (admin) doesn't need direct UPDATE on rows they might not own via
-- standard RLS in edge cases; the function verifies both photos belong to
-- the same accommodation and the caller is an admin before swapping.
CREATE OR REPLACE FUNCTION public.swap_accommodation_photo_order(
  p_photo_id_a UUID,
  p_photo_id_b UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a RECORD;
  v_b RECORD;
BEGIN
  SELECT accommodation_id, display_order INTO v_a
    FROM public.accommodation_photos WHERE id = p_photo_id_a;
  SELECT accommodation_id, display_order INTO v_b
    FROM public.accommodation_photos WHERE id = p_photo_id_b;

  IF v_a.accommodation_id IS NULL OR v_b.accommodation_id IS NULL THEN
    RAISE EXCEPTION 'One or both photos not found';
  END IF;
  IF v_a.accommodation_id <> v_b.accommodation_id THEN
    RAISE EXCEPTION 'Cannot swap photos from different accommodations';
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can reorder photos';
  END IF;

  -- Swap in a single transaction: both UPDATEs commit or neither does.
  UPDATE public.accommodation_photos
    SET display_order = v_b.display_order WHERE id = p_photo_id_a;
  UPDATE public.accommodation_photos
    SET display_order = v_a.display_order WHERE id = p_photo_id_b;
END;
$$;

GRANT EXECUTE ON FUNCTION public.swap_accommodation_photo_order(UUID, UUID) TO authenticated;

-- ── Private storage bucket ──────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('accommodation-photos', 'accommodation-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated can read (signed URLs are issued by the server; RLS still
-- gates the bucket read so an unauthenticated viewer cannot fetch a raw path).
CREATE POLICY "authenticated_read_accommodation_photos_storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'accommodation-photos' AND auth.role() = 'authenticated');

-- Admins upload + delete objects.
CREATE POLICY "admin_upload_accommodation_photos_storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'accommodation-photos' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_delete_accommodation_photos_storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'accommodation-photos' AND public.has_role(auth.uid(), 'admin'::app_role));
