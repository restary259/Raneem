-- ============================================================
-- School catalog seed: photos columns + scraped catalog data
--
-- Adds a `photos text[]` column to schools / programs / insurances
-- (accommodations already has it) and seeds the real catalog data
-- scraped from the four partner schools (F+U Academy, Alpha Aktiv,
-- GoAcademy!, KAPITO).
--
-- Idempotent: every INSERT guards on a name/slug match (ON CONFLICT or
-- WHERE NOT EXISTS), so re-running after a db reset is safe. Schools are
-- keyed by a stable `slug` column; programs/accommodations resolve the
-- school FK from the slug.
-- ============================================================

-- ── 1. photos columns ────────────────────────────────────────────────
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.accommodations
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

ALTER TABLE public.insurances
  ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}'::text[];

-- ── 2. schools ───────────────────────────────────────────────────────

INSERT INTO public.schools (slug, name_ar, name_en, city, country, website, description_ar, description_en, photos, is_active)
SELECT 'fu-academy', 'أكاديمية اللغات ف+يو', 'F+U Academy of Languages', 'Heidelberg', 'Germany', 'https://academy-languages.com/en/', 'مدرسة لغات معتمدة في هايدلبرغ تقدم دورات ألمانية مكثفة من المستوى A1 إلى C1، مع سكن جامعي قريب وأكثر من 10,000 طالب سنويًا من أكثر من 100 دولة.', 'Certified language school in Heidelberg offering intensive German courses from A1 to C1, with student dormitories nearby and more than 10,000 learners a year from over 100 countries.', ARRAY['/lovable-uploads/schools/fu-academy/school/campus.jpg', '/lovable-uploads/schools/fu-academy/school/classroom.jpg', '/lovable-uploads/schools/fu-academy/school/hero.jpg'], true
WHERE NOT EXISTS (SELECT 1 FROM public.schools WHERE slug = 'fu-academy');

INSERT INTO public.schools (slug, name_ar, name_en, city, country, website, description_ar, description_en, photos, is_active)
SELECT 'alpha-aktiv', 'ألفا أكتيف', 'Alpha Aktiv Sprachschule', 'Heidelberg', 'Germany', 'https://www.alpha-heidelberg.de/en/', 'مدرسة لغات في هايدلبرغ تقدم دورات ألمانية من A1 إلى C2، وسكن طلابي في وسط المدينة مع عائلات مضيفة أو شقق خاصة.', 'Language school in Heidelberg offering German courses from A1 to C2, student residences in the city centre, apartments and host families.', ARRAY['/lovable-uploads/schools/alpha-aktiv/school/residence.webp', '/lovable-uploads/schools/alpha-aktiv/school/classroom.webp', '/lovable-uploads/schools/alpha-aktiv/school/hero.webp'], true
WHERE NOT EXISTS (SELECT 1 FROM public.schools WHERE slug = 'alpha-aktiv');

INSERT INTO public.schools (slug, name_ar, name_en, city, country, website, description_ar, description_en, photos, is_active)
SELECT 'go-academy', 'غو أكاديمي - هاوس الدولية', 'GoAcademy! International House Düsseldorf', 'Düsseldorf', 'Germany', 'https://goacademy.de/en/', 'مدرسة لغات في دوسلدورف منذ 1990، معتمدة وفق ISO 9001 و AZAV، عضو في International House و IALC، وتقدم دورات ألمانية مكثفة من A1 إلى C2 مع خيارات سكن متعددة.', 'Language school in Düsseldorf since 1990, ISO 9001 and AZAV certified, member of International House and IALC, offering intensive German courses from A1 to C2 with various accommodation options.', ARRAY['/lovable-uploads/schools/go-academy/school/logo.png', '/lovable-uploads/schools/go-academy/school/accommodation-hero.jpg'], true
WHERE NOT EXISTS (SELECT 1 FROM public.schools WHERE slug = 'go-academy');

INSERT INTO public.schools (slug, name_ar, name_en, city, country, website, description_ar, description_en, photos, is_active)
SELECT 'kapito', 'كابيتو', 'KAPITO Sprachschule', 'Münster', 'Germany', 'https://www.kapito.com/en/', 'مدرسة لغات في وسط مونستر تقدم دورات ألمانية مكثفة للبالغين من عمر 16 عامًا، مع عائلات مضيفة وشقق وستوديوهات مفروشة بالكامل.', 'Language school in central Münster offering German intensive courses for adults from age 16, with host families, apartments and fully-furnished studios.', ARRAY['/lovable-uploads/schools/kapito/school/standard-course.jpg', '/lovable-uploads/schools/kapito/programs/intensive-course.jpg'], true
WHERE NOT EXISTS (SELECT 1 FROM public.schools WHERE slug = 'kapito');

-- ── 3. programs ──────────────────────────────────────────────────────

INSERT INTO public.programs (school_id, name_ar, name_en, type, price, currency, duration, description, description_ar, description_en, cefr_range, hours_per_week, lessons_per_week, start_rule, registration_fee, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'دورة ألمانية مكثفة - 20 درس', 'Intensive Course 20', 'language_school', 155, 'EUR', '1-30+ weeks', '20 lessons/week Mon-Fri 09:00-12:15, communicative teaching in small groups, ideal for students.', '20 درسًا أسبوعيًا من الاثنين إلى الجمعة 09:00-12:15، منهجية تواصلية في مجموعات صغيرة، مناسب للطلاب.', '20 lessons/week Mon-Fri 09:00-12:15, communicative teaching in small groups, ideal for students.', 'A1-C1', 15, 20, 'Every Monday, year round', NULL, '[{"from_weeks":1,"to_weeks":6,"price":225},{"from_weeks":7,"to_weeks":16,"price":195},{"from_weeks":17,"to_weeks":29,"price":170},{"from_weeks":30,"to_weeks":null,"price":155}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/school/classroom.jpg', '/lovable-uploads/schools/fu-academy/programs/intensive-course.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.programs
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Intensive Course 20' AND duration = '1-30+ weeks'
);

INSERT INTO public.programs (school_id, name_ar, name_en, type, price, currency, duration, description, description_ar, description_en, cefr_range, hours_per_week, lessons_per_week, start_rule, registration_fee, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'دورة ألمانية مكثفة 20 + دورة تخصصية 10', 'Intensive Course 20 + Module Course 10', 'language_school', 210, 'EUR', '1-30+ weeks', '20 core lessons in the morning plus 10 module lessons in the afternoon (conversation, grammar or job coaching) for faster, more confident progress.', '20 درسًا أساسيًا صباحًا بالإضافة إلى 10 دروس تخصصية بعد الظهر (محادثة، قواعد، أو تدريب مهني) لتقدم أسرع وأكثر ثقة.', '20 core lessons in the morning plus 10 module lessons in the afternoon (conversation, grammar or job coaching) for faster, more confident progress.', 'A1-C1', 22.5, 30, 'Every Monday, year round', NULL, '[{"from_weeks":1,"to_weeks":6,"price":280},{"from_weeks":7,"to_weeks":16,"price":250},{"from_weeks":17,"to_weeks":29,"price":225},{"from_weeks":30,"to_weeks":null,"price":210}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/school/classroom.jpg', '/lovable-uploads/schools/fu-academy/programs/intensive-course.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.programs
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Intensive Course 20 + Module Course 10' AND duration = '1-30+ weeks'
);

INSERT INTO public.programs (school_id, name_ar, name_en, type, price, currency, duration, description, description_ar, description_en, cefr_range, hours_per_week, lessons_per_week, start_rule, registration_fee, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'دورة ألمانية مكثفة 30 درس', 'Intensive Course 30', 'language_school', 210, 'EUR', '1-30+ weeks', '30 lessons/week (09:00-14:30) with additional lessons to improve your skills and learn faster.', '30 درسًا أسبوعيًا (09:00-14:30) معوقات إضافية لتحسين مهاراتك وتعلم أسرع.', '30 lessons/week (09:00-14:30) with additional lessons to improve your skills and learn faster.', 'A1-C1', 22.5, 30, 'Every Monday, year round', NULL, '[{"from_weeks":1,"to_weeks":6,"price":280},{"from_weeks":7,"to_weeks":16,"price":250},{"from_weeks":17,"to_weeks":29,"price":225},{"from_weeks":30,"to_weeks":null,"price":210}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/school/classroom.jpg', '/lovable-uploads/schools/fu-academy/programs/intensive-course.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.programs
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Intensive Course 30' AND duration = '1-30+ weeks'
);

