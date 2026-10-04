-- F+U Academy: standard intensive course class size is 12–15, and the obsolete
-- "two kinds of accommodation" note is removed.
--
-- The earlier 20261003150000 migration set 12–16; the school publishes 12–15.
-- `school_courses` has no `school_id` column — it is reached through its price
-- version, so the update joins via `school_price_versions` like the original.

-- 1. Ensure the optional lower bound exists (idempotent).
ALTER TABLE public.school_courses
  ADD COLUMN IF NOT EXISTS min_students integer;

-- 2. Correct the F+U standard course class size to 12–15.
UPDATE public.school_courses AS c
SET min_students = 12,
    max_students = 15
FROM public.school_price_versions AS v
JOIN public.partner_schools AS p ON p.id = v.school_id
WHERE c.price_version_id = v.id
  AND p.slug = 'fu-academy'
  AND v.is_current
  AND c.is_darb_standard
  AND c.code IN ('standard_intensive', 'intensive20');

-- 3. Remove the obsolete housing note. Matched by id and by title so the delete
--    is a no-op when the row is absent or already gone.
DELETE FROM public.school_notes
WHERE id = '611569a3-a42c-4237-88d5-9134e97af3de'
   OR (
     school_id = (SELECT id FROM public.partner_schools WHERE slug = 'fu-academy')
     AND kind = 'accommodation'
     AND (
       title_ar = 'نوعان من السكن'
       OR title_en ILIKE '%two%accommodation%'
     )
   );
