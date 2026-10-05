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
-- The HORIZONTE catalog row shipped with an empty `photos` array, and its eight
-- housing rows did too (the other three partner schools all have photos). The
-- photos are shipped under `public/lovable-uploads/schools/horizonte/` and are
-- now restored in the JSON source + regenerated seed; the guarded UPDATEs below
-- are the backfill for databases provisioned before that fix. HORIZONTE also
-- gets its Google Maps 360° walkthrough as the photo link.
--
-- Additive and idempotent: the column is guarded with IF NOT EXISTS, the photo
-- backfills only touch rows that are still empty, and everything is keyed by the
-- stable HORIZONTE slug.
-- ============================================================

-- ── 1. schema: optional photo link ───────────────────────────────────
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS photo_link TEXT;

COMMENT ON COLUMN public.schools.photo_link IS
  'Optional external URL (http/https) opened when the school photo is clicked, e.g. a Google Maps 360° walkthrough.';

-- ── 2. HORIZONTE: school photos + walkthrough link ───────────────────
-- Photos are a backfill (only when the row has none) so a later JSON/seed
-- regeneration is never clobbered; photo_link is the feature itself and is
-- always (re)applied for the HORIZONTE row.
UPDATE public.schools
SET photos = ARRAY[
  '/lovable-uploads/schools/horizonte/accommodations/building.jpg',
  '/lovable-uploads/schools/horizonte/accommodations/street.jpg',
  '/lovable-uploads/schools/horizonte/accommodations/view-roofs.jpg'
]::text[]
WHERE slug = 'horizonte'
  AND COALESCE(array_length(photos, 1), 0) = 0;

UPDATE public.schools
SET photo_link = 'https://www.google.com/maps/@49.0185595,12.0934451,3a,90y,269.2h,81.1t/data=!3m8!1e1!3m6!1sCIHM0ogKEICAgICsxqrbSw!2e10!3e12!6shttps:%2F%2Flh3.googleusercontent.com%2Fgpms-cs-s%2FAM4Q-U8k0Zs-R7Ac3-HPzSml0nwGMW_Q9gI_U1V-PtA44ARtLBM9wCyC-tLmzSN6nUZvArnFj84Vziv_66_45BGF97h_kFODI_ZRs6go_EKzGdycuK7NnS2iQSxCWvH116nloopYHp8%3Dw900-h600-k-no-pi8.900000000000006-ya273.2-ro0-fo100!7i7164!8i3582?entry=ttu&g_ep=EgoyMDI2MDkzMC4wIKXMDSoASAFQAw%3D%3D'
WHERE slug = 'horizonte';

-- ── 2b. HORIZONTE accommodation photos ───────────────────────────────
-- The generated seed (20260820000000_school_catalog_seed.sql) was committed
-- before the HORIZONTE housing rows gained their photos in
-- src/data/schoolCatalog/accommodations.json, so every HORIZONTE housing row
-- landed with photos = '{}' while the other three schools' rows have photos.
-- The files already ship under public/lovable-uploads; this restores the
-- JSON<->DB parity. Matched by name_en (the same key the partner-link
-- migration uses), additive and idempotent.
UPDATE public.accommodations AS a
SET photos = v.photos
FROM (VALUES
  ('Single room with private bathroom — 4th floor (HORIZONTE residence)',
   ARRAY['/lovable-uploads/schools/horizonte/accommodations/room-single-1.jpg','/lovable-uploads/schools/horizonte/accommodations/room-single-2.jpg','/lovable-uploads/schools/horizonte/accommodations/room-single-3.jpg','/lovable-uploads/schools/horizonte/accommodations/room-single-4.jpg','/lovable-uploads/schools/horizonte/accommodations/room-single-5.jpg','/lovable-uploads/schools/horizonte/accommodations/room-single-6.jpg','/lovable-uploads/schools/horizonte/accommodations/room-single-7.jpg','/lovable-uploads/schools/horizonte/accommodations/room-single-8.jpg','/lovable-uploads/schools/horizonte/accommodations/kitchen-4th.jpg','/lovable-uploads/schools/horizonte/accommodations/view-roofs.jpg']::text[]),
  ('Twin room with private bathroom — 4th floor (HORIZONTE residence)',
   ARRAY['/lovable-uploads/schools/horizonte/accommodations/common-4th.jpg','/lovable-uploads/schools/horizonte/accommodations/kitchen-4th.jpg','/lovable-uploads/schools/horizonte/accommodations/view-roofs.jpg','/lovable-uploads/schools/horizonte/accommodations/building.jpg']::text[]),
  ('Single room in shared apartment (HORIZONTE residence)',
   ARRAY['/lovable-uploads/schools/horizonte/accommodations/shared-kitchen.jpg','/lovable-uploads/schools/horizonte/accommodations/balcony.jpg','/lovable-uploads/schools/horizonte/accommodations/shared-room.jpg','/lovable-uploads/schools/horizonte/accommodations/street.jpg']::text[]),
  ('Twin room in shared apartment (HORIZONTE residence)',
   ARRAY['/lovable-uploads/schools/horizonte/accommodations/shared-room.jpg','/lovable-uploads/schools/horizonte/accommodations/shared-kitchen.jpg','/lovable-uploads/schools/horizonte/accommodations/balcony.jpg','/lovable-uploads/schools/horizonte/accommodations/street.jpg']::text[]),
  ('Studio — one person (HORIZONTE residence)',
   ARRAY['/lovable-uploads/schools/horizonte/accommodations/studio-1.jpg','/lovable-uploads/schools/horizonte/accommodations/studio-2.jpg']::text[]),
  ('Studio — two people (HORIZONTE residence)',
   ARRAY['/lovable-uploads/schools/horizonte/accommodations/studio-2.jpg','/lovable-uploads/schools/horizonte/accommodations/studio-1.jpg']::text[]),
  ('Host family — single/twin room with breakfast',
   ARRAY['/lovable-uploads/schools/horizonte/accommodations/homestay.jpg']::text[]),
  ('Host family — single/twin room with half-board',
   ARRAY['/lovable-uploads/schools/horizonte/accommodations/homestay.jpg']::text[])
) AS v(name_en, photos)
WHERE a.name_en = v.name_en
  AND a.school_id = (SELECT id FROM public.schools WHERE slug = 'horizonte')
  AND COALESCE(array_length(a.photos, 1), 0) = 0;

-- ── 3. Verify, loudly ────────────────────────────────────────────────
DO $$
DECLARE
  v_photos int;
  v_link text;
  v_accom_missing int;
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

  SELECT count(*) INTO v_accom_missing
  FROM public.accommodations a
  WHERE a.school_id = (SELECT id FROM public.schools WHERE slug = 'horizonte')
    AND COALESCE(array_length(a.photos, 1), 0) = 0;

  IF v_accom_missing > 0 THEN
    RAISE WARNING 'HORIZONTE still has % accommodation row(s) without photos.', v_accom_missing;
  END IF;
END $$;