INSERT INTO public.programs (school_id, name_ar, name_en, type, price, currency, duration, description, description_ar, description_en, cefr_range, hours_per_week, lessons_per_week, start_rule, registration_fee, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'دورة مكثفة فائقة 35 درس', 'Superintensive Course 35', 'language_school', 395, 'EUR', '1-29 weeks', '30 group lessons plus 5 individual lessons for maximum, lasting progress.', '30 درسًا جماعيًا بالاضافة إلى 5 دروس فردية لتحقيق أقصى تقدم سريع ودائم.', '30 group lessons plus 5 individual lessons for maximum, lasting progress.', 'A1-C1', 26.25, 35, 'Every Monday, year round', NULL, '[{"from_weeks":1,"to_weeks":6,"price":450},{"from_weeks":7,"to_weeks":16,"price":420},{"from_weeks":17,"to_weeks":29,"price":395}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/school/classroom.jpg', '/lovable-uploads/schools/fu-academy/programs/intensive-course.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.programs
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Superintensive Course 35' AND duration = '1-29 weeks'
);

INSERT INTO public.programs (school_id, name_ar, name_en, type, price, currency, duration, description, description_ar, description_en, cefr_range, hours_per_week, lessons_per_week, start_rule, registration_fee, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'دورة تخصصية 10 دروس', 'Module Course 10', 'language_school', 80, 'EUR', '1-30+ weeks', '10 module lessons in the afternoon: choose Conversation + Grammar or Job Coaching.', '10 دروس تخصصية بعد الظهر: اختر المحادثة + القواعد أو التدريب المهني.', '10 module lessons in the afternoon: choose Conversation + Grammar or Job Coaching.', 'A1-C1', 7.5, 10, 'Beginner starts monthly; lateral entry every Monday', NULL, '[{"from_weeks":1,"to_weeks":6,"price":110},{"from_weeks":7,"to_weeks":16,"price":100},{"from_weeks":17,"to_weeks":29,"price":90},{"from_weeks":30,"to_weeks":null,"price":80}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/school/classroom.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.programs
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Module Course 10' AND duration = '1-30+ weeks'
);

INSERT INTO public.programs (school_id, name_ar, name_en, type, price, currency, duration, description, description_ar, description_en, cefr_range, hours_per_week, lessons_per_week, start_rule, registration_fee, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'دورة ألمانية مكثفة + تدريب مهني لدخول سوق العمل', 'Intensive 20 + Job Coaching for work', 'language_school', 265, 'EUR', '12-week packages', '20 lessons/week plus job coaching for those seeking work in Germany (e.g. Opportunity Card), from level B2.', '20 درسًا أسبوعيًا مع تدريب مهني للراغبين في العمل في ألمانيا (مثل بطاقة الفرصة), ابتداءً من المستوى B2.', '20 lessons/week plus job coaching for those seeking work in Germany (e.g. Opportunity Card), from level B2.', 'B2-C1', 22.5, 30, '12-week packages: Jan 12, Apr 07, Jun 29, Sep 14', NULL, '[{"from_weeks":1,"to_weeks":null,"price":265}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/school/classroom.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.programs
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Intensive 20 + Job Coaching for work' AND duration = '12-week packages'
);

INSERT INTO public.programs (school_id, name_ar, name_en, type, price, currency, duration, description, description_ar, description_en, cefr_range, hours_per_week, lessons_per_week, start_rule, registration_fee, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'), 'دورة ألمانية مكثفة 20 ساعة', 'Intensive German Course 20h', 'language_school', 150, 'EUR', '1-25+ weeks', 'Our most popular course: 20 hours/week Mon-Fri, levels A1 to C2.', 'الدورة الأشهر لدينا: 20 ساعة أسبوعيًا من الاثنين إلى الجمعة، من المستوى A1 إلى C2.', 'Our most popular course: 20 hours/week Mon-Fri, levels A1 to C2.', 'A1-C2', 20, 20, 'Beginners start first Monday of the month', 50, '[{"from_weeks":1,"to_weeks":3,"price":215},{"from_weeks":4,"to_weeks":12,"price":190},{"from_weeks":13,"to_weeks":24,"price":165},{"from_weeks":25,"to_weeks":null,"price":150}]'::jsonb, ARRAY['/lovable-uploads/schools/alpha-aktiv/school/classroom.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.programs
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv') AND name_en = 'Intensive German Course 20h' AND duration = '1-25+ weeks'
);

INSERT INTO public.programs (school_id, name_ar, name_en, type, price, currency, duration, description, description_ar, description_en, cefr_range, hours_per_week, lessons_per_week, start_rule, registration_fee, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'), 'دورة مكثفة 20 + 5 دروس فردية', 'Intensive 20 + One-to-One Tuition 5', 'language_school', 365, 'EUR', '1-13+ weeks', 'Intensive course plus 5 individual lessons/week for remarkably rapid progress.', 'الدورة المكثفة مع 5 دروس فردية أسبوعيًا للتقدم السريع والتركيز على نقاط محددة.', 'Intensive course plus 5 individual lessons/week for remarkably rapid progress.', 'A1-C2', 23.75, 25, 'Follows intensive course start dates', 50, '[{"from_weeks":1,"to_weeks":3,"price":415},{"from_weeks":4,"to_weeks":12,"price":390},{"from_weeks":13,"to_weeks":null,"price":365}]'::jsonb, ARRAY['/lovable-uploads/schools/alpha-aktiv/school/classroom.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.programs
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv') AND name_en = 'Intensive 20 + One-to-One Tuition 5' AND duration = '1-13+ weeks'
);

INSERT INTO public.programs (school_id, name_ar, name_en, type, price, currency, duration, description, description_ar, description_en, cefr_range, hours_per_week, lessons_per_week, start_rule, registration_fee, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'), 'دورة مكثفة 20 + 10 دروس فردية', 'Intensive 20 + One-to-One Tuition 10', 'language_school', 565, 'EUR', '1-13+ weeks', 'Intensive course plus 10 individual lessons/week for maximum personal progress.', 'الدورة المكثفة مع 10 دروس فردية أسبوعيًا لأقصى تقدم الشخصي.', 'Intensive course plus 10 individual lessons/week for maximum personal progress.', 'A1-C2', 27.5, 30, 'Follows intensive course start dates', 50, '[{"from_weeks":1,"to_weeks":3,"price":615},{"from_weeks":4,"to_weeks":12,"price":590},{"from_weeks":13,"to_weeks":null,"price":565}]'::jsonb, ARRAY['/lovable-uploads/schools/alpha-aktiv/school/classroom.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.programs
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv') AND name_en = 'Intensive 20 + One-to-One Tuition 10' AND duration = '1-13+ weeks'
);

INSERT INTO public.programs (school_id, name_ar, name_en, type, price, currency, duration, description, description_ar, description_en, cefr_range, hours_per_week, lessons_per_week, start_rule, registration_fee, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'), 'دورة ألمانية مكثفة فائقة 25 ساعة', 'Superintensive German Course 25h', 'language_school', 195, 'EUR', '1-25+ weeks', '25 hours/week: group lessons in the morning and oral practice in the afternoon.', '25 ساعة أسبوعيًا: دروس جماعية صباحًا والممارسة الشفهية بعد الظهر.', '25 hours/week: group lessons in the morning and oral practice in the afternoon.', 'A1-C2', 25, 25, 'Beginners start first Monday of the month', 50, '[{"from_weeks":1,"to_weeks":3,"price":260},{"from_weeks":4,"to_weeks":12,"price":230},{"from_weeks":13,"to_weeks":24,"price":210},{"from_weeks":25,"to_weeks":null,"price":195}]'::jsonb, ARRAY['/lovable-uploads/schools/alpha-aktiv/school/classroom.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.programs
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv') AND name_en = 'Superintensive German Course 25h' AND duration = '1-25+ weeks'
);

