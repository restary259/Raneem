-- ============================================================
-- School photos: optional outbound link on the photo
--
-- Some schools publish a 360°/Street-View walkthrough (HORIZONTE Regensburg
-- does). The catalog photo becomes the click target for that link, so the
-- "school photo" opens the walkthrough instead of doing nothing.
--
-- `photo_link` is a nullable TEXT column on `schools`, mirroring the existing
-- `website` column: it is optional, free-form, and the UI only makes the photo
-- a link when it is set. The client only ever emits http(s) links.
--
-- The HORIZONTE catalog row was seeded with an empty `photos` array (the other
-- partner schools have photos). This fills it with the photos already shipped
-- in `public/lovable-uploads/schools/horizonte/accommodations/` and attaches
-- the school's Google Maps walkthrough.
--
-- Additive and idempotent: the column is guarded with IF NOT EXISTS and the
-- UPDATE only touches the HORIZONTE row by its stable slug.
-- ============================================================

-- ── 1. schema: optional photo link ───────────────────────────────────
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS photo_link TEXT;

COMMENT ON COLUMN public.schools.photo_link IS
  'Optional external URL (http/https) opened when the school photo is clicked, e.g. a Google Maps 360° walkthrough.';

-- ── 2. HORIZONTE: school photos + walkthrough link ───────────────────
UPDATE public.schools
SET
  photos = ARRAY[
    '/lovable-uploads/schools/horizonte/accommodations/building.jpg',
    '/lovable-uploads/schools/horizonte/accommodations/street.jpg',
    '/lovable-uploads/schools/horizonte/accommodations/view-roofs.jpg'
  ]::text[],
  photo_link = 'https://www.google.com/maps/@49.0185595,12.0934451,3a,90y,269.2h,81.1t/data=!3m8!1e1!3m6!1sCIHM0ogKEICAgICsxqrbSw!2e10!3e12!6shttps:%2F%2Flh3.googleusercontent.com%2Fgpms-cs-s%2FAM4Q-U8k0Zs-R7Ac3-HPzSml0nwGMW_Q9gI_U1V-PtA44ARtLBM9wCyC-tLmzSN6nUZvArnFj84Vziv_66_45BGF97h_kFODI_ZRs6go_EKzGdycuK7NnS2iQSxCWvH116nloopYHp8%3Dw900-h600-k-no-pi8.900000000000006-ya273.2-ro0-fo100!7i7164!8i3582?entry=ttu&g_ep=EgoyMDI2MDkzMC4wIKXMDSoASAFQAw%3D%3D'
WHERE slug = 'horizonte';

-- ── 3. Verify, loudly ────────────────────────────────────────────────
DO $$
DECLARE
  v_photos int;
  v_link text;
BEGIN
  SELECT COALESCE(array_length(photos, 1), 0), photo_link
  INTO v_photos, v_link
  FROM public.schools
  WHERE slug = 'horizonte';

  IF NOT FOUND THEN
    RAISE WARNING 'HORIZONTE catalog school is missing; photo link not applied.';
  ELSE
    RAISE NOTICE 'HORIZONTE school: % photo(s), photo_link %', v_photos,
      CASE WHEN v_link IS NULL THEN 'NOT set' ELSE 'set' END;
  END IF;
END $$;
