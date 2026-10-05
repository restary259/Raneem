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
-- ============================================================

-- ── 1. Catalog housing links ─────────────────────────────────────────
-- Point every HORIZONTE housing option at the existing catalog record it
-- corresponds to, using the established `catalog_accommodation_ids` mechanism
-- (same as Alpha Aktiv / GoAcademy). The catalog is the single source of
-- truth: records are matched by name, never duplicated.
UPDATE public.school_accommodations a
SET catalog_accommodation_ids = ARRAY[c.id]
FROM public.schools s
JOIN public.accommodations c ON c.school_id = s.id
JOIN public.partner_schools ps ON ps.catalog_school_id = s.id
JOIN public.school_price_versions v ON v.school_id = ps.id
WHERE a.price_version_id = v.id
  AND s.slug = 'horizonte'
  AND ps.slug = 'horizonte'
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
-- HORIZONTE states that, in its experience, approximately 10–12 weeks are
-- needed for one CEFR level (recorded on the 'registration' policy row). The
-- level calculator needs a single number per level, so the lower bound (10) is
-- stored and the published range stays on the policy note. A1–C2, matching the
-- school's published range; each level carries the same 10-week recommendation.
INSERT INTO public.school_level_durations (school_id, level, weeks, sort_order, source_name, source_document, source_year, last_verified_at, notes)
SELECT s.id, t.lvl, 10, t.ord,
  'HORIZONTE official 2026 pages',
  'horizonte-regensburg-2026',
  2026, DATE '2026-10-05',
  'HORIZONTE states approximately 10–12 weeks per CEFR level; the calculator uses the lower bound (10) and the 10–12 range stays on the registration policy note.'
FROM public.partner_schools s
CROSS JOIN (VALUES
  ('A1', 1), ('A2', 2), ('B1', 3), ('B2', 4), ('C1', 5), ('C2', 6)
) AS t(lvl, ord)
WHERE s.slug = 'horizonte'
  AND NOT EXISTS (
    SELECT 1 FROM public.school_level_durations d
    WHERE d.school_id = s.id AND d.level = t.lvl
  );
