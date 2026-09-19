ALTER TABLE public.school_courses
  ADD COLUMN IF NOT EXISTS surcharge_weeks integer,
  ADD COLUMN IF NOT EXISTS surcharge_waived_from_weeks integer;

ALTER TABLE public.school_accommodations
  ADD COLUMN IF NOT EXISTS surcharge_weeks integer,
  ADD COLUMN IF NOT EXISTS surcharge_waived_from_weeks integer;

COMMENT ON COLUMN public.school_courses.surcharge_weeks IS
  'When set, the first N weeks of a booking are charged at the band covering week 1 and the remaining weeks at the band covering the total weeks. NULL = single flat band (default).';
COMMENT ON COLUMN public.school_courses.surcharge_waived_from_weeks IS
  'Bookings of at least this many weeks are charged at a single flat band from week 1.';
COMMENT ON COLUMN public.school_accommodations.surcharge_weeks IS
  'When set, the first N weeks of a stay are charged at the band covering week 1 and the remaining weeks at the band covering the total weeks. NULL = single flat band (default).';
COMMENT ON COLUMN public.school_accommodations.surcharge_waived_from_weeks IS
  'Stays of at least this many weeks are charged at a single flat band from week 1.';

-- GoAcademy! Düsseldorf 2026: "Week 1-4: 190 EUR/week, Week 5-24: 175 EUR/week,
-- Week 25-52: 165 EUR/week. If you book 25 or more weeks you only pay 165 EUR
-- per week from the beginning." (official 2026 course price list)
UPDATE public.school_courses c
SET surcharge_weeks = 4, surcharge_waived_from_weeks = 25
FROM public.school_price_versions v, public.partner_schools p
WHERE c.price_version_id = v.id
  AND v.school_id = p.id
  AND p.slug = 'goacademy-dusseldorf'
  AND v.is_current
  AND c.code IN ('standard_intensive', 'high_intensive');

-- Accommodation: "For bookings of at least 12 weeks, the surcharge is waived for
-- the first 4 weeks. For bookings of at least 24 weeks, the price applies from
-- the first week." (official 2026 accommodation sheet)
UPDATE public.school_accommodations a
SET surcharge_weeks = 4, surcharge_waived_from_weeks = 12
FROM public.school_price_versions v, public.partner_schools p
WHERE a.price_version_id = v.id
  AND v.school_id = p.id
  AND p.slug = 'goacademy-dusseldorf'
  AND v.is_current;

-- Registration fee EUR 60 is printed on the intensive course pages.
UPDATE public.school_courses c
SET registration_fee = 60
FROM public.school_price_versions v, public.partner_schools p
WHERE c.price_version_id = v.id
  AND v.school_id = p.id
  AND p.slug = 'goacademy-dusseldorf'
  AND v.is_current
  AND c.code IN ('standard_intensive', 'high_intensive')
  AND c.registration_fee IS NULL;

UPDATE public.partner_schools
SET last_verified_at = DATE '2026-09-19'
WHERE slug = 'goacademy-dusseldorf';
