-- ============================================================
-- HORIZONTE Regensburg: catalog housing links + CEFR level durations
--
-- Completes the partner-school record seeded by
-- 20261005120000_horizonte_partner_school_2026.sql. That migration added the
-- school, courses, price tiers and housing options but left two of the
-- mechanisms every other partner school uses unset:
--
--   1. `catalog_accommodation_ids` — the link the Partner Schools page uses
--      to open the matching DARB catalog row. Without it every HORIZONTE
--      housing option rendered "Not in the DARB catalog" even though the
--      catalog rows were added in the same release.
--   2. `school_level_durations` — the CEFR level lengths the level calculator
--      sums into a quote. Without it HORIZONTE quoted "0 weeks" for every
--      level, so the calculator was unusable.
--
-- Both are additive UPDATE/INSERT with guards, so re-running after a db reset
-- is safe and the original seed migration is untouched.
--
-- The housing link deliberately resolves the catalog school from
-- `schools.slug` and not from `partner_schools.catalog_school_id`: the catalog
-- school can be inserted after the partner seed ran (the seed file is edited
-- over time), which leaves `catalog_school_id` NULL and made an earlier
-- `catalog_school_id`-based join silently match zero rows. Section 0 repairs
-- that link; section 3 reports loudly if the catalog rows are missing.
-- ============================================================

-- ── 0. Repair the partner -> catalog school link ─────────────────────
-- Migration #1 set `catalog_school_id` from `schools.slug = 'horizonte'` at a
-- time when the catalog row may not have existed yet. Re-point it from the
-- slug, which is the stable key.
UPDATE public.partner_schools ps
SET catalog_school_id = s.id
FROM public.schools s
WHERE ps.slug = 'horizonte'
  AND s.slug = 'horizonte'
  AND ps.catalog_school_id IS DISTINCT FROM s.id;

-- ── 1. Catalog housing links ─────────────────────────────────────────
-- Point every HORIZONTE housing option at the existing catalog record it
-- corresponds to, using the established `catalog_accommodation_ids` mechanism
-- (same as Alpha Aktiv / GoAcademy). The catalog is the single source of
-- truth: records are matched by name, never duplicated.
UPDATE public.school_accommodations a
SET catalog_accommodation_ids = ARRAY[c.id]
FROM public.partner_schools ps,
     public.school_price_versions v,
     public.schools s,
     public.accommodations c
WHERE a.price_version_id = v.id
  AND v.school_id = ps.id
  AND ps.slug = 'horizonte'
  AND s.slug = 'horizonte'
  AND c.school_id = s.id
  AND c.name_en = CASE a.code
    WHEN 'res_single_private' THEN 'Single room with private bathroom — 4th floor (HORIZONTE residence)'
    WHEN 'res_twin_private'   THEN 'Twin room with private bathroom — 4th floor (HORIZONTE residence)'
    WHEN 'res_single_shared'  THEN 'Single room in shared apartment (HORIZONTE residence)'
    WHEN 'res_twin_shared'    THEN 'Twin room in shared apartment (HORIZONTE residence)'
    WHEN 'res_studio_one'     THEN 'Studio — one person (HORIZONTE residence)'
    WHEN 'res_studio_two'     THEN 'Studio — two people (HORIZONTE residence)'
    WHEN 'host_breakfast'     THEN 'Host family — single/twin room with breakfast'
    WHEN 'host_half_board'    THEN 'Host family — single/twin room with half-board'
  END;

-- ── 2. CEFR level durations ──────────────────────────────────────────
-- HORIZONTE states that, in its experience, approximately 10-12 weeks are
-- needed for one CEFR level (recorded on the 'registration' policy row). The
-- level calculator needs a single number per level, so the lower bound (10) is
-- stored and the published range stays on the policy note. A1-C2, matching the
-- school's published range; each level carries the same 10-week recommendation.
INSERT INTO public.school_level_durations (school_id, level, weeks, sort_order, source_name, source_document, source_year, last_verified_at, notes)
SELECT s.id, t.lvl, 10, t.ord,
  'HORIZONTE official 2026 pages',
  'horizonte-regensburg-2026',
  2026, DATE '2026-10-05',
  'HORIZONTE states approximately 10-12 weeks per CEFR level; the calculator uses the lower bound (10) and the 10-12 range stays on the registration policy note.'
FROM public.partner_schools s
CROSS JOIN (VALUES
  ('A1', 1), ('A2', 2), ('B1', 3), ('B2', 4), ('C1', 5), ('C2', 6)
) AS t(lvl, ord)
WHERE s.slug = 'horizonte'
  AND NOT EXISTS (
    SELECT 1 FROM public.school_level_durations d
    WHERE d.school_id = s.id AND d.level = t.lvl
  );

-- ── 3. Verify, loudly ────────────────────────────────────────────────
-- A link migration that matches nothing must not look like success. Report the
-- counts, and warn (do not abort - other environments may run the seed later)
-- when the catalog housing rows are absent.
DO $$
DECLARE
  v_partner int;
  v_linked int;
  v_catalog int;
BEGIN
  SELECT count(*) INTO v_partner
  FROM public.school_accommodations a
  JOIN public.school_price_versions v ON v.id = a.price_version_id
  JOIN public.partner_schools ps ON ps.id = v.school_id
  WHERE ps.slug = 'horizonte';

  SELECT count(*) INTO v_linked
  FROM public.school_accommodations a
  JOIN public.school_price_versions v ON v.id = a.price_version_id
  JOIN public.partner_schools ps ON ps.id = v.school_id
  WHERE ps.slug = 'horizonte'
    AND a.catalog_accommodation_ids IS NOT NULL;

  SELECT count(*) INTO v_catalog
  FROM public.accommodations c
  JOIN public.schools s ON s.id = c.school_id
  WHERE s.slug = 'horizonte';

  RAISE NOTICE 'HORIZONTE catalog links: % of % partner housing options linked; % catalog housing rows present', v_linked, v_partner, v_catalog;

  IF v_linked = 0 AND v_catalog = 0 THEN
    RAISE WARNING 'HORIZONTE catalog housing rows are missing. Re-run supabase/migrations/20260820000000_school_catalog_seed.sql (idempotent), then re-run this migration to link them.';
  END IF;
END $$;