INSERT INTO public.programs (school_id, name_ar, name_en, type, price, currency, duration, description, description_ar, description_en, cefr_range, hours_per_week, lessons_per_week, start_rule, registration_fee, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'), 'دورة مكثفة فائقة + محادثة 30 ساعة', 'Superintensive German + Conversation 30h', 'language_school', 280, 'EUR', '1-4 weeks', '30 hours/week: group course in the morning plus 10 extra hours of conversation, presentations and book reviews.', '30 ساعة أسبوعيًا: الدورة الجماعية الصباحية مع 10 ساعات إضافية للمحادثة والعروض ومراجعة الكتب.', '30 hours/week: group course in the morning plus 10 extra hours of conversation, presentations and book reviews.', 'A2-C2', 30, 30, 'Follows intensive course start dates', 50, '[{"from_weeks":1,"to_weeks":4,"price":280}]'::jsonb, ARRAY['/lovable-uploads/schools/alpha-aktiv/school/classroom.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.programs
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv') AND name_en = 'Superintensive German + Conversation 30h' AND duration = '1-4 weeks'
);

INSERT INTO public.programs (school_id, name_ar, name_en, type, price, currency, duration, description, description_ar, description_en, cefr_range, hours_per_week, lessons_per_week, start_rule, registration_fee, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'go-academy'), 'دورة ألمانية مكثفة قياسية', 'German Intensive Standard Course', 'language_school', 165, 'EUR', '1-25+ weeks', '20 lessons/week Mon-Fri 09:00-12:15 + 5 LMS online lessons.', '20 درسًا أسبوعيًا من الاثنين إلى الجمعة 09:00-12:15 + 5 دروس إلكترونية عبر نظام التعليم LMS.', '20 lessons/week Mon-Fri 09:00-12:15 + 5 LMS online lessons.', 'A1-C2', 15, 20, 'Every Monday, year round', 60, '[{"from_weeks":1,"to_weeks":4,"price":190},{"from_weeks":5,"to_weeks":24,"price":175},{"from_weeks":25,"to_weeks":null,"price":165}]'::jsonb, ARRAY['/lovable-uploads/schools/go-academy/programs/intensive-course.jpeg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.programs
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'go-academy') AND name_en = 'German Intensive Standard Course' AND duration = '1-25+ weeks'
);

INSERT INTO public.programs (school_id, name_ar, name_en, type, price, currency, duration, description, description_ar, description_en, cefr_range, hours_per_week, lessons_per_week, start_rule, registration_fee, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'go-academy'), 'دورة ألمانية مكثفة عالية / إجازة تعليمية', 'German High Intensive Course / Educational Leave', 'language_school', 315, 'EUR', '1-2 weeks', '30 lessons/week, recognized as educational leave in many federal states, in the 2nd and 3rd week of the month.', '30 درسًا أسبوعيًا معترف بها كإجازة تعليمية في العديد من الولايات الاتحادية، في الأسبوعين الثاني والثالث من الشهر.', '30 lessons/week, recognized as educational leave in many federal states, in the 2nd and 3rd week of the month.', 'A1-C2', 22.5, 30, '2nd and 3rd week of each month', 60, '[{"from_weeks":1,"to_weeks":2,"price":315}]'::jsonb, ARRAY['/lovable-uploads/schools/go-academy/programs/intensive-course.jpeg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.programs
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'go-academy') AND name_en = 'German High Intensive Course / Educational Leave' AND duration = '1-2 weeks'
);

INSERT INTO public.programs (school_id, name_ar, name_en, type, price, currency, duration, description, description_ar, description_en, cefr_range, hours_per_week, lessons_per_week, start_rule, registration_fee, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'kapito'), 'دورة ألمانية مكثفة 20 درس', 'German Intensive Course 20', 'language_school', 160, 'EUR', '1-23+ weeks', '20 lessons/week, max 12 participants per group, cultural and social activities, homework supervision, from age 16.', '20 درسًا أسبوعيًا، مجموعات صغيرة بحد أقصى 12 مشاركًا، أنشطة ثقافية واجتماعية، دعم للغة الواجبات، من عمر 16 عامًا.', '20 lessons/week, max 12 participants per group, cultural and social activities, homework supervision, from age 16.', 'A1-C2', 15, 20, 'Every Monday; beginners on recommended start dates', NULL, '[{"from_weeks":1,"to_weeks":4,"price":210},{"from_weeks":5,"to_weeks":8,"price":190},{"from_weeks":9,"to_weeks":16,"price":180},{"from_weeks":17,"to_weeks":23,"price":170},{"from_weeks":24,"to_weeks":null,"price":160}]'::jsonb, ARRAY['/lovable-uploads/schools/kapito/programs/intensive-course.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.programs
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'kapito') AND name_en = 'German Intensive Course 20' AND duration = '1-23+ weeks'
);

INSERT INTO public.programs (school_id, name_ar, name_en, type, price, currency, duration, description, description_ar, description_en, cefr_range, hours_per_week, lessons_per_week, start_rule, registration_fee, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'kapito'), 'دورة ألمانية مكثفة بلس 24 درس', 'Intensive Plus German Course 24', 'language_school', 190, 'EUR', '1-23+ weeks', '24 lessons/week: 20 in the intensive course + 2x2 afternoon lessons (conversation, grammar, exam preparation).', '24 درسًا أسبوعيًا: 20 درسًا في الدورة المكثفة + درسان إضافيان مرتين أسبوعيًا (المحادثة، القواعد، التحضير للامتحانات).', '24 lessons/week: 20 in the intensive course + 2x2 afternoon lessons (conversation, grammar, exam preparation).', 'A1-C2', 18, 24, 'Every Monday; beginners on recommended start dates', NULL, '[{"from_weeks":1,"to_weeks":4,"price":250},{"from_weeks":5,"to_weeks":8,"price":230},{"from_weeks":9,"to_weeks":16,"price":210},{"from_weeks":17,"to_weeks":23,"price":200},{"from_weeks":24,"to_weeks":null,"price":190}]'::jsonb, ARRAY['/lovable-uploads/schools/kapito/programs/intensive-plus.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.programs
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'kapito') AND name_en = 'Intensive Plus German Course 24' AND duration = '1-23+ weeks'
);

-- ── 4. accommodations ───────────────────────────────────────────────

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'الفئة E - سكن حرم ف+يو التعليمي في بيرغهايم', 'Category E - F+U Bildungscampus Bergheim', 'single_double', 'self_catering', 240, 'EUR', '0.5-1.7 km from school, 8-20 min walk or ~8 min by public transport', NULL, NULL, 'Private room in the F+U Bildungscampus residence with own kitchenette and private bathroom (shower, WC, washbasin), bed, wardrobe, desk and chair.', 'غرفة مستقلة في سكن جامعي ضمن حرم ف+يو التعليمي، مع مطبخ صغير وحمام خاص لكل غرفة (دوش، مرحاض، مغسلة)، سرير وخزانة ومكتب وكرسي.', 'Private room in the F+U Bildungscampus residence with own kitchenette and private bathroom (shower, WC, washbasin), bed, wardrobe, desk and chair.', '[{"from_weeks":1,"to_weeks":6,"price":355},{"from_weeks":7,"to_weeks":16,"price":305},{"from_weeks":17,"to_weeks":29,"price":250},{"from_weeks":30,"to_weeks":null,"price":240}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/accommodations/category-e-bergheim-1.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-e-bergheim-2.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-e-bergheim-3.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-e-bergheim-4.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-e-bergheim-5.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Category E - F+U Bildungscampus Bergheim'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'الفئة E (غرفة مزدوجة) - سكن حرم ف+يو التعليمي في بيرغهايم', 'Category E (Double room) - F+U Bildungscampus Bergheim', 'double', 'self_catering', 370, 'EUR', '0.5-1.7 km from school, 8-20 min walk or ~8 min by public transport', NULL, NULL, 'Double room in the F+U Bildungscampus residence with own kitchenette and private bathroom (shower, WC, washbasin). Price per person per week.', 'غرفة مزدوجة في سكن جامعي ضمن حرم ف+يو التعليمي، مع مطبخ صغير وحمام خاص لكل غرفة (دوش، مرحاض، مغسلة). السعر للشخص الواحد في الأسبوع.', 'Double room in the F+U Bildungscampus residence with own kitchenette and private bathroom (shower, WC, washbasin). Price per person per week.', '[{"from_weeks":1,"to_weeks":6,"price":565},{"from_weeks":7,"to_weeks":16,"price":480},{"from_weeks":17,"to_weeks":29,"price":390},{"from_weeks":30,"to_weeks":null,"price":370}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/accommodations/category-e-bergheim-1.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-e-bergheim-2.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-e-bergheim-3.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-e-bergheim-4.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-e-bergheim-5.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Category E (Double room) - F+U Bildungscampus Bergheim'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'الفئة E - سكن وسط المدينة التاريخي (ميرغاسه)', 'Category E - Märzgasse Heidelberg Old Town', 'single_double', 'self_catering', 240, 'EUR', 'In the old town centre, ~8-20 min from school', NULL, NULL, 'Residence in the old town centre; each room has its own kitchenette and private bathroom (shower, WC, washbasin). Sample pictures.', 'سكن جامعي في وسط المدينة التاريخي، كل غرفة بمطبخ صغير وحمام خاص (دوش، مرحاض، مغسلة). الصور نموذجية للسكن.', 'Residence in the old town centre; each room has its own kitchenette and private bathroom (shower, WC, washbasin). Sample pictures.', '[{"from_weeks":1,"to_weeks":6,"price":355},{"from_weeks":7,"to_weeks":16,"price":305},{"from_weeks":17,"to_weeks":29,"price":250},{"from_weeks":30,"to_weeks":null,"price":240}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/accommodations/category-e-maerzgasse-1.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-e-maerzgasse-2.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-e-maerzgasse-3.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-e-maerzgasse-4.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Category E - Märzgasse Heidelberg Old Town'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'الفئة E (غرفة مزدوجة) - سكن وسط المدينة التاريخي (ميرغاسه)', 'Category E (Double room) - Märzgasse Heidelberg Old Town', 'double', 'self_catering', 370, 'EUR', 'In the old town centre, ~8-20 min from school', NULL, NULL, 'Double room in the old town residence; each room has its own kitchenette and private bathroom. Price per person per week. Sample pictures.', 'غرفة مزدوجة في سكن جامعي وسط المدينة التاريخي، كل غرفة بمطبخ صغير وحمام خاص. السعر للشخص الواحد في الأسبوع. الصور نموذجية للسكن.', 'Double room in the old town residence; each room has its own kitchenette and private bathroom. Price per person per week. Sample pictures.', '[{"from_weeks":1,"to_weeks":6,"price":565},{"from_weeks":7,"to_weeks":16,"price":480},{"from_weeks":17,"to_weeks":29,"price":390},{"from_weeks":30,"to_weeks":null,"price":370}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/accommodations/category-e-maerzgasse-1.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-e-maerzgasse-2.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-e-maerzgasse-3.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-e-maerzgasse-4.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Category E (Double room) - Märzgasse Heidelberg Old Town'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'الفئة D - شقق غرفة واحدة في بيرغهايم', 'Category D - One-bedroom flats Bergheim', 'single', 'self_catering', 225, 'EUR', 'Bergheim, 1.7 km from school, 8-20 min walk or ~8 min by public transport', NULL, NULL, 'One-bedroom flat with private bathroom (shower, WC, sink) and a kitchen shared with other language students.', 'شقة من غرفة واحدة مع حمام خاص (دوش، مرحاض، مغسلة) ومطبخ مشترك مع طلاب لغة آخرين.', 'One-bedroom flat with private bathroom (shower, WC, sink) and a kitchen shared with other language students.', '[{"from_weeks":1,"to_weeks":6,"price":320},{"from_weeks":7,"to_weeks":16,"price":285},{"from_weeks":17,"to_weeks":29,"price":240},{"from_weeks":30,"to_weeks":null,"price":225}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/accommodations/category-d-1.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-d-2.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-d-3.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-d-4.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-d-5.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Category D - One-bedroom flats Bergheim'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'الفئة C - شقق من غرفتين في ميرغاسه', 'Category C - Two-room flats Märzgasse', 'single_double', 'self_catering', 210, 'EUR', 'Directly in the old town, ~500 m / 8-10 min walk from school', NULL, NULL, 'Small two-room flats in the Märzgasse residence; residents of each flat share a pantry kitchen and a modern bathroom with washbasin, shower and WC.', 'شقق صغيرة من غرفتين في سكن الجامعة في ميرغاسه، يتشارك سكان كل شقة في مطبخ صغير وحمام حديث (مغسلة، دوش، مرحاض).', 'Small two-room flats in the Märzgasse residence; residents of each flat share a pantry kitchen and a modern bathroom with washbasin, shower and WC.', '[{"from_weeks":1,"to_weeks":6,"price":315},{"from_weeks":7,"to_weeks":16,"price":270},{"from_weeks":17,"to_weeks":29,"price":220},{"from_weeks":30,"to_weeks":null,"price":210}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/accommodations/category-c-1.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-c-2.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-c-3.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-c-4.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-c-5.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Category C - Two-room flats Märzgasse'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'الفئة C (غرفة مزدوجة) - شقق من غرفتين في ميرغاسه', 'Category C (Double room) - Two-room flats Märzgasse', 'double', 'self_catering', 305, 'EUR', 'Directly in the old town, ~500 m / 8-10 min walk from school', NULL, NULL, 'Double room in a two-room flat in the Märzgasse residence; residents share a pantry kitchen and a modern bathroom. Price per person per week.', 'غرفة مزدوجة في شقة من غرفتين ضمن سكن الجامعة في ميرغاسه، يتشارك السكان في مطبخ صغير وحمام حديث. السعر للشخص الواحد في الأسبوع.', 'Double room in a two-room flat in the Märzgasse residence; residents share a pantry kitchen and a modern bathroom. Price per person per week.', '[{"from_weeks":1,"to_weeks":6,"price":470},{"from_weeks":7,"to_weeks":16,"price":405},{"from_weeks":17,"to_weeks":29,"price":315},{"from_weeks":30,"to_weeks":null,"price":305}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/accommodations/category-c-1.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-c-2.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-c-3.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-c-4.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-c-5.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Category C (Double room) - Two-room flats Märzgasse'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'الفئة B+ - حمام خاص مع مطبخ مشترك', 'Category B+ - Private bathroom, shared kitchen', 'single', 'self_catering', 210, 'EUR', 'Franz-Marc-Strasse 19; ~18 min by tram from Bismarckplatz', NULL, NULL, 'Single room in the Franz-Marc-Strasse 19 residence with private bathroom; kitchen shared with other students; washing machines and dryers available.', 'غرفة مفردة في سكن بفرع مارك شتراسه 19 مع حمام خاص، مطبخ مشترك مع طلاب آخرين، وتتوفر غسالات ومجففات.', 'Single room in the Franz-Marc-Strasse 19 residence with private bathroom; kitchen shared with other students; washing machines and dryers available.', '[{"from_weeks":1,"to_weeks":6,"price":265},{"from_weeks":7,"to_weeks":16,"price":245},{"from_weeks":17,"to_weeks":29,"price":210},{"from_weeks":30,"to_weeks":null,"price":210}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/accommodations/category-bplus-1.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-bplus-2.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-bplus-3.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Category B+ - Private bathroom, shared kitchen'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'الفئة B - سكن شميت في كيرشهايم', 'Category B - Schmitt hall of residence Kirchheim', 'single_double', 'self_catering', 180, 'EUR', '5 km from school, ~15-25 min by public transport', NULL, NULL, 'Residence 5 km away. The communal kitchen is a central meeting point; toilet on the same floor. Each room has a bed, wardrobe, desk, chair, Wi-Fi, refrigerator, shower and sink.', 'سكن جامعي على بُعد 5 كم. المطبخ المشترك نقطة التقاء الطلاب، المرحاض في نفس الطابق، كل غرفة مجهزة بسرير وخزانة ومكتب وكرسي وواي فاي وثلاجة ودوش ومغسلة.', 'Residence 5 km away. The communal kitchen is a central meeting point; toilet on the same floor. Each room has a bed, wardrobe, desk, chair, Wi-Fi, refrigerator, shower and sink.', '[{"from_weeks":1,"to_weeks":6,"price":215},{"from_weeks":7,"to_weeks":16,"price":205},{"from_weeks":17,"to_weeks":29,"price":190},{"from_weeks":30,"to_weeks":null,"price":180}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/accommodations/category-b-schmitt-1.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-b-schmitt-2.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-b-schmitt-3.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Category B - Schmitt hall of residence Kirchheim'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'الفئة B (غرفة مزدوجة) - سكن شميت في كيرشهايم', 'Category B (Double room) - Schmitt hall of residence Kirchheim', 'double', 'self_catering', 245, 'EUR', '5 km from school, ~15-25 min by public transport', NULL, NULL, 'Double room at the Schmitt residence. The communal kitchen is a central meeting point; toilet on the same floor. Each room has a bed, wardrobe, desk, chair, Wi-Fi, refrigerator, shower and sink. Price per person per week.', 'غرفة مزدوجة في سكن شميت. المطبخ المشترك نقطة التقاء الطلاب، المرحاض في نفس الطابق، كل غرفة مجهزة بسرير وخزانة ومكتب وكرسي وواي فاي وثلاجة ودوش ومغسلة. السعر للشخص الواحد في الأسبوع.', 'Double room at the Schmitt residence. The communal kitchen is a central meeting point; toilet on the same floor. Each room has a bed, wardrobe, desk, chair, Wi-Fi, refrigerator, shower and sink. Price per person per week.', '[{"from_weeks":1,"to_weeks":6,"price":300},{"from_weeks":7,"to_weeks":16,"price":290},{"from_weeks":17,"to_weeks":29,"price":265},{"from_weeks":30,"to_weeks":null,"price":245}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/accommodations/category-b-schmitt-1.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-b-schmitt-2.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-b-schmitt-3.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Category B (Double room) - Schmitt hall of residence Kirchheim'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'الفئة A - سكن شميت (شقة مشتركة)', 'Category A - Schmitt hall of residence (shared flat)', 'single', 'self_catering', 155, 'EUR', '5-7 km from school, ~25-30 min by public transport', NULL, NULL, 'In Category A residences residents share the communal kitchen, showers and toilets. Rooms have a wardrobe, bed, chair, desk, refrigerator and sink.', 'في سكن الفئة A يتشارك السكان في المطبخ والحمامات والمراحيض المشتركة. الغرف مجهزة بخزانة وسرير وكرسي ومكتب وثلاجة ومغسلة.', 'In Category A residences residents share the communal kitchen, showers and toilets. Rooms have a wardrobe, bed, chair, desk, refrigerator and sink.', '[{"from_weeks":1,"to_weeks":6,"price":200},{"from_weeks":7,"to_weeks":16,"price":185},{"from_weeks":17,"to_weeks":29,"price":165},{"from_weeks":30,"to_weeks":null,"price":155}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/accommodations/category-a-schmitt-1.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-a-schmitt-2.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-a-schmitt-3.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Category A - Schmitt hall of residence (shared flat)'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'الفئة A - سكن كونكورديا (شقة مشتركة)', 'Category A - Concordia hall of residence (shared flat)', 'single', 'self_catering', 155, 'EUR', '5-7 km from school, Rohrbacher-Strasse 126', NULL, NULL, 'Shared flat at the Concordia residence: communal kitchen as a central meeting point, shared showers and toilets, fully furnished rooms.', 'شقة مشتركة في سكن كونكورديا: مطبخ مشترك قاعة مركزية، ومراحيض ودُش مشتركة، غرف مجهزة بالكامل.', 'Shared flat at the Concordia residence: communal kitchen as a central meeting point, shared showers and toilets, fully furnished rooms.', '[{"from_weeks":1,"to_weeks":6,"price":200},{"from_weeks":7,"to_weeks":16,"price":185},{"from_weeks":17,"to_weeks":29,"price":165},{"from_weeks":30,"to_weeks":null,"price":155}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/accommodations/category-a-concordia-1.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-a-concordia-2.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-a-concordia-3.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-a-concordia-4.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Category A - Concordia hall of residence (shared flat)'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'الفئة A - سكن تورنرشتراسه في رودباخ (شقة مشتركة)', 'Category A - Turnerstrasse Rohrbach (shared flat)', 'single', 'self_catering', 155, 'EUR', 'Turnerstrasse, ~25-30 min by public transport', NULL, NULL, 'Shared flat in Rohrbach with communal kitchen, shared bathrooms and rooms furnished with a bed, wardrobe, desk, refrigerator and sink.', 'شقة مشتركة في حي رودباخ مع مطبخ مشترك وحمامات مشتركة وغرف مجهزة بسرير وخزانة ومكتب وثلاجة ومغسلة.', 'Shared flat in Rohrbach with communal kitchen, shared bathrooms and rooms furnished with a bed, wardrobe, desk, refrigerator and sink.', '[{"from_weeks":1,"to_weeks":6,"price":200},{"from_weeks":7,"to_weeks":16,"price":185},{"from_weeks":17,"to_weeks":29,"price":165},{"from_weeks":30,"to_weeks":null,"price":155}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/accommodations/category-a-turner-1.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-a-turner-2.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-a-turner-3.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Category A - Turnerstrasse Rohrbach (shared flat)'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'fu-academy'), 'الفئة A - سكن فرانتس مارك شتراسه (شقة مشتركة)', 'Category A - Franz-Marc-Strasse (shared flat)', 'single', 'self_catering', 155, 'EUR', 'Franz-Marc-Strasse, ~25-30 min by public transport', NULL, NULL, 'Shared flat at the Franz-Marc-Strasse residence with communal kitchen, shared showers and toilets and furnished rooms.', 'شقة مشتركة في سكن فرانتس مارك مع مطبخ مشترك ومراحيض ودش مشتركة وغرف مفروشة.', 'Shared flat at the Franz-Marc-Strasse residence with communal kitchen, shared showers and toilets and furnished rooms.', '[{"from_weeks":1,"to_weeks":6,"price":200},{"from_weeks":7,"to_weeks":16,"price":185},{"from_weeks":17,"to_weeks":29,"price":165},{"from_weeks":30,"to_weeks":null,"price":155}]'::jsonb, ARRAY['/lovable-uploads/schools/fu-academy/accommodations/category-a-franzmarc-1.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-a-franzmarc-2.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-a-franzmarc-3.jpg', '/lovable-uploads/schools/fu-academy/accommodations/category-a-franzmarc-4.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'fu-academy') AND name_en = 'Category A - Franz-Marc-Strasse (shared flat)'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'), 'سكن الطلاب - غرفة مفردة وسط النوع A', 'Student Residence - Single Central A', 'single', 'self_catering', 190, 'EUR', 'City centre of Heidelberg', NULL, NULL, 'Single room in a student residence in central Heidelberg, sharing bathroom and kitchen with other residents on the same floor.', 'غرفة مفردة في سكن طلابي وسط مدينة هايدلبرغ، تتشارك الحمام والمطبخ مع سكان الطابق.', 'Single room in a student residence in central Heidelberg, sharing bathroom and kitchen with other residents on the same floor.', '[{"from_weeks":1,"to_weeks":2,"price":300},{"from_weeks":3,"to_weeks":4,"price":245},{"from_weeks":5,"to_weeks":12,"price":230},{"from_weeks":13,"to_weeks":26,"price":215},{"from_weeks":27,"to_weeks":null,"price":190}]'::jsonb, ARRAY['/lovable-uploads/schools/alpha-aktiv/school/residence.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv') AND name_en = 'Student Residence - Single Central A'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'), 'سكن الطلاب - غرفة مفردة وسط النوع B', 'Student Residence - Single Central B', 'single', 'self_catering', 170, 'EUR', 'City centre of Heidelberg', NULL, NULL, 'Single room in a central student residence with shared bathroom and kitchen on the floor.', 'غرفة مفردة في سكن طلابي وسط المدينة مع حمام ومطبخ مشتركين مع سكان الطابق.', 'Single room in a central student residence with shared bathroom and kitchen on the floor.', '[{"from_weeks":1,"to_weeks":2,"price":280},{"from_weeks":3,"to_weeks":4,"price":220},{"from_weeks":5,"to_weeks":12,"price":190},{"from_weeks":13,"to_weeks":26,"price":175},{"from_weeks":27,"to_weeks":null,"price":170}]'::jsonb, ARRAY['/lovable-uploads/schools/alpha-aktiv/school/residence.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv') AND name_en = 'Student Residence - Single Central B'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'), 'سكن الطلاب - غرفة مفردة خارج المركز', 'Student Residence - Single Not Central', 'single', 'self_catering', 155, 'EUR', 'Ziegelhausen district', NULL, NULL, 'Single room in the student residence in the idyllic Ziegelhausen district, sharing kitchen and bathroom with residents on the floor.', 'غرفة مفردة في سكن الطلاب بحي زيغلهاوزن الهادئ، مطبخ وحمام مشتركان مع سكان الطابق.', 'Single room in the student residence in the idyllic Ziegelhausen district, sharing kitchen and bathroom with residents on the floor.', '[{"from_weeks":1,"to_weeks":2,"price":230},{"from_weeks":3,"to_weeks":4,"price":190},{"from_weeks":5,"to_weeks":12,"price":165},{"from_weeks":13,"to_weeks":26,"price":160},{"from_weeks":27,"to_weeks":null,"price":155}]'::jsonb, ARRAY['/lovable-uploads/schools/alpha-aktiv/school/residence.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv') AND name_en = 'Student Residence - Single Not Central'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'), 'سكن الطلاب - غرفة مزدوجة وسط النوع A', 'Student Residence - Double Central A', 'double', 'self_catering', 160, 'EUR', 'City centre of Heidelberg', NULL, NULL, 'Double room in a central student residence, price per person per week, shared bathroom and kitchen.', 'غرفة مزدوجة في سكن طلابي وسط المدينة، سعر للشخص الواحد في الأسبوع، حمام ومطبخ مشتركان.', 'Double room in a central student residence, price per person per week, shared bathroom and kitchen.', '[{"from_weeks":1,"to_weeks":2,"price":240},{"from_weeks":3,"to_weeks":4,"price":200},{"from_weeks":5,"to_weeks":12,"price":180},{"from_weeks":13,"to_weeks":26,"price":170},{"from_weeks":27,"to_weeks":null,"price":160}]'::jsonb, ARRAY['/lovable-uploads/schools/alpha-aktiv/school/residence.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv') AND name_en = 'Student Residence - Double Central A'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'), 'سكن الطلاب - غرفة مزدوجة وسط النوع B', 'Student Residence - Double Central B', 'double', 'self_catering', 140, 'EUR', 'City centre of Heidelberg', NULL, NULL, 'Double room in a central student residence, price per person per week.', 'غرفة مزدوجة في سكن طلابي وسط المدينة، سعر للشخص الواحد في الأسبوع.', 'Double room in a central student residence, price per person per week.', '[{"from_weeks":1,"to_weeks":2,"price":225},{"from_weeks":3,"to_weeks":4,"price":170},{"from_weeks":5,"to_weeks":12,"price":160},{"from_weeks":13,"to_weeks":26,"price":150},{"from_weeks":27,"to_weeks":null,"price":140}]'::jsonb, ARRAY['/lovable-uploads/schools/alpha-aktiv/school/residence.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv') AND name_en = 'Student Residence - Double Central B'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'), 'سكن الطلاب - غرفة مزدوجة خارج المركز', 'Student Residence - Double Not Central', 'double', 'self_catering', 140, 'EUR', 'Ziegelhausen district', NULL, NULL, 'Double room in the Ziegelhausen student residence, price per person per week.', 'غرفة مزدوجة في سكن الطلاب بحي زيغلهاوزن، سعر للشخص الواحد في الأسبوع.', 'Double room in the Ziegelhausen student residence, price per person per week.', '[{"from_weeks":1,"to_weeks":2,"price":215},{"from_weeks":3,"to_weeks":4,"price":160},{"from_weeks":5,"to_weeks":12,"price":145},{"from_weeks":13,"to_weeks":26,"price":140},{"from_weeks":27,"to_weeks":null,"price":140}]'::jsonb, ARRAY['/lovable-uploads/schools/alpha-aktiv/school/residence.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv') AND name_en = 'Student Residence - Double Not Central'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'), 'شقة مفردة - غرفة واحدة (بسماركبلاتس)', 'Apartment - Single 1 room (Bismarckplatz)', 'single', 'self_catering', 240, 'EUR', 'Bismarckplatz, Heidelberg', NULL, NULL, 'One-room apartment with its own bathroom and kitchenette inside.', 'شقة من غرفة واحدة مع حمام ومطبخ صغير خاص داخل الشقة.', 'One-room apartment with its own bathroom and kitchenette inside.', '[{"from_weeks":1,"to_weeks":2,"price":370},{"from_weeks":3,"to_weeks":4,"price":305},{"from_weeks":5,"to_weeks":12,"price":295},{"from_weeks":13,"to_weeks":26,"price":265},{"from_weeks":27,"to_weeks":null,"price":240}]'::jsonb, ARRAY['/lovable-uploads/schools/alpha-aktiv/school/hero.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv') AND name_en = 'Apartment - Single 1 room (Bismarckplatz)'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'), 'شقة مفردة - غرفتان (بسماركبلاتس)', 'Apartment - Single 2 rooms (Bismarckplatz)', 'single', 'self_catering', 295, 'EUR', 'Bismarckplatz, Heidelberg', NULL, NULL, 'Two-room apartment with its own bathroom and kitchenette.', 'شقة من غرفتين مع حمام ومطبخ صغير خاص.', 'Two-room apartment with its own bathroom and kitchenette.', '[{"from_weeks":1,"to_weeks":2,"price":440},{"from_weeks":3,"to_weeks":4,"price":360},{"from_weeks":5,"to_weeks":12,"price":325},{"from_weeks":13,"to_weeks":26,"price":305},{"from_weeks":27,"to_weeks":null,"price":295}]'::jsonb, ARRAY['/lovable-uploads/schools/alpha-aktiv/school/hero.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv') AND name_en = 'Apartment - Single 2 rooms (Bismarckplatz)'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'), 'شقة مزدوجة - غرفتان (بسماركبلاتس)', 'Apartment - Double 2 rooms (Bismarckplatz)', 'double', 'self_catering', 215, 'EUR', 'Bismarckplatz, Heidelberg', NULL, NULL, 'Two-room apartment for two people with its own bathroom and kitchenette.', 'شقة من غرفتين لشخصين مع حمام ومطبخ صغير خاص.', 'Two-room apartment for two people with its own bathroom and kitchenette.', '[{"from_weeks":1,"to_weeks":2,"price":335},{"from_weeks":3,"to_weeks":4,"price":285},{"from_weeks":5,"to_weeks":12,"price":260},{"from_weeks":13,"to_weeks":26,"price":240},{"from_weeks":27,"to_weeks":null,"price":215}]'::jsonb, ARRAY['/lovable-uploads/schools/alpha-aktiv/school/hero.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv') AND name_en = 'Apartment - Double 2 rooms (Bismarckplatz)'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'), 'شقة مزدوجة - استوديو (بسماركبلاتس)', 'Apartment - Double Studio (Bismarckplatz)', 'double', 'self_catering', 200, 'EUR', 'Bismarckplatz, Heidelberg', NULL, NULL, 'Studio apartment for two with its own bathroom and kitchenette.', 'شقة استوديو لشخصين مع حمام ومطبخ صغير خاص.', 'Studio apartment for two with its own bathroom and kitchenette.', '[{"from_weeks":1,"to_weeks":2,"price":350},{"from_weeks":3,"to_weeks":4,"price":275},{"from_weeks":5,"to_weeks":12,"price":250},{"from_weeks":13,"to_weeks":26,"price":235},{"from_weeks":27,"to_weeks":null,"price":200}]'::jsonb, ARRAY['/lovable-uploads/schools/alpha-aktiv/school/hero.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv') AND name_en = 'Apartment - Double Studio (Bismarckplatz)'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'), 'عائلة مضيفة', 'Host Family', 'single', 'half_board', 320, 'EUR', 'Various locations in Heidelberg', 200, 100, 'Stay with a selected German family on half board (breakfast and dinner) to experience German life and practise the language daily.', 'الإقامة مع عائلة ألمانية مختارة بنظام نصف إقامة (فطور وعشاء) للتعرف على نمط الحياة الألمانية وممارسة اللغة يوميًا.', 'Stay with a selected German family on half board (breakfast and dinner) to experience German life and practise the language daily.', '[{"from_weeks":1,"to_weeks":null,"price":320}]'::jsonb, ARRAY['/lovable-uploads/schools/alpha-aktiv/school/hero.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv') AND name_en = 'Host Family'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'go-academy'), 'شقة قياسية - غرفة مزدوجة (TWN)', 'Standard Apartment (TWN)', 'double', 'self_catering', 130, 'EUR', '20-35 min from school on foot or by public transport', NULL, 90, 'Twin room in a standard shared apartment with shared bathroom and fully equipped kitchen.', 'غرفة مزدوجة في شقة مشتركة قياسية مع حمام ومطبخ مجهز بالكامل مشتركين.', 'Twin room in a standard shared apartment with shared bathroom and fully equipped kitchen.', '[{"from_weeks":1,"to_weeks":4,"price":165},{"from_weeks":5,"to_weeks":23,"price":145},{"from_weeks":24,"to_weeks":null,"price":130}]'::jsonb, ARRAY['/lovable-uploads/schools/go-academy/school/accommodation-hero.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'go-academy') AND name_en = 'Standard Apartment (TWN)'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'go-academy'), 'شقة قياسية - غرفة مفردة (SGL)', 'Standard Apartment (SGL)', 'single', 'self_catering', 180, 'EUR', '20-35 min from school on foot or by public transport', NULL, 90, 'Single room in a standard shared apartment with shared bathroom and fully equipped kitchen.', 'غرفة مفردة في شقة مشتركة قياسية مع حمام ومطبخ مجهز بالكامل مشتركين.', 'Single room in a standard shared apartment with shared bathroom and fully equipped kitchen.', '[{"from_weeks":1,"to_weeks":4,"price":220},{"from_weeks":5,"to_weeks":23,"price":195},{"from_weeks":24,"to_weeks":null,"price":180}]'::jsonb, ARRAY['/lovable-uploads/schools/go-academy/school/accommodation-hero.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'go-academy') AND name_en = 'Standard Apartment (SGL)'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'go-academy'), 'شقة كومفورت - غرفة مزدوجة (TWN)', 'Comfort Apartment (TWN)', 'double', 'self_catering', 150, 'EUR', '5-10 min from school on foot', NULL, 90, 'Twin room in a Comfort apartment 5-10 min from school; washing machines always available.', 'غرفة مزدوجة في شقة كومفورت على بُعد 5-10 دقائق من المدرسة، مع خدمة غسيل في المبنى.', 'Twin room in a Comfort apartment 5-10 min from school; washing machines always available.', '[{"from_weeks":1,"to_weeks":4,"price":185},{"from_weeks":5,"to_weeks":23,"price":165},{"from_weeks":24,"to_weeks":null,"price":150}]'::jsonb, ARRAY['/lovable-uploads/schools/go-academy/school/accommodation-hero.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'go-academy') AND name_en = 'Comfort Apartment (TWN)'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'go-academy'), 'شقة كومفورت - غرفة مفردة (SGL)', 'Comfort Apartment (SGL)', 'single', 'self_catering', 210, 'EUR', '5-10 min from school on foot', NULL, 90, 'Single room in a Comfort apartment close to the school, with in-building laundry service.', 'غرفة مفردة في شقة كومفورت قريبة من المدرسة، مع خدمة غسيل في المبنى.', 'Single room in a Comfort apartment close to the school, with in-building laundry service.', '[{"from_weeks":1,"to_weeks":4,"price":245},{"from_weeks":5,"to_weeks":23,"price":225},{"from_weeks":24,"to_weeks":null,"price":210}]'::jsonb, ARRAY['/lovable-uploads/schools/go-academy/school/accommodation-hero.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'go-academy') AND name_en = 'Comfort Apartment (SGL)'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'go-academy'), 'استوديو خاص (SGL)', 'Studio', 'studio', 'self_catering', 270, 'EUR', '10-25 min from school on foot', NULL, 90, 'Private one-bedroom studio with its own bathroom and kitchen, perfect for maximum privacy and independence.', 'شقة استوديو خاصة من غرفة نوم واحدة مع حمام ومطبخ خاصين، لخصوصية واستقلالية كاملة.', 'Private one-bedroom studio with its own bathroom and kitchen, perfect for maximum privacy and independence.', '[{"from_weeks":1,"to_weeks":4,"price":360},{"from_weeks":5,"to_weeks":23,"price":310},{"from_weeks":24,"to_weeks":null,"price":270}]'::jsonb, ARRAY['/lovable-uploads/schools/go-academy/school/accommodation-hero.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'go-academy') AND name_en = 'Studio'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'go-academy'), 'عائلة مضيفة - فطور فقط (B&B)', 'Host Family (B&B)', 'single', 'breakfast', 250, 'EUR', 'Various locations in Düsseldorf', NULL, 90, 'Single room with breakfast in a host family.', 'غرفة مفردة مع فطور في عائلة مضيفة.', 'Single room with breakfast in a host family.', '[{"from_weeks":1,"to_weeks":4,"price":310},{"from_weeks":5,"to_weeks":23,"price":270},{"from_weeks":24,"to_weeks":null,"price":250}]'::jsonb, ARRAY['/lovable-uploads/schools/go-academy/school/accommodation-hero.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'go-academy') AND name_en = 'Host Family (B&B)'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'go-academy'), 'عائلة مضيفة - نصف إقامة', 'Host Family (Half board)', 'single', 'half_board', 300, 'EUR', 'Various locations in Düsseldorf', NULL, 90, 'Single room on half board (breakfast and dinner) in a host family.', 'غرفة مفردة بنظام نصف إقامة (فطور وعشاء) في عائلة مضيفة.', 'Single room on half board (breakfast and dinner) in a host family.', '[{"from_weeks":1,"to_weeks":4,"price":390},{"from_weeks":5,"to_weeks":23,"price":320},{"from_weeks":24,"to_weeks":null,"price":300}]'::jsonb, ARRAY['/lovable-uploads/schools/go-academy/school/accommodation-hero.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'go-academy') AND name_en = 'Host Family (Half board)'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'kapito'), 'غرفة مفردة بدون وجبات', 'Single room, no meals included', 'single', 'self_catering', 110, 'EUR', 'City centre of Münster, most under 30 min by bus/bike', 400, 150, 'Single room in a shared flat with 1-3 German occupants (family, flatmates or a single person), sharing kitchen and bathroom. Rooms available for the course period only.', 'غرفة مفردة في شقة مشتركة مع 1-3 سكان ألمان (عائلة أو زملاء شقة)، مشاركة المطبخ والحمام. الإقامة متاحة لفترة الدورة فقط.', 'Single room in a shared flat with 1-3 German occupants (family, flatmates or a single person), sharing kitchen and bathroom. Rooms available for the course period only.', '[{"from_weeks":1,"to_weeks":null,"price":110}]'::jsonb, ARRAY['/lovable-uploads/schools/kapito/accommodations/homestay-1.jpg', '/lovable-uploads/schools/kapito/accommodations/homestay-2.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'kapito') AND name_en = 'Single room, no meals included'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'kapito'), 'غرفة مفردة مع فطور', 'Single room with breakfast', 'single', 'breakfast', 135, 'EUR', 'City centre of Münster, most under 30 min by bus/bike', 400, 150, 'Single room with a family or single person; breakfast included and in most cases kitchen use is possible.', 'غرفة مفردة مع عائلة أو شخص بمفرده، الفطور مشمول وفي معظم الحالات يمكن استخدام المطبخ أيضًا.', 'Single room with a family or single person; breakfast included and in most cases kitchen use is possible.', '[{"from_weeks":1,"to_weeks":null,"price":135}]'::jsonb, ARRAY['/lovable-uploads/schools/kapito/accommodations/homestay-2.jpg', '/lovable-uploads/schools/kapito/accommodations/homestay-3.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'kapito') AND name_en = 'Single room with breakfast'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'kapito'), 'غرفة مفردة بنصف إقامة', 'Single room with half-board', 'single', 'half_board', 195, 'EUR', 'City centre of Münster, most under 30 min by bus/bike', 400, 150, 'Single room with a family or single person; breakfast and evening meals included; full board at weekends.', 'غرفة مفردة مع عائلة أو شخص بمفرده، الفطور والعشاء مشمولان، ونظام إقامة كامل في عطلات نهاية الأسبوع.', 'Single room with a family or single person; breakfast and evening meals included; full board at weekends.', '[{"from_weeks":1,"to_weeks":null,"price":195}]'::jsonb, ARRAY['/lovable-uploads/schools/kapito/accommodations/homestay-3.jpg', '/lovable-uploads/schools/kapito/accommodations/homestay-1.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'kapito') AND name_en = 'Single room with half-board'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'kapito'), 'شقة خاصة بدون وجبات', 'Private apartment (self-catering)', 'apartment', 'self_catering', 200, 'EUR', 'City centre of Münster', 600, 150, 'Private apartment with kitchen/cooking facilities and a bathroom. Self-catering. Minimum age: 23.', 'شقة خاصة مع مطبخ وأدوات طهي وحمام، الإقامة الذاتية. الحد الأدنى للعمر: 23 عامًا.', 'Private apartment with kitchen/cooking facilities and a bathroom. Self-catering. Minimum age: 23.', '[{"from_weeks":1,"to_weeks":null,"price":200}]'::jsonb, ARRAY['/lovable-uploads/schools/kapito/accommodations/studio-generic.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'kapito') AND name_en = 'Private apartment (self-catering)'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'kapito'), 'استوديو كابيتو 1', 'KAPITO Studio 1', 'studio', 'self_catering', 225, 'EUR', 'Germania Campus, ~3 km from KAPITO (bus)', 600, 150, 'Fully furnished studio (21 m²) with fully equipped kitchen and bathroom, small balcony, Wi-Fi, TV, ~3 km from school. Minimum age: 18. 4-week all-inclusive from €850.', 'استوديو مفروش بالكامل (21 م²) مع مطبخ مجهز بالكامل وحمام، شرفة صغيرة، واي فاي، تلفاز، حوالي 3 كم من المدرسة. الحد الأدنى للعمر: 18 عامًا.', 'Fully furnished studio (21 m²) with fully equipped kitchen and bathroom, small balcony, Wi-Fi, TV, ~3 km from school. Minimum age: 18. 4-week all-inclusive from €850.', '[{"from_weeks":1,"to_weeks":null,"price":225}]'::jsonb, ARRAY['/lovable-uploads/schools/kapito/accommodations/studio1-1.jpg', '/lovable-uploads/schools/kapito/accommodations/studio1-2.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'kapito') AND name_en = 'KAPITO Studio 1'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'kapito'), 'استوديو كابيتو 2', 'KAPITO Studio 2', 'studio', 'self_catering', 225, 'EUR', 'Germania Campus, ~3 km from KAPITO (bus)', 600, 150, 'Fully furnished studio (22 m²) with fully equipped kitchen and bathroom, balcony, Wi-Fi, TV. Minimum age: 18.', 'استوديو مفروش بالكامل (22 م²) مع مطبخ وحمام مجهزين بالكامل، شرفة، واي فاي، تلفاز. الحد الأدنى للعمر: 18 عامًا.', 'Fully furnished studio (22 m²) with fully equipped kitchen and bathroom, balcony, Wi-Fi, TV. Minimum age: 18.', '[{"from_weeks":1,"to_weeks":null,"price":225}]'::jsonb, ARRAY['/lovable-uploads/schools/kapito/accommodations/studio2-1.jpg', '/lovable-uploads/schools/kapito/accommodations/studio2-2.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'kapito') AND name_en = 'KAPITO Studio 2'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'kapito'), 'استوديو كابيتو 3', 'KAPITO Studio 3', 'studio', 'self_catering', 225, 'EUR', 'Germania Campus, ~3 km from KAPITO (bus)', 600, 150, 'Fully furnished studio (22 m²) with fully equipped kitchen and bathroom, balcony, Wi-Fi, TV. Minimum age: 18.', 'استوديو مفروش بالكامل (22 م²) مع مطبخ وحمام مجهزين بالكامل، شرفة، واي فاي، تلفاز. الحد الأدنى للعمر: 18 عامًا.', 'Fully furnished studio (22 m²) with fully equipped kitchen and bathroom, balcony, Wi-Fi, TV. Minimum age: 18.', '[{"from_weeks":1,"to_weeks":null,"price":225}]'::jsonb, ARRAY['/lovable-uploads/schools/kapito/accommodations/studio3-1.jpg', '/lovable-uploads/schools/kapito/accommodations/studio3-2.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'kapito') AND name_en = 'KAPITO Studio 3'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note, deposit, placement_fee, description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'kapito'), 'استوديو كابيتو 4', 'KAPITO Studio 4', 'studio', 'self_catering', 225, 'EUR', 'Germania Campus, ~3 km from KAPITO (bus)', 600, 150, 'Fully furnished studio (23 m²) with fully equipped kitchen and bathroom, balcony, Wi-Fi, TV. Minimum age: 18.', 'استوديو مفروش بالكامل (23 م²) مع مطبخ وحمام مجهزين بالكامل، شرفة، واي فاي، تلفاز. الحد الأدنى للعمر: 18 عامًا.', 'Fully furnished studio (23 m²) with fully equipped kitchen and bathroom, balcony, Wi-Fi, TV. Minimum age: 18.', '[{"from_weeks":1,"to_weeks":null,"price":225}]'::jsonb, ARRAY['/lovable-uploads/schools/kapito/accommodations/studio4-1.jpg', '/lovable-uploads/schools/kapito/accommodations/studio4-2.jpg'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'kapito') AND name_en = 'KAPITO Studio 4'
);

