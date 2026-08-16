-- ── Seed: Academy of Languages (F+U) Heidelberg accommodations ──────────
-- Scraped from academy-languages.com accommodation page. Inserts a school
-- (if not already present) and 10 accommodations across 6 categories (A–E)
-- with weekly price tiers, location/equipment info, deposit, and reference
-- photo URLs in the legacy photos[] column (used as a fallback display
-- source by the catalog UI when no bucket photos are uploaded yet).
--
-- Idempotent: unique indexes on schools(name_en) and
-- accommodations(school_id, name_en) make ON CONFLICT targeted and safe
-- to re-run — duplicates are silently skipped.
--
-- Requires Supabase admin/service-role DDL access. NOT applied by the Vercel
-- frontend build or ci.yml. Run via `supabase db push` or the dashboard
-- SQL editor.

-- ── 1. Unique constraints (so ON CONFLICT has a real target) ─────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_name_en
  ON public.schools (name_en);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accommodations_school_name_en
  ON public.accommodations (school_id, name_en);

-- ── 2. School ────────────────────────────────────────────────────────────
INSERT INTO public.schools (name_en, name_ar, city, country, is_active)
VALUES (
  'Academy of Languages (F+U)',
  'أكاديمية اللغات (F+U)',
  'Heidelberg',
  'Germany',
  true
)
ON CONFLICT (name_en) DO NOTHING;

-- ── 3. Helper: resolve the school id once ────────────────────────────────
DO $$
DECLARE
  v_school_id uuid;
