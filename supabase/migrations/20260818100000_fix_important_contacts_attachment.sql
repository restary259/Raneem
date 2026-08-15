-- Fix Important Contacts attachments (2026-08-18)
--
-- All existing contacts were backfilled to scope='universal' by
-- 20260813120000, so no contact targets a school and the admin School filter
-- returns nothing. This re-scopes the 14 live contacts:
--   school_only  -> attached to a specific school (language_school_id)
--   city_only    -> matches any school whose schools.city string equals ic.city
--   universal    -> everyone (emergency numbers, unchanged)
--
-- City values for city_only contacts are sourced from the school row itself so
-- they match schools.city EXACTLY (the resolver compares case-insensitively) —
-- no Arabic/English mismatch. Requires admin/service-role access (DDL-level
-- writes); run via `supabase db push` or the dashboard SQL editor.

-- 1) Language-school contacts -> school_only (own school, city cleared)
UPDATE public.important_contacts
   SET scope = 'school_only', is_universal = false,
       language_school_id = '6cd8d4af-0b31-489f-9bd0-6e873e8435d0', -- Alpha Aktiv Heidelberg
       city = NULL
 WHERE name_en = 'Alpha Aktiv Language School';

UPDATE public.important_contacts
   SET scope = 'school_only', is_universal = false,
       language_school_id = 'b80ef893-29eb-4fc5-9d4f-af08d0767f1a', -- F+U Academy of Languages Heidelberg
       city = NULL
 WHERE name_en = 'F+U Academy of Languages';

UPDATE public.important_contacts
   SET scope = 'school_only', is_universal = false,
       language_school_id = 'b7a059d8-4285-4be4-afa9-bad3dddaed69', -- GoAcademy Düsseldorf
       city = NULL
 WHERE name_en = 'GoAcademy! Language School';

UPDATE public.important_contacts
   SET scope = 'school_only', is_universal = false,
       language_school_id = '3461dfcc-d7ef-415d-8178-a4bcd95d5d94', -- KAPITO Münster
       city = NULL
 WHERE name_en = 'KAPITO Language School';

-- 2) City office / immigration -> city_only, city pulled from the school row
UPDATE public.important_contacts
   SET scope = 'city_only', is_universal = false,
       language_school_id = NULL,
       city = (SELECT city FROM public.schools WHERE id = 'b80ef893-29eb-4fc5-9d4f-af08d0767f1a') -- Heidelberg (F+U)
 WHERE name_en = 'Heidelberg Citizen Services';

UPDATE public.important_contacts
   SET scope = 'city_only', is_universal = false,
       language_school_id = NULL,
       city = (SELECT city FROM public.schools WHERE id = 'b80ef893-29eb-4fc5-9d4f-af08d0767f1a') -- Heidelberg (F+U)
 WHERE name_en = 'Heidelberg Immigration Authority';

UPDATE public.important_contacts
   SET scope = 'city_only', is_universal = false,
       language_school_id = NULL,
       city = (SELECT city FROM public.schools WHERE id = 'b7a059d8-4285-4be4-afa9-bad3dddaed69') -- GoAcademy Düsseldorf
 WHERE name_en = 'Düsseldorf Citizen Services (Bürgerbüro)';

UPDATE public.important_contacts
   SET scope = 'city_only', is_universal = false,
       language_school_id = NULL,
       city = (SELECT city FROM public.schools WHERE id = 'b7a059d8-4285-4be4-afa9-bad3dddaed69') -- GoAcademy Düsseldorf
 WHERE name_en = 'Düsseldorf Immigration Authority';

UPDATE public.important_contacts
   SET scope = 'city_only', is_universal = false,
       language_school_id = NULL,
       city = (SELECT city FROM public.schools WHERE id = '3461dfcc-d7ef-415d-8178-a4bcd95d5d94') -- KAPITO Münster
 WHERE name_en = 'Münster Bürgerbüro Mitte';

UPDATE public.important_contacts
   SET scope = 'city_only', is_universal = false,
       language_school_id = NULL,
       city = (SELECT city FROM public.schools WHERE id = '3461dfcc-d7ef-415d-8178-a4bcd95d5d94') -- KAPITO Münster
 WHERE name_en = 'Münster Immigration Authority';

-- 3) Emergencies stay universal; drop their stray Arabic city text
UPDATE public.important_contacts SET city = NULL
 WHERE name_en IN ('Medical On-Call Service', 'Federal Authorities Hotline');

-- 4) Verification: each school should now have contacts
SELECT sch.name_en, COUNT(ic.id) AS attached_contacts
FROM public.schools sch
LEFT JOIN public.important_contacts ic ON ic.language_school_id = sch.id
GROUP BY sch.name_en ORDER BY attached_contacts DESC;

SELECT scope, COUNT(*) FROM public.important_contacts GROUP BY scope ORDER BY scope;

-- 5) City-string check: both Heidelberg schools must carry the SAME city value
SELECT name_en, city FROM public.schools ORDER BY name_en;