-- ── 5. insurances ──────────────────────────────────────────────────

INSERT INTO public.insurances (name, tier, billing_period, price, currency, provider, coverage_scope, max_age, min_months, max_months, description_ar, description_en, terms_url, is_active)
SELECT 'Care College Comfort', 'comfort', 'monthly', 32, 'EUR', 'Care Concept AG', 'medical_care_hospital_dentist', NULL, NULL, 18, 'تأمين صحي للطلاب يقبل التقديم قبل أو حتى أسبوعين بعد دخول ألمانيا، مع تغطية العلاج الطبي والعلاج في المستشفى وعلاج الأسنان (حتى 500 يورو بنسبة 100%، وما يزيد بنسبة 50%). مدة العقد الأولى تصل إلى 18 شهرًا، ويرجع مبلغ 31 يورو إذا لم تُقدَّم أي فواتير خلال 12 شهرًا.', 'Student health insurance that can be taken out before or up to two weeks after entering Germany, covering medical treatment, hospital treatment and dental care (up to €500 at 100%, above that 50%). Fees for the first 18 contract months €32.00; €31 refund if no invoices submitted within 12 months.', 'https://www.alpha-heidelberg.de/en/service/health-insurance/', true
WHERE NOT EXISTS (SELECT 1 FROM public.insurances WHERE name = 'Care College Comfort');


-- ── 6. index for slug lookup ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_schools_slug ON public.schools (slug);
