-- ============================================================
-- Repair: restore HORIZONTE's dedicated school photo (hero.jpg)
--
-- `20261005190000_school_photo_links.sql` originally shipped with an
-- unconditional `SET photos = ARRAY[building, street, view-roofs]`. Because it
-- shares timestamp 20261005190000 with
-- `20261005190000_horizonte_school_and_housing_photos.sql` and Supabase applies
-- same-timestamp migrations alphabetically, it ran AFTER that migration and
-- overwrote the school's dedicated `school/hero.jpg` with accommodation shots.
--
-- #223 removed the offending write from that file, but an in-place edit does
-- NOT re-run on a database that already recorded version 20261005190000. This
-- migration is the repair for that case, and a no-op for a fresh provision.
--
-- It deliberately matches ONLY the exact clobbered signature, so it never
-- overwrites a legitimate later edit made through the admin catalog dialog.
-- Idempotent: re-running changes nothing once the hero is restored.
-- ============================================================

UPDATE public.schools
SET photos = ARRAY['/lovable-uploads/schools/horizonte/school/hero.jpg']::text[]
WHERE slug = 'horizonte'
  AND photos = ARRAY[
    '/lovable-uploads/schools/horizonte/accommodations/building.jpg',
    '/lovable-uploads/schools/horizonte/accommodations/street.jpg',
    '/lovable-uploads/schools/horizonte/accommodations/view-roofs.jpg'
  ]::text[];

-- ── Verify, loudly ───────────────────────────────────────────────────
DO $$
DECLARE
  v_photos text[];
BEGIN
  SELECT photos INTO v_photos
  FROM public.schools
  WHERE slug = 'horizonte';

  IF NOT FOUND THEN
    RAISE WARNING 'HORIZONTE catalog school is missing; hero photo not re-asserted.';
  ELSE
    RAISE NOTICE 'HORIZONTE school photos: %', v_photos;
  END IF;
END $$;