BEGIN
  SELECT id INTO v_school_id
  FROM public.schools
  WHERE name_en = 'Academy of Languages (F+U)'
  LIMIT 1;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'School not found after insert';
  END IF;

  -- ── Category E: Flats with private bathroom and pantry kitchen ────────
  -- Accommodation 1: F+U Bildungscampus - Kurfürstenanlage 70 (Bergheim)
  INSERT INTO public.accommodations (
    name_en, name_ar, currency, description, school_id, room_type,
    deposit, placement_fee, distance_note, price_tiers, photos, is_active
  )
  VALUES (
    'Category E – F+U Bildungscampus Bergheim (Kurfürstenanlage 70)',
    'الفئة E – حرم F+U التعليمي بيرغهايم (Kurfürstenanlage 70)',
    'EUR',
    'Private bathroom and pantry kitchen. Located in the old town centre and Bergheim, 0.5-1.7 km from the school (8-20 min walk, ~8 min by public transport). Each room has a bed, wardrobe, desk, chair, private kitchenette, and bathroom with shower, WC and washbasin.',
    v_school_id,
    'Single / Double room, private bathroom, private kitchenette',
    200, 130,
    '0.5-1.7 km from school · 8-20 min walk · ~8 min public transport',
    '[{"from_weeks":1,"to_weeks":6,"price":355},{"from_weeks":7,"to_weeks":16,"price":305},{"from_weeks":17,"to_weeks":29,"price":250},{"from_weeks":30,"to_weeks":null,"price":240}]'::jsonb,
    ARRAY[
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Zimmer2_052-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Zimmer2_057-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Aussen_ADN6438_2-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Zimmer1_041-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Zimmer2_049-768x512.jpg'
    ],
    true
  )
  ON CONFLICT (school_id, name_en) DO NOTHING;

  -- Accommodation 2: Märzgasse - Heidelberg Old Town (Category E)
  INSERT INTO public.accommodations (
    name_en, name_ar, currency, description, school_id, room_type,
    deposit, placement_fee, distance_note, price_tiers, photos, is_active
  )
  VALUES (
    'Category E – Märzgasse Old Town',
    'الفئة E – مارتسغاسه البلدة القديمة',
    'EUR',
    'Private bathroom and pantry kitchen. Located in Heidelberg''s old town centre, 0.5-1.7 km from the school (8-20 min walk, ~8 min by public transport). Each room has a bed, wardrobe, desk, chair, private kitchenette, and bathroom with shower, WC and washbasin.',
    v_school_id,
    'Single / Double room, private bathroom, private kitchenette',
    200, 130,
    '0.5-1.7 km from school · 8-20 min walk · ~8 min public transport',
    '[{"from_weeks":1,"to_weeks":6,"price":355},{"from_weeks":7,"to_weeks":16,"price":305},{"from_weeks":17,"to_weeks":29,"price":250},{"from_weeks":30,"to_weeks":null,"price":240}]'::jsonb,
    ARRAY[
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Maerzgasse_26_Zimmer3_023-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Maerzgasse_26_Zimmer3_025-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Maerzgasse_26_Zimmer3_027-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/IMG_2081-768x512.jpg'
    ],
    true
  )
  ON CONFLICT (school_id, name_en) DO NOTHING;

  -- ── Category D: One-bedroom flats ─────────────────────────────────────
  INSERT INTO public.accommodations (
    name_en, name_ar, currency, description, school_id, room_type,
    deposit, placement_fee, distance_note, price_tiers, photos, is_active
  )
  VALUES (
    'Category D – One-bedroom flat (Kurfürstenanlage 70)',
    'الفئة D – شقة غرفة واحدة (Kurfürstenanlage 70)',
    'EUR',
    'One-bedroom flat with shared kitchen. Located in Bergheim, 1.7 km from the school (8-20 min walk, ~8 min by public transport). Each room has a bed, wardrobe, desk, chair, and private bathroom with shower, toilet, and sink. Kitchen is shared with other language students.',
    v_school_id,
    'Single room, private bathroom, shared kitchen',
    200, 130,
    '1.7 km from school · 8-20 min walk · ~8 min public transport',
    '[{"from_weeks":1,"to_weeks":6,"price":320},{"from_weeks":7,"to_weeks":16,"price":285},{"from_weeks":17,"to_weeks":29,"price":240},{"from_weeks":30,"to_weeks":null,"price":225}]'::jsonb,
    ARRAY[
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Zimmer1_032-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Zimmer1_037-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Zimmer1_041-1-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Aussen_ADN6432_2-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Kueche_043-768x512.jpg'
    ],
    true
  )
  ON CONFLICT (school_id, name_en) DO NOTHING;

  -- ── Category C: Living in the old town ────────────────────────────────
  INSERT INTO public.accommodations (
    name_en, name_ar, currency, description, school_id, room_type,
    deposit, placement_fee, distance_note, price_tiers, photos, is_active
  )
  VALUES (
    'Category C – Märzgasse Old Town (two-room flat)',
    'الفئة C – مارتسغاسه البلدة القديمة (شقة غرفتين)',
    'EUR',
    'Two-room small flat in Heidelberg''s old town, ~500 m from the school (8-10 min walk). Residents share a pantry kitchen and a modern bathroom with washbasin, shower and WC.',
    v_school_id,
    'Single / Double room, shared pantry kitchen, shared bathroom',
    200, 130,
    '~500 m from school · 8-10 min walk',
    '[{"from_weeks":1,"to_weeks":6,"price":315},{"from_weeks":7,"to_weeks":16,"price":270},{"from_weeks":17,"to_weeks":29,"price":220},{"from_weeks":30,"to_weeks":null,"price":210}]'::jsonb,
    ARRAY[
      'https://academy-languages.com/wp-content/uploads/2026/02/IMG_2081-1-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Maerzgasse_26_Zimmer1_005-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Maerzgasse_26_Zimmer1_008-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Maerzgasse_26_Zimmer1_012-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Maerzgasse_26_Zimmer2_021-768x512.jpg'
    ],
    true
  )
  ON CONFLICT (school_id, name_en) DO NOTHING;

  -- ── Category B+: Private bathroom and shared kitchen ──────────────────
  INSERT INTO public.accommodations (
    name_en, name_ar, currency, description, school_id, room_type,
    deposit, placement_fee, distance_note, price_tiers, photos, is_active
  )
  VALUES (
    'Category B+ – Franz-Marc-Straße 19',
    'الفئة B+ – شارع فرانز مارك 19',
    'EUR',
    'Private bathroom with shared kitchen. Within 18 minutes by tram to the Academy of Languages at Bismarckplatz (every 10 minutes). Each room has its own bathroom, bed, wardrobe, desk, and chair. Kitchen is shared. Washing machines and dryers available.',
    v_school_id,
    'Single room, private bathroom, shared kitchen',
    200, 130,
    '~18 min by tram to Bismarckplatz · tram every 10 min',
    '[{"from_weeks":1,"to_weeks":6,"price":265},{"from_weeks":7,"to_weeks":16,"price":245},{"from_weeks":17,"to_weeks":29,"price":210},{"from_weeks":30,"to_weeks":null,"price":210}]'::jsonb,
    ARRAY[
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Franz-Marc-Strasse_19_Kueche_a-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Franz-Marc-Strasse_19_Zimmer-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Franz-Marc-Strasse_19_Aussen_ADN6498-768x512.jpg'
    ],
    true
  )
  ON CONFLICT (school_id, name_en) DO NOTHING;

  -- ── Category B: Shared kitchen and private shower ─────────────────────
  INSERT INTO public.accommodations (
    name_en, name_ar, currency, description, school_id, room_type,
    deposit, placement_fee, distance_note, price_tiers, photos, is_active
  )
  VALUES (
    'Category B – Schmitt, Heidelberg Kirchheim (Schmitthennerstr. 1)',
    'الفئة B – شميت، هايدلبرغ كيرشهايم (Schmitthennerstr. 1)',
    'EUR',
    'Shared kitchen and private shower. Located 5 km from the school (15-25 min by public transport). Communal kitchen is a central meeting point. Toilet on the same floor. Each room has a bed, wardrobe, desk, chair, Wi-Fi, refrigerator, shower, and sink.',
    v_school_id,
    'Single / Double room, private shower, shared kitchen & WC',
    200, 130,
    '5 km from school · 15-25 min public transport',
    '[{"from_weeks":1,"to_weeks":6,"price":215},{"from_weeks":7,"to_weeks":16,"price":205},{"from_weeks":17,"to_weeks":29,"price":190},{"from_weeks":30,"to_weeks":null,"price":180}]'::jsonb,
    ARRAY[
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Schmitthennerstr_1_Aussen_ADN6457-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Schmitthennerstr_1_Kueche_077-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Schmitthennerstr_1_Zimmer2_071-768x512.jpg'
    ],
    true
  )
  ON CONFLICT (school_id, name_en) DO NOTHING;

  -- ── Category A: Shared flat with international students ───────────────
  -- A-1: Schmitt hall of residence
  INSERT INTO public.accommodations (
    name_en, name_ar, currency, description, school_id, room_type,
    deposit, placement_fee, distance_note, price_tiers, photos, is_active
  )
  VALUES (
    'Category A – Schmitt hall of residence (Schmitthennerstr. 1)',
    'الفئة A – سكن شميت (Schmitthennerstr. 1)',
    'EUR',
    'Shared flat with international language students. Located 5-7 km from the school (25-30 min by public transport). Communal kitchen is a central meeting point. Residents share showers and toilets. Rooms have a wardrobe, bed, chair, desk, refrigerator, and sink.',
    v_school_id,
    'Single room, shared kitchen/bathroom/shower',
    200, 130,
    '5-7 km from school · 25-30 min public transport',
    '[{"from_weeks":1,"to_weeks":6,"price":200},{"from_weeks":7,"to_weeks":16,"price":185},{"from_weeks":17,"to_weeks":29,"price":165},{"from_weeks":30,"to_weeks":null,"price":155}]'::jsonb,
    ARRAY[
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Schmitthennerstr_1_Aussen_ADN6456-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Schmitthennerstr_1_Dusche_076-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Schmitthennerstr_1_Zimmer1_064-768x512.jpg'
    ],
    true
  )
  ON CONFLICT (school_id, name_en) DO NOTHING;

  -- A-2: Concordia hall of residence
  INSERT INTO public.accommodations (
    name_en, name_ar, currency, description, school_id, room_type,
    deposit, placement_fee, distance_note, price_tiers, photos, is_active
  )
  VALUES (
    'Category A – Concordia hall of residence (Rohrbacher Strasse 126)',
    'الفئة A – سكن كونكورديا (Rohrbacher Strasse 126)',
    'EUR',
    'Shared flat with international language students. Located 5-7 km from the school (25-30 min by public transport). Communal kitchen, shared showers and toilets. Rooms have a wardrobe, bed, chair, desk, refrigerator, and sink. Parking available (50 €/week).',
    v_school_id,
    'Single room, shared kitchen/bathroom/shower',
    200, 130,
    '5-7 km from school · 25-30 min public transport',
    '[{"from_weeks":1,"to_weeks":6,"price":200},{"from_weeks":7,"to_weeks":16,"price":185},{"from_weeks":17,"to_weeks":29,"price":165},{"from_weeks":30,"to_weeks":null,"price":155}]'::jsonb,
    ARRAY[
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Rohrbacher-Strasse_126_Kueche-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Rohrbacher-Strasse_126_Zimmer1_011-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Rohrbacher-Strasse_126_Aussen_ADN6487-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Rohrbacher-Strasse_126_Bad-768x512.jpg'
    ],
    true
  )
  ON CONFLICT (school_id, name_en) DO NOTHING;

  -- A-3: Turnerstrasse - Heidelberg Rohrbach
  INSERT INTO public.accommodations (
    name_en, name_ar, currency, description, school_id, room_type,
    deposit, placement_fee, distance_note, price_tiers, photos, is_active
  )
  VALUES (
    'Category A – Turnerstrasse, Heidelberg Rohrbach',
    'الفئة A – شارع تورنر، هايدلبرغ رورباخ',
    'EUR',
    'Shared flat with international language students. Located 5-7 km from the school (25-30 min by public transport). Communal kitchen, shared showers and toilets. Rooms have a wardrobe, bed, chair, desk, refrigerator, and sink.',
    v_school_id,
    'Single room, shared kitchen/bathroom/shower',
    200, 130,
    '5-7 km from school · 25-30 min public transport',
    '[{"from_weeks":1,"to_weeks":6,"price":200},{"from_weeks":7,"to_weeks":16,"price":185},{"from_weeks":17,"to_weeks":29,"price":165},{"from_weeks":30,"to_weeks":null,"price":155}]'::jsonb,
    ARRAY[
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Franz-Marc-Strasse_19_Aussen_ADN6498-1-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Franz-Marc-Strasse_19_Kueche_a-1-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Franz-Marc-Strasse_19_Zimmer-1-768x512.jpg'
    ],
    true
  )
  ON CONFLICT (school_id, name_en) DO NOTHING;

  -- A-4: Franz-Marc-Straße (Turnerstrasse 165)
  INSERT INTO public.accommodations (
    name_en, name_ar, currency, description, school_id, room_type,
    deposit, placement_fee, distance_note, price_tiers, photos, is_active
  )
  VALUES (
    'Category A – Franz-Marc-Straße (Turnerstrasse 165)',
    'الفئة A – شارع فرانز مارك (Turnerstrasse 165)',
    'EUR',
    'Shared flat with international language students. Located 5-7 km from the school (25-30 min by public transport). Communal kitchen, shared showers and toilets. Rooms have a wardrobe, bed, chair, desk, refrigerator, and sink.',
    v_school_id,
    'Single room, shared kitchen/bathroom/shower',
    200, 130,
    '5-7 km from school · 25-30 min public transport',
    '[{"from_weeks":1,"to_weeks":6,"price":200},{"from_weeks":7,"to_weeks":16,"price":185},{"from_weeks":17,"to_weeks":29,"price":165},{"from_weeks":30,"to_weeks":null,"price":155}]'::jsonb,
    ARRAY[
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Turnerstrasse_165_Zimmer1-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Turnerstrasse_165_Aussen_ADN6506-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Turnerstrasse_165_Bad-768x512.jpg',
      'https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Turnerstrasse_165_Kueche-768x512.jpg'
    ],
    true
  )
  ON CONFLICT (school_id, name_en) DO NOTHING;
END $$;

-- ── Verification (commented; uncomment to check after running) ──────────
-- SELECT s.name_en AS school, a.name_en AS accommodation, a.room_type,
--        a.distance_note, a.price_tiers, array_length(a.photos, 1) AS photo_count
-- FROM public.accommodations a
-- JOIN public.schools s ON s.id = a.school_id
-- WHERE s.name_en = 'Academy of Languages (F+U)'
-- ORDER BY a.name_en;
