-- Store an optional lower bound so partner-school class sizes can be shown as a range.
ALTER TABLE public.school_courses
  ADD COLUMN IF NOT EXISTS min_students integer;

-- F+U Academy standard course: published class size is 12–16 students.
UPDATE public.school_courses AS c
SET min_students = 12,
    max_students = 16
FROM public.school_price_versions AS v
JOIN public.partner_schools AS p ON p.id = v.school_id
WHERE c.price_version_id = v.id
  AND p.slug = 'fu-academy'
  AND v.is_current
  AND c.is_darb_standard
  AND c.code IN ('standard_intensive', 'intensive20');
