ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS in_full_service boolean NOT NULL DEFAULT false;

-- Rename/reuse existing rows so historical case_services keep pointing at them
UPDATE public.service_catalog SET code = 'core_service_fee' WHERE name_en = 'Core service fee' AND code IS NULL;
UPDATE public.service_catalog SET code = 'language_course_registration', name_en = 'Language course registration', name_ar = 'تسجيل دورة اللغة', category = 'language', is_active = true, in_full_service = true, sort_order = 2 WHERE name_en = 'Language school';
UPDATE public.service_catalog SET code = 'health_insurance', name_en = 'Health insurance', name_ar = 'التأمين الصحي', category = 'insurance', is_active = true, in_full_service = true, sort_order = 3 WHERE name_en = 'Health insurance';
UPDATE public.service_catalog SET code = 'blocked_account', name_en = 'Blocked bank account', name_ar = 'فتح الحساب المغلق', category = 'finance', is_active = true, in_full_service = true, sort_order = 4 WHERE name_en = 'Blocked account';
UPDATE public.service_catalog SET code = 'certificate_recognition', name_en = 'Bagrut translation & recognition', name_ar = 'ترجمة ومعادلة شهادة البجروت', category = 'documents', is_active = true, in_full_service = true, sort_order = 5 WHERE name_en = 'Certificate recognition';
UPDATE public.service_catalog SET code = 'notarized_papers', name_en = 'Notarized papers', name_ar = 'تصديق الأوراق لدى كاتب العدل', category = 'documents', is_active = true, in_full_service = true, sort_order = 6 WHERE name_en = 'Sworn translation';
UPDATE public.service_catalog SET code = 'visa_fees', is_active = true, in_full_service = false WHERE name_en = 'Visa fees';
UPDATE public.service_catalog SET code = 'accommodation', name_en = 'Accommodation booking', name_ar = 'حجز السكن', category = 'accommodation', is_active = true, in_full_service = true, sort_order = 8 WHERE name_en = 'Accommodation support';

UPDATE public.service_catalog SET in_full_service = true WHERE code = 'core_service_fee';

INSERT INTO public.service_catalog (code, name_ar, name_en, category, default_price, is_active, in_full_service, sort_order)
SELECT v.code, v.name_ar, v.name_en, v.category, v.default_price, true, v.in_full_service, v.sort_order
FROM (VALUES
  ('university_registration', 'التسجيل في الجامعة', 'University registration', 'documents', 700::numeric, true, 9),
  ('sim_card', 'شريحة اتصال ألمانية', 'German SIM card', 'other', 150::numeric, false, 10)
) AS v(code, name_ar, name_en, category, default_price, in_full_service, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.service_catalog s WHERE s.code = v.code);

CREATE UNIQUE INDEX IF NOT EXISTS service_catalog_code_key ON public.service_catalog (code) WHERE code IS NOT NULL;