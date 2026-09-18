-- ---------- seed: GoAcademy! Düsseldorf 2026 (partner school) ----------
-- Idempotent: skips entirely when the school already exists.
DO $$
DECLARE
  v_country uuid; v_school uuid; v_version uuid; v_course uuid; v_acc uuid;
  v_catalog uuid;
  v_src text := 'GoAcademy! 2026 price list';
  v_doc text := 'price-list-goacademy-german-courses-duesseldorf-2026.pdf';
BEGIN
  IF EXISTS (SELECT 1 FROM public.partner_schools WHERE slug = 'goacademy-dusseldorf') THEN
    RAISE NOTICE 'GoAcademy partner school already exists; skipping';
    RETURN;
  END IF;

  SELECT id INTO v_catalog FROM public.schools WHERE slug = 'go-academy' LIMIT 1;

  INSERT INTO public.partner_countries (slug, name_en, name_ar, flag_emoji, description_en, description_ar, sort_order)
  VALUES ('germany','Germany','ألمانيا','🇩🇪','Language schools and educational partners in Germany','مدارس اللغة والشركاء التعليميون في ألمانيا',1)
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO v_country FROM public.partner_countries WHERE slug = 'germany' LIMIT 1;

  INSERT INTO public.partner_schools (country_id, catalog_school_id, slug, name, city, address, website_url, phone, email,
    partner_status, standard_course_note_en, standard_course_note_ar, minimum_age, last_verified_at, sort_order)
  VALUES (v_country, v_catalog, 'goacademy-dusseldorf', 'GoAcademy! Düsseldorf', 'Düsseldorf', NULL,
    'https://goacademy.de/en/', NULL, NULL, 'partner',
    'GoAcademy! Standard Intensive Course — 20 lessons/week + 5 LMS',
    'دورة المدرسة المكثفة القياسية — 20 حصة أسبوعياً + 5 دروس عبر نظام التعلم الإلكتروني (LMS)', NULL, NULL, 2)
  RETURNING id INTO v_school;

  INSERT INTO public.school_price_versions (school_id, year, currency, label, is_current, summer_supplement_per_week,
    summer_from, summer_to, source_name, source_url, source_document, source_year, last_verified_at)
  VALUES (v_school, 2026, 'EUR', '2026', true, NULL, NULL, NULL,
    v_src, 'https://goacademy.de/en/', v_doc, 2026, NULL)
  RETURNING id INTO v_version;

  -- Standard Intensive (DARB standard)
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, max_students, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, sort_order, source_name, source_document, source_year, last_verified_at, notes)
  VALUES (v_version, 'standard_intensive', 'German Intensive Standard Course — 20 lessons/week', 'الدورة المكثفة القياسية — 20 حصة أسبوعياً',
    20, 45, 'Mon–Fri · morning or afternoon', 'الإثنين–الجمعة · صباحاً أو بعد الظهر', 15, 'A1–C1', true,
    'Every Monday; hybrid — online or face-to-face in Düsseldorf',
    'كل يوم إثنين؛ هجين — عبر الإنترنت أو وجهاً لوجه في دوسلدورف',
    '["Certificate upon completion","LMS online tuition (5 lessons per week)"]'::jsonb,
    1, v_src, v_doc, 2026, NULL,
    '20 lessons of 45 minutes + 5 LMS online lessons per week. Classes normally run 6–15 students, maximum guaranteed 15; if fewer than 6 enrol, the lesson quantity may be reduced.')
  RETURNING id INTO v_course;

  INSERT INTO public.school_course_price_tiers (course_id, from_weeks, to_weeks, price_per_week, kind, sort_order) VALUES
    (v_course,1,4,190,'booking',1),(v_course,5,24,175,'booking',2),(v_course,25,52,165,'booking',3);

  -- High Intensive / Educational Leave
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, max_students, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, sort_order, source_name, source_document, source_year, last_verified_at, notes)
  VALUES (v_version, 'high_intensive', 'High Intensive Course / Educational Leave', 'الدورة عالية المكثفة / الإجازة التعليمية',
    30, 45, 'Mon–Fri · 09:00–14:00', 'الإثنين–الجمعة · 09:00–14:00', 15, 'A1–C1', false,
    'Only in the 2nd and 3rd week of the month', 'فقط في الأسبوعين الثاني والثالث من الشهر',
    '["Certificate upon completion"]'::jsonb,
    2, v_src, v_doc, 2026, NULL,
    '30 lessons of 45 minutes + 5 LMS online lessons per week. If fewer than 6 students enrol, the number of lessons may be reduced.')
  RETURNING id INTO v_course;

  INSERT INTO public.school_course_price_tiers (course_id, from_weeks, to_weeks, price_per_week, kind, sort_order) VALUES
    (v_course,1,2,315,'booking',1);

  -- University Pathway
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, max_students, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, sort_order, source_name, source_document, source_year, last_verified_at, notes)
  VALUES (v_version, 'university_pathway', 'University Pathway', 'المسار الجامعي',
    20, 45, 'Mon–Fri · 09:00–12:15 or 14:00–17:15', 'الإثنين–الجمعة · 09:00–12:15 أو 14:00–17:15', 12, NULL, false,
    NULL, NULL,
    '["1 hour of counselling per week","Support for selection, application and enrolment at a German university","Visa requirement assistance","Examination preparation for TestDaF / telc / TestAS / DSH at the school test centre"]'::jsonb,
    3, v_src, v_doc, 2026, NULL,
    'German entry requirement A1; 6–12 students per class. Admission fee €540, registration €60, Letter of Acceptance €75; the university placement fee is not included. See the University Pathway packages policy.')
  RETURNING id INTO v_course;

  INSERT INTO public.school_course_price_tiers (course_id, from_weeks, to_weeks, price_per_week, kind, sort_order) VALUES
    (v_course,24,48,175,'booking',1);

  -- Vocational Training
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, max_students, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, sort_order, source_name, source_document, source_year, last_verified_at, notes)
  VALUES (v_version, 'vocational_training', 'Vocational Training (German for vocational training)', 'التدريب المهني (الألمانية للتدريب المهني)',
    20, 45, 'Not published', 'غير منشور', 14, NULL, false, NULL, NULL,
    '["1 hour of counselling per week"]'::jsonb,
    4, v_src, v_doc, 2026, NULL,
    '20 lessons + 5 LMS online lessons per week, 12–48 weeks, 7–14 students. Application support €540, registration €60; group and package pricing on quote.')
  RETURNING id INTO v_course;

  INSERT INTO public.school_course_price_tiers (course_id, from_weeks, to_weeks, price_per_week, kind, sort_order) VALUES
    (v_course,12,48,175,'booking',1);

  -- Evening Course (monthly pricing — no weekly tiers; prices recorded as policies)
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, max_students, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, sort_order, source_name, source_document, source_year, last_verified_at, notes)
  VALUES (v_version, 'evening_course', 'Evening Course', 'الدورة المسائية',
    4, 45, 'Mon + Wed or Tue + Thu · 17:45–19:15 or 19:30–21:00', 'الإثنين + الأربعاء أو الثلاثاء + الخميس · 17:45–19:15 أو 19:30–21:00', NULL, 'A0–C1', false,
    NULL, NULL, '[]'::jsonb,
    5, v_src, v_doc, 2026, NULL,
    '16 face-to-face lessons per month + 8 LMS; two lessons twice a week; 45 minutes each. Levels A0, A1, A2, B1, B2, C1 and Business. Monthly price depends on the booked duration — see the Evening Courses policy.')
  RETURNING id INTO v_course;

  -- German for Doctors (fixed total — no weekly tiers)
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, max_students, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, sort_order, source_name, source_document, source_year, last_verified_at, notes)
  VALUES (v_version, 'german_for_doctors', 'German for Doctors', 'الألمانية للأطباء',
    NULL, 45, 'Face-to-face and online training', 'تدريب وجهاً لوجه وعبر الإنترنت', NULL, NULL, false,
    NULL, NULL, '[]'::jsonb,
    6, v_src, v_doc, 2026, NULL,
    '8 weeks · 200 lessons · €920 total (registration €60). 2026 start dates: 27.01, 14.04, 09.06, 04.08, 06.10.')
  RETURNING id INTO v_course;

  -- German for Nursing Staff (fixed total — no weekly tiers)
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, max_students, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, sort_order, source_name, source_document, source_year, last_verified_at, notes)
  VALUES (v_version, 'german_for_nursing', 'German for Nursing Staff', 'الألمانية للكوادر التمريضية',
    NULL, 45, 'Blended learning — 80 face-to-face + 40 online lessons', 'تعليم مدمج — 80 حصة وجهاً لوجه + 40 حصة عبر الإنترنت', NULL, NULL, false,
    NULL, NULL, '[]'::jsonb,
    7, v_src, v_doc, 2026, NULL,
    '4 weeks · 120 lessons (80 face-to-face + 40 online) · €790 total (registration €60). 2026 start dates: 04.05, 05.10.');

  -- Level durations (brochure)
  INSERT INTO public.school_level_durations (school_id, level, weeks, weeks_max, sort_order, source_name, source_document, source_year, last_verified_at, notes) VALUES
    (v_school,'A1',8,8,1,'GoAcademy! German Courses 2026 brochure','goacademy-sprachschule-duesseldorf-german-courses-2026.pdf',2026,NULL,'A1 — Elementary Level'),
    (v_school,'A2',8,8,2,'GoAcademy! German Courses 2026 brochure','goacademy-sprachschule-duesseldorf-german-courses-2026.pdf',2026,NULL,'A2 — Advanced beginners'),
    (v_school,'B1',8,10,3,'GoAcademy! German Courses 2026 brochure','goacademy-sprachschule-duesseldorf-german-courses-2026.pdf',2026,NULL,'B1 — Lower intermediate'),
    (v_school,'B2',10,12,4,'GoAcademy! German Courses 2026 brochure','goacademy-sprachschule-duesseldorf-german-courses-2026.pdf',2026,NULL,'B2 — Upper intermediate'),
    (v_school,'C1',10,12,5,'GoAcademy! German Courses 2026 brochure','goacademy-sprachschule-duesseldorf-german-courses-2026.pdf',2026,NULL,'C1 — Advanced');

  -- Accommodation: 7 options (linked to catalog)
  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals, minimum_age,
    from_price_per_week, arrangement_fee, deposit_amount, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at,
    catalog_accommodation_ids)
  VALUES (v_version,'standard_shared','Standard Apartment — Twin / Shared','الشقة القياسية — غرفة مزدوجة / مشتركة',
    'double','self_catering',NULL,130,90,250,true,
    'Security deposit of €250 per person. Airport transfer (booked in advance with course/accommodation): €100 one way (arrival), €150 both ways (arrival and return).',
    'تأمين أمني 250 يورو للشخص الواحد. النقل من المطار (يُحجز مسبقاً مع الدورة أو السكن): 100 يورو لاتجاه واحد (وصول)، 150 يورو ذهاباً وإياباً (وصول وعودة).',
    false,'Price verified; current availability not confirmed','السعر مؤكد؛ التوفر الحالي غير مؤكد',
    1,v_src,v_doc,2026,NULL,
    ARRAY(SELECT id FROM public.accommodations WHERE school_id = v_catalog AND name_en = 'Standard Apartment (TWN)'))
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, sort_order) VALUES
    (v_acc,1,4,NULL,165,1),(v_acc,5,23,NULL,145,2),(v_acc,24,NULL,NULL,130,3);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals, minimum_age,
    from_price_per_week, arrangement_fee, deposit_amount, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at,
    catalog_accommodation_ids)
  VALUES (v_version,'standard_single','Standard Apartment — Single','الشقة القياسية — غرفة مفردة',
    'single','self_catering',NULL,180,90,250,true,
    'Security deposit of €250 per person. Airport transfer (booked in advance with course/accommodation): €100 one way (arrival), €150 both ways (arrival and return).',
    'تأمين أمني 250 يورو للشخص الواحد. النقل من المطار (يُحجز مسبقاً مع الدورة أو السكن): 100 يورو لاتجاه واحد (وصول)، 150 يورو ذهاباً وإياباً (وصول وعودة).',
    false,'Price verified; current availability not confirmed','السعر مؤكد؛ التوفر الحالي غير مؤكد',
    2,v_src,v_doc,2026,NULL,
    ARRAY(SELECT id FROM public.accommodations WHERE school_id = v_catalog AND name_en = 'Standard Apartment (SGL)'))
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, sort_order) VALUES
    (v_acc,1,4,NULL,220,1),(v_acc,5,23,NULL,195,2),(v_acc,24,NULL,NULL,180,3);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals, minimum_age,
    from_price_per_week, arrangement_fee, deposit_amount, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at,
    catalog_accommodation_ids)
  VALUES (v_version,'comfort_shared','Comfort Apartment — Twin / Shared','شقة الكومفورت — غرفة مزدوجة / مشتركة',
    'double','self_catering',NULL,150,90,250,true,
    'Security deposit of €250 per person. Airport transfer (booked in advance with course/accommodation): €100 one way (arrival), €150 both ways (arrival and return).',
    'تأمين أمني 250 يورو للشخص الواحد. النقل من المطار (يُحجز مسبقاً مع الدورة أو السكن): 100 يورو لاتجاه واحد (وصول)، 150 يورو ذهاباً وإياباً (وصول وعودة).',
    false,'Price verified; current availability not confirmed','السعر مؤكد؛ التوفر الحالي غير مؤكد',
    3,v_src,v_doc,2026,NULL,
    ARRAY(SELECT id FROM public.accommodations WHERE school_id = v_catalog AND name_en = 'Comfort Apartment (TWN)'))
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, sort_order) VALUES
    (v_acc,1,4,NULL,185,1),(v_acc,5,23,NULL,165,2),(v_acc,24,NULL,NULL,150,3);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals, minimum_age,
    from_price_per_week, arrangement_fee, deposit_amount, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at,
    catalog_accommodation_ids)
  VALUES (v_version,'comfort_single','Comfort Apartment — Single','شقة الكومفورت — غرفة مفردة',
    'single','self_catering',NULL,210,90,250,true,
    'Security deposit of €250 per person. Airport transfer (booked in advance with course/accommodation): €100 one way (arrival), €150 both ways (arrival and return).',
    'تأمين أمني 250 يورو للشخص الواحد. النقل من المطار (يُحجز مسبقاً مع الدورة أو السكن): 100 يورو لاتجاه واحد (وصول)، 150 يورو ذهاباً وإياباً (وصول وعودة).',
    false,'Price verified; current availability not confirmed','السعر مؤكد؛ التوفر الحالي غير مؤكد',
    4,v_src,v_doc,2026,NULL,
    ARRAY(SELECT id FROM public.accommodations WHERE school_id = v_catalog AND name_en = 'Comfort Apartment (SGL)'))
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, sort_order) VALUES
    (v_acc,1,4,NULL,245,1),(v_acc,5,23,NULL,225,2),(v_acc,24,NULL,NULL,210,3);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals, minimum_age,
    from_price_per_week, arrangement_fee, deposit_amount, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at,
    catalog_accommodation_ids)
  VALUES (v_version,'studio','Studio','الاستوديو',
    'studio','self_catering',NULL,270,90,250,true,
    'Security deposit of €250 per person. Airport transfer (booked in advance with course/accommodation): €100 one way (arrival), €150 both ways (arrival and return).',
    'تأمين أمني 250 يورو للشخص الواحد. النقل من المطار (يُحجز مسبقاً مع الدورة أو السكن): 100 يورو لاتجاه واحد (وصول)، 150 يورو ذهاباً وإياباً (وصول وعودة).',
    false,'Price verified; current availability not confirmed','السعر مؤكد؛ التوفر الحالي غير مؤكد',
    5,v_src,v_doc,2026,NULL,
    ARRAY(SELECT id FROM public.accommodations WHERE school_id = v_catalog AND name_en = 'Studio'))
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, sort_order) VALUES
    (v_acc,1,4,NULL,360,1),(v_acc,5,23,NULL,310,2),(v_acc,24,NULL,NULL,270,3);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals, minimum_age,
    from_price_per_week, arrangement_fee, deposit_amount, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at,
    catalog_accommodation_ids)
  VALUES (v_version,'host_family_bb','Host Family — B&B','العائلة المضيفة — فطور فقط',
    'single','breakfast',NULL,250,90,250,true,
    'Security deposit of €250 per person. Airport transfer (booked in advance with course/accommodation): €100 one way (arrival), €150 both ways (arrival and return).',
    'تأمين أمني 250 يورو للشخص الواحد. النقل من المطار (يُحجز مسبقاً مع الدورة أو السكن): 100 يورو لاتجاه واحد (وصول)، 150 يورو ذهاباً وإياباً (وصول وعودة).',
    false,'Price verified; current availability not confirmed','السعر مؤكد؛ التوفر الحالي غير مؤكد',
    6,v_src,v_doc,2026,NULL,
    ARRAY(SELECT id FROM public.accommodations WHERE school_id = v_catalog AND name_en = 'Host Family (B&B)'))
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, sort_order) VALUES
    (v_acc,1,4,NULL,310,1),(v_acc,5,23,NULL,270,2),(v_acc,24,NULL,NULL,250,3);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals, minimum_age,
    from_price_per_week, arrangement_fee, deposit_amount, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at,
    catalog_accommodation_ids)
  VALUES (v_version,'host_family_half','Host Family — Half Board','العائلة المضيفة — نصف إقامة',
    'single','half_board',NULL,300,90,250,true,
    'Security deposit of €250 per person. Airport transfer (booked in advance with course/accommodation): €100 one way (arrival), €150 both ways (arrival and return).',
    'تأمين أمني 250 يورو للشخص الواحد. النقل من المطار (يُحجز مسبقاً مع الدورة أو السكن): 100 يورو لاتجاه واحد (وصول)، 150 يورو ذهاباً وإياباً (وصول وعودة).',
    false,'Price verified; current availability not confirmed','السعر مؤكد؛ التوفر الحالي غير مؤكد',
    7,v_src,v_doc,2026,NULL,
    ARRAY(SELECT id FROM public.accommodations WHERE school_id = v_catalog AND name_en = 'Host Family (Half board)'))
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, sort_order) VALUES
    (v_acc,1,4,NULL,390,1),(v_acc,5,23,NULL,320,2),(v_acc,24,NULL,NULL,300,3);

  -- Policies (categories as displayed on the school sheet)
  INSERT INTO public.school_policies (school_id, category, title_en, title_ar, body_en, body_ar, sort_order,
    source_name, source_document, source_year, last_verified_at) VALUES
   (v_school,'registration','Registration fee','رسوم التسجيل',
    'The registration fee is €60 for the German Intensive Standard Course, the High Intensive Course, the University Pathway, the Vocational Training, German for Doctors and German for Nursing.',
    'رسوم التسجيل 60 يورو للدورة المكثفة القياسية والدورة عالية المكثفة والمسار الجامعي والتدريب المهني ودورات الألمانية للأطباء وللكوادر التمريضية.',
    1,v_src,v_doc,2026,NULL),
   (v_school,'registration','University Pathway — admission fees','المسار الجامعي — رسوم القبول',
    'University Pathway admission fee €540, registration €60 and Letter of Acceptance €75. The university placement fee is not included; accommodation is available on request.',
    'رسوم قبول المسار الجامعي 540 يورو، والتسجيل 60 يورو، وخطاب القبول 75 يورو. رسوم التنسيب الجامعي غير مشمولة؛ السكن متاح عند الطلب.',
    2,v_src,v_doc,2026,NULL),
   (v_school,'arrival','Arrival and departure','الوصول والمغادرة',
    'Day of arrival is the Sunday before the course begins; day of departure is the Saturday after it ends. Airport transfers must be booked in advance with the course and accommodation registration: €100 one way (arrival), €150 both ways (arrival and return).',
    'يوم الوصول هو الأحد الذي يسبق بداية الدورة، ويوم المغادرة هو السبت الذي يلي نهايتها. يُحجز النقل من المطار مسبقاً مع تسجيل الدورة والسكن: 100 يورو لاتجاه واحد (وصول)، 150 يورو ذهاباً وإياباً (وصول وعودة).',
    3,v_src,v_doc,2026,NULL),
   (v_school,'accommodation','Placement fee and deposit','رسوم التنسيب والتأمين',
    'Accommodation placement fee €90. A security deposit of €250 per person applies and is refunded after check-out.',
    'رسوم تنسيب السكن 90 يورو. يُدفع تأمين أمني 250 يورو للشخص الواحد ويُعاد بعد المغادرة.',
    4,v_src,v_doc,2026,NULL),
   (v_school,'accommodation','Accommodation pricing rules','قواعد أسعار السكن',
    'For bookings of at least 12 weeks the surcharge is waived for the first 4 weeks. For bookings of at least 24 weeks the 24+ week price applies from the first week.',
    'للحجوزات التي لا تقل عن 12 أسبوعاً يُلغى فرق السعر في الأسابيع الأربعة الأولى. للحجوزات التي لا تقل عن 24 أسبوعاً يُطبق سعر 24+ أسبوعاً اعتباراً من الأسبوع الأول.',
    5,v_src,v_doc,2026,NULL),
   (v_school,'course','Lesson package','مكونات الدروس',
    'Standard Intensive: 4 lessons × 45 minutes a day + 5 LMS online lessons (20 lessons/week). High Intensive: 6 lessons × 45 minutes a day + 5 LMS online lessons (30 lessons/week). Each participant receives a certificate upon completion. Courses are hybrid — online or face-to-face in Düsseldorf.',
    'الدورة المكثفة القياسية: 4 حصص × 45 دقيقة يومياً + 5 دروس عبر LMS أسبوعياً (20 حصة/أسبوع). الدورة عالية المكثفة: 6 حصص × 45 دقيقة يومياً + 5 دروس عبر LMS أسبوعياً (30 حصة/أسبوع). يحصل كل مشارك على شهادة إتمام. الدورات هجينة — عبر الإنترنت أو وجهاً لوجه في دوسلدورف.',
    6,'GoAcademy! German Courses 2026 brochure','goacademy-sprachschule-duesseldorf-german-courses-2026.pdf',2026,NULL),
   (v_school,'course','Group size','حجم المجموعة',
    'Classes normally run 6–15 students, with a maximum of 15 guaranteed. If fewer than 6 students enrol in a course, the school may reduce the number of lessons.',
    'تعقد المجموعات عادة من 6 إلى 15 طالباً، وبحد أقصى مضمون 15. إذا قل عدد المسجلين عن 6 يجوز للمدرسة تقليل عدد الدروس.',
    7,v_src,v_doc,2026,NULL),
   (v_school,'program','University Pathway packages','باقات المسار الجامعي',
    'Package 1: 6 months, B2–C1, 20 lessons + 5 LMS per week, official telc B2 examination and +1 month of accommodation — €4,900. Package 2: 9 months, B1–C1 — €6,900. Package 3: 12 months, A1–C1 — €8,900.',
    'الباقة 1: 6 أشهر، B2–C1، 20 حصة + 5 عبر LMS أسبوعياً، الامتحان الرسمي telc B2 و+1 شهر سكن — 4,900 يورو. الباقة 2: 9 أشهر، B1–C1 — 6,900 يورو. الباقة 3: 12 شهراً، A1–C1 — 8,900 يورو.',
    8,'GoAcademy! German Courses 2026 brochure','goacademy-sprachschule-duesseldorf-german-courses-2026.pdf',2026,NULL),
   (v_school,'program','German for Doctors','الألمانية للأطباء',
    'An 8-week course of 200 lessons combining face-to-face and online training. Price €920 total (registration €60). 2026 start dates: 27.01, 14.04, 09.06, 04.08, 06.10.',
    'دورة لمدة 8 أسابيع تتضمن 200 حصة تجمع بين التدريب وجهاً لوجه وعبر الإنترنت. السعر 920 يورو كاملاً (التسجيل 60 يورو). مواعيد البدء 2026: 27.01، 14.04، 09.06، 04.08، 06.10.',
    9,v_src,v_doc,2026,NULL),
   (v_school,'program','German for Nursing Staff','الألمانية للكوادر التمريضية',
    'A 4-week course of 120 lessons in blended learning (80 face-to-face + 40 online). Price €790 total (registration €60). 2026 start dates: 04.05, 05.10.',
    'دورة لمدة 4 أسابيع تتضمن 120 حصة بالتعليم المدمج (80 وجهاً لوجه + 40 عبر الإنترنت). السعر 790 يورو كاملاً (التسجيل 60 يورو). مواعيد البدء 2026: 04.05، 05.10.',
    10,v_src,v_doc,2026,NULL),
   (v_school,'program','Evening Courses','الدورات المسائية',
    '16 face-to-face lessons per month + 8 LMS online lessons. Two lessons twice a week, on Mon+Wed or Tue+Thu, at 17:45–19:15 or 19:30–21:00; each lesson is 45 minutes. Levels A0, A1, A2, B1, B2, C1 and Business. Prices per month: 3 months €185, 6 months €175, 9 months €160.',
    '16 حصة وجهاً لوجه شهرياً + 8 دروس عبر LMS. حصتان مرتين أسبوعياً أيام الإثنين+الأربعاء أو الثلاثاء+الخميس، من 17:45–19:15 أو 19:30–21:00؛ كل حصة 45 دقيقة. المستويات A0 وA1 وA2 وB1 وB2 وC1 والأعمال. السعر شهرياً: 3 أشهر 185 يورو، 6 أشهر 175 يورو، 9 أشهر 160 يورو.',
    11,v_src,v_doc,2026,NULL),
   (v_school,'exam','Examination fees','رسوم الامتحانات',
    'TestDaF digital €210. telc digital: A1 €140, A2 €140. B1 preparation: 1 week (20 lessons F2F + 10 LMS) €185 plus exam €180, or 2-day online course (8 lessons + 12 LMS) €90 plus exam €180; B2 the same. C1 Hochschule: 2-week preparation (40 F2F + 20 LMS) €370 plus exam €190. TestAS: online preparation 10 lessons €125 plus exam €145. DSH: 40 online lessons Mon–Thu 13:00–17:00 €370.',
    'امتحان TestDaF الرقمي 210 يورو. telc الرقمي: A1 140 يورو، A2 140 يورو. تحضير B1: أسبوع واحد (20 حصة وجهاً لوجه + 10 عبر LMS) 185 يورو إضافة إلى الامتحان 180 يورو، أو دورة عبر الإنترنت يومين (8 حصص + 12 عبر LMS) 90 يورو إضافة إلى الامتحان 180 يورو؛ وكذلك B2. C1 Hochschule: تحضير أسبوعين (40 وجهاً لوجه + 20 عبر LMS) 370 يورو إضافة إلى الامتحان 190 يورو. TestAS: تحضير عبر الإنترنت 10 حصص 125 يورو إضافة إلى الامتحان 145 يورو. DSH: 40 حصة عبر الإنترنت الإثنين–الخميس 13:00–17:00 بمبلغ 370 يورو.',
    12,v_src,v_doc,2026,NULL),
   (v_school,'about','School and location','المدرسة والموقع',
    'Centrally located in Düsseldorf near the Old Town and the Rhine. Modern classrooms, a reception, an e-learning centre, a cafeteria and free Wi-Fi. German courses are offered as hybrid courses (online or face-to-face in Düsseldorf).',
    'تقع في وسط دوسلدورف قرب المدينة القديمة ونهر الراين. فصول حديثة ومكتب استقبال ومركز تعلم إلكتروني وكافيتريا وواي فاي مجاني. تُقدَّم دورات الألمانية بشكل هجين (عبر الإنترنت أو وجهاً لوجه في دوسلدورف).',
    13,'GoAcademy! German Courses 2026 brochure','goacademy-sprachschule-duesseldorf-german-courses-2026.pdf',2026,NULL),
   (v_school,'about','Quality and memberships','الجودة والعضويات',
    'DIN ISO 9001:2015 and AZAV certified by TÜV Rheinland. Member of IALC, International House World Organisation, FDSV, ALTO and FaDaF.',
    'معتمدة وفق DIN ISO 9001:2015 وAZAV من TÜV Rheinland. عضو في IALC ومنظمة International House العالمية وFDSV وALTO وFaDaF.',
    14,'GoAcademy__IH_Düsseldorf_-_School_Presentation_2026.pdf','GoAcademy__IH_Düsseldorf_-_School_Presentation_2026.pdf',2026,NULL),
   (v_school,'about','Official examination and preparation centre','مركز امتحانات وتحضير رسمي',
    'The school is an official test centre for telc, TestDaF and TestAS, and offers exam preparation for these plus the DSH at the school.',
    'المدرسة مركز اختبارات رسمي لامتحانات telc وTestDaF وTestAS، وتقدم التحضير لهذه الامتحانات إضافة إلى DSH داخل المدرسة.',
    15,'GoAcademy! German Courses 2026 brochure','goacademy-sprachschule-duesseldorf-german-courses-2026.pdf',2026,NULL),
   (v_school,'other','Other programmes','برامج أخرى',
    'GoAcademy! also offers German & foreign language courses, a junior programme, corporate language training, one-to-one courses, workshops and application training. Pricing for these is not recorded on this sheet — verify with the school.',
    'تقدم المدرسة أيضاً دورات الألمانية واللغات الأجنبية وبرنامج الناشئين وتدريبات لغوية للشركات ودروساً فردية وورشات عمل وتدريباً على التقديم. أسعار هذه البرامج غير مسجلة في هذه الصفحة — يُرجى التأكد منها لدى المدرسة.',
    16,'GoAcademy! German Courses 2026 brochure','goacademy-sprachschule-duesseldorf-german-courses-2026.pdf',2026,NULL);

  -- Notes (override / suppress the KAPITO-specific fallbacks)
  INSERT INTO public.school_notes (school_id, kind, title_en, title_ar, body_en, body_ar, severity, is_active, sort_order) VALUES
   (v_school,'accommodation','Accommodation pricing rules','قواعد أسعار السكن',
    'For bookings of at least 12 weeks the surcharge is waived for the first 4 weeks. For bookings of at least 24 weeks the 24+ week price applies from the first week.',
    'للحجوزات التي لا تقل عن 12 أسبوعاً يُلغى فرق السعر في الأسابيع الأربعة الأولى. للحجوزات التي لا تقل عن 24 أسبوعاً يُطبق سعر 24+ أسبوعاً اعتباراً من الأسبوع الأول.',
    'info',true,1),
   (v_school,'registration_official','Registration and payment timing','ميعاد التسجيل والدفع',
    'Registration is completed through the school promotion/publication. The published registration fee is €60 for the German Intensive Standard Course, the High Intensive Course, the University Pathway, the Vocational Training, German for Doctors and German for Nursing. Detailed payment conditions should be confirmed with the school.',
    'يتم التسجيل عبر الإصدارات الرسمية للمدرسة. رسوم التسجيل المنشورة 60 يورو للدورة المكثفة القياسية والدورة عالية المكثفة والمسار الجامعي والتدريب المهني ودورات الألمانية للأطباء وللكوادر التمريضية. تُؤكد شروط الدفع التفصيلية لدى المدرسة.',
    'info',true,2),
   (v_school,'darb_recommendation','When should we apply?','متى نقدّم الطلب؟',
    'Submit the application 1–2 months before the preferred start date to improve the chance of securing the preferred accommodation. This is DARB office guidance, not a GoAcademy! minimum registration period.',
    'قدّم الطلب قبل 1–2 شهر من موعد البدء المفضل لتحسين فرصة الحصول على السكن المفضل. هذه توصية من مكتب دارب، وليست مدة تسجيل أدنى تفرضها المدرسة.',
    'info',true,3);

  -- Sources (the five supplied 2026 documents)
  INSERT INTO public.school_sources (school_id, name, url, document_path, source_year, kind, last_verified_at, sort_order) VALUES
   (v_school,'GoAcademy! German Courses 2026 brochure','https://goacademy.de/en/','goacademy-sprachschule-duesseldorf-german-courses-2026.pdf',2026,'pdf',NULL,1),
   (v_school,'GoAcademy! 2026 price list','https://goacademy.de/en/','price-list-goacademy-german-courses-duesseldorf-2026.pdf',2026,'pdf',NULL,2),
   (v_school,'GoAcademy! 2026 accommodation document','https://goacademy.de/en/','goacademy_sprachschule_duesseldorf_accommodation_2026.pdf',2026,'pdf',NULL,3),
   (v_school,'GoAcademy! 2026 agency brochure','https://goacademy.de/en/','goacademy_sprachschule_duesseldorf_brochure_agencies_2026_.pdf',2026,'pdf',NULL,4),
   (v_school,'GoAcademy! 2026 school presentation','https://goacademy.de/en/','GoAcademy__IH_Düsseldorf_-_School_Presentation_2026.pdf',2026,'pdf',NULL,5);
END $$;