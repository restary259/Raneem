-- Corrective data fix: the goacademy-dusseldorf seed migration
-- (20260918210000_add_goacademy_partner_school.sql) inserted a school_notes
-- row with the Arabic brand name misspelled as "دارب" instead of the
-- correct "درب". That historical migration must not be edited (already
-- applied / idempotent guard on partner_schools.slug), so this migration
-- corrects the previously seeded row in place.
UPDATE public.school_notes sn
SET body_ar = replace(sn.body_ar, 'مكتب دارب', 'مكتب درب')
FROM public.partner_schools ps
WHERE sn.school_id = ps.id
  AND ps.slug = 'goacademy-dusseldorf'
  AND sn.kind = 'darb_recommendation'
  AND sn.body_ar LIKE '%مكتب دارب%';
