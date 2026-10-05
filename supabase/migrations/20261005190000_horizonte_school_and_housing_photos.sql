-- ============================================================
-- HORIZONTE Regensburg: school photo + accommodation photos
--
-- The catalog card and school hero render `schools.photos[0]`, and each
-- accommodation card renders `accommodations.photos`. The HORIZONTE rows were
-- seeded without any photos, so the catalog showed the Building2 placeholder.
--
-- This attaches the uploaded school photo and the residence photos already
-- declared in src/data/schoolCatalog/{schools,accommodations}.json (the catalog
-- seed source of truth). Paths are static assets under public/lovable-uploads/.
--
-- Idempotent: plain UPDATEs keyed by slug / name_en; re-running is a no-op
-- change. The rows are matched, never re-created.
-- ============================================================

-- ── 1. School photo ──────────────────────────────────────────────────
UPDATE public.schools
SET photos = ARRAY['/lovable-uploads/schools/horizonte/school/hero.jpg']
WHERE slug = 'horizonte';

-- ── 2. Accommodation photos ──────────────────────────────────────────
UPDATE public.accommodations a
SET photos = ARRAY['/lovable-uploads/schools/horizonte/accommodations/room-single-1.jpg', '/lovable-uploads/schools/horizonte/accommodations/room-single-2.jpg', '/lovable-uploads/schools/horizonte/accommodations/room-single-3.jpg', '/lovable-uploads/schools/horizonte/accommodations/room-single-4.jpg', '/lovable-uploads/schools/horizonte/accommodations/room-single-5.jpg', '/lovable-uploads/schools/horizonte/accommodations/room-single-6.jpg', '/lovable-uploads/schools/horizonte/accommodations/room-single-7.jpg', '/lovable-uploads/schools/horizonte/accommodations/room-single-8.jpg', '/lovable-uploads/schools/horizonte/accommodations/kitchen-4th.jpg', '/lovable-uploads/schools/horizonte/accommodations/view-roofs.jpg']
FROM public.schools s
WHERE a.school_id = s.id
  AND s.slug = 'horizonte'
  AND a.name_en = 'Single room with private bathroom — 4th floor (HORIZONTE residence)';

UPDATE public.accommodations a
SET photos = ARRAY['/lovable-uploads/schools/horizonte/accommodations/common-4th.jpg', '/lovable-uploads/schools/horizonte/accommodations/kitchen-4th.jpg', '/lovable-uploads/schools/horizonte/accommodations/view-roofs.jpg', '/lovable-uploads/schools/horizonte/accommodations/building.jpg']
FROM public.schools s
WHERE a.school_id = s.id
  AND s.slug = 'horizonte'
  AND a.name_en = 'Twin room with private bathroom — 4th floor (HORIZONTE residence)';

UPDATE public.accommodations a
SET photos = ARRAY['/lovable-uploads/schools/horizonte/accommodations/shared-kitchen.jpg', '/lovable-uploads/schools/horizonte/accommodations/balcony.jpg', '/lovable-uploads/schools/horizonte/accommodations/shared-room.jpg', '/lovable-uploads/schools/horizonte/accommodations/street.jpg']
FROM public.schools s
WHERE a.school_id = s.id
  AND s.slug = 'horizonte'
  AND a.name_en = 'Single room in shared apartment (HORIZONTE residence)';

UPDATE public.accommodations a
SET photos = ARRAY['/lovable-uploads/schools/horizonte/accommodations/shared-room.jpg', '/lovable-uploads/schools/horizonte/accommodations/shared-kitchen.jpg', '/lovable-uploads/schools/horizonte/accommodations/balcony.jpg', '/lovable-uploads/schools/horizonte/accommodations/street.jpg']
FROM public.schools s
WHERE a.school_id = s.id
  AND s.slug = 'horizonte'
  AND a.name_en = 'Twin room in shared apartment (HORIZONTE residence)';

UPDATE public.accommodations a
SET photos = ARRAY['/lovable-uploads/schools/horizonte/accommodations/studio-1.jpg', '/lovable-uploads/schools/horizonte/accommodations/studio-2.jpg']
FROM public.schools s
WHERE a.school_id = s.id
  AND s.slug = 'horizonte'
  AND a.name_en = 'Studio — one person (HORIZONTE residence)';

UPDATE public.accommodations a
SET photos = ARRAY['/lovable-uploads/schools/horizonte/accommodations/studio-2.jpg', '/lovable-uploads/schools/horizonte/accommodations/studio-1.jpg']
FROM public.schools s
WHERE a.school_id = s.id
  AND s.slug = 'horizonte'
  AND a.name_en = 'Studio — two people (HORIZONTE residence)';

UPDATE public.accommodations a
SET photos = ARRAY['/lovable-uploads/schools/horizonte/accommodations/homestay.jpg']
FROM public.schools s
WHERE a.school_id = s.id
  AND s.slug = 'horizonte'
  AND a.name_en = 'Host family — single/twin room with breakfast';

UPDATE public.accommodations a
SET photos = ARRAY['/lovable-uploads/schools/horizonte/accommodations/homestay.jpg']
FROM public.schools s
WHERE a.school_id = s.id
  AND s.slug = 'horizonte'
  AND a.name_en = 'Host family — single/twin room with half-board';

-- ── 3. Verify ────────────────────────────────────────────────────────
DO $$
DECLARE v_school int; v_acc int;
BEGIN
  SELECT coalesce(array_length(photos, 1), 0) INTO v_school
  FROM public.schools WHERE slug = 'horizonte';
  SELECT count(*) INTO v_acc
  FROM public.accommodations a
  JOIN public.schools s ON s.id = a.school_id
  WHERE s.slug = 'horizonte' AND coalesce(array_length(a.photos, 1), 0) > 0;
  RAISE NOTICE 'HORIZONTE photos: school has % photo(s); % of 8 housing options have photos', v_school, v_acc;
END $$;
