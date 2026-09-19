-- ============================================================
-- Partner Schools: add Alpha Aktiv Sprachschule (Heidelberg) 2026
--
-- Third school on the internal Partner Schools tool, built exactly like
-- KAPITO: same tables, same tabs, same pricing-band model, same catalog
-- linking. No new architecture, no second calculator.
--
-- Source: Alpha Aktiv Course Program 2026 (the official 24-page brochure,
-- https://www.alpha-heidelberg.de/downloads/Alpha_Aktiv_Brochure_2026.pdf)
-- plus the official website where the brochure is silent. Anything the
-- source does not print stays empty and reads
-- "Not recorded — verify with the school".
--
-- Idempotent: re-running after a db reset is safe. The school is keyed by
-- its unique slug; the price version by (school_id, year); levels by
-- (school_id, level); courses/accommodations by (price_version_id, code).
-- ============================================================

-- ── 1. schema: nightly rate + per-course registration fee ────────────
-- Alpha Aktiv publishes a "1 night" column on every housing table, and a
-- registration fee per course (€50). KAPITO rows keep NULL here, so their
-- rendering and the shared calculator are unchanged.
ALTER TABLE public.school_accommodation_price_tiers
  ADD COLUMN IF NOT EXISTS night_price numeric;

ALTER TABLE public.school_courses
  ADD COLUMN IF NOT EXISTS registration_fee numeric;

-- ── 2. seed: Alpha Aktiv 2026 ────────────────────────────────────────
DO $$
DECLARE
  v_country uuid;
  v_school uuid;
  v_version uuid;
  v_catalog uuid;
  v_course uuid;
  v_acc uuid;
  v_src text := 'Alpha Aktiv Course Program 2026';
  v_doc text := 'Alpha_Aktiv_Brochure_2026.pdf';
  v_url text := 'https://www.alpha-heidelberg.de/';
  v_ver date := DATE '2026-09-18';
  v_dep_en text := 'The room payment includes a refundable deposit; the amount is not published in the 2026 brochure — confirm with the school';
  v_dep_ar text := 'يشمل دفع الغرفة تأميناً قابلاً للاسترداد؛ المبلغ غير منشور في كتيب 2026 — يُؤكَّد مع المدرسة';
  v_avail_en text := 'Price available; current availability not confirmed';
  v_avail_ar text := 'السعر متوفر؛ التوفر الحالي غير مؤكد';
  d date;
BEGIN
  IF EXISTS (SELECT 1 FROM public.partner_schools WHERE slug = 'alpha-aktiv') THEN
    RAISE NOTICE 'Alpha Aktiv partner school already exists; skipping';
    RETURN;
  END IF;

  SELECT id INTO v_catalog FROM public.schools WHERE slug = 'alpha-aktiv' LIMIT 1;
  SELECT id INTO v_country FROM public.partner_countries WHERE slug = 'germany';

  INSERT INTO public.partner_schools (country_id, catalog_school_id, slug, name, city, address, website_url,
    phone, email, partner_status, standard_course_note_en, standard_course_note_ar, minimum_age,
    last_verified_at, sort_order)
  VALUES (v_country, v_catalog, 'alpha-aktiv', 'Alpha Aktiv Sprachschule', 'Heidelberg',
    'Hans-Böckler-Str. 2, 69115 Heidelberg', 'https://www.alpha-heidelberg.de/en/',
    '+49 6221 5880269', 'info@alpha-heidelberg.de', 'partner',
    'Alpha Aktiv Intensive German Course — 20 lessons/week',
    'دورة الألمانية المكثفة — 20 حصة أسبوعياً', 16, v_ver, 3)
  RETURNING id INTO v_school;

  INSERT INTO public.school_price_versions (school_id, year, currency, label, is_current,
    source_name, source_url, source_document, source_year, last_verified_at)
  VALUES (v_school, 2026, 'EUR', '2026', true, v_src, v_url, v_doc, 2026, v_ver)
  RETURNING id INTO v_version;

  -- ── Courses ────────────────────────────────────────────────────────
  -- Standard course: Intensive German Course, 20 lessons/week, A1–C2.
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, registration_fee, sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version, 'intensive20', 'Intensive German Course — 20 lessons/week', 'الدورة المكثفة — 20 حصة أسبوعياً',
    20, 45, 'Mon–Fri · 09:00–12:15 or 12:30–15:45', 'الإثنين–الجمعة · 09:00–12:15 أو 12:30–15:45',
    'A1–C2', true,
    'Beginners start on the first Monday of the month; students with prior German confirm their start date with the school',
    'المبتدئون يبدأون في أول يوم إثنين من الشهر؛ والطلاب الذين لديهم معرفة سابقة بالألمانية يؤكدون تاريخ البداية مع المدرسة',
    '["Free placement test","Free level completion tests","Free certificate of participation"]'::jsonb,
    50, 1, v_src, v_doc, 2026, v_ver)
  RETURNING id INTO v_course;

  INSERT INTO public.school_course_price_tiers (course_id, from_weeks, to_weeks, price_per_week, kind, sort_order) VALUES
    (v_course,1,3,215,'booking',1),(v_course,4,12,190,'booking',2),
    (v_course,13,24,165,'booking',3),(v_course,25,NULL,150,'booking',4);

  -- Superintensive German Course, 25 lessons/week.
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, registration_fee, sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version, 'superintensive25', 'Superintensive German Course — 25 lessons/week',
    'الدورة المكثفة الفائقة — 25 حصة أسبوعياً', 25, 45,
    'Mon–Fri · 09:00–13:00 or 13:15–17:15', 'الإثنين–الجمعة · 09:00–13:00 أو 13:15–17:15',
    'A1–C2', false,
    'Beginners start on the first Monday of the month; students with prior German confirm their start date with the school',
    'المبتدئون يبدأون في أول يوم إثنين من الشهر؛ والطلاب الذين لديهم معرفة سابقة بالألمانية يؤكدون تاريخ البداية مع المدرسة',
    '[]'::jsonb, 50, 2, v_src, v_doc, 2026, v_ver)
  RETURNING id INTO v_course;

  INSERT INTO public.school_course_price_tiers (course_id, from_weeks, to_weeks, price_per_week, kind, sort_order) VALUES
    (v_course,1,3,260,'booking',1),(v_course,4,12,230,'booking',2),
    (v_course,13,24,210,'booking',3),(v_course,25,NULL,195,'booking',4);

  -- Superintensive German Course + Conversation, 30 units/week. The source
  -- prints a single published price for 1–4 weeks and no longer band.
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, registration_fee, sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version, 'superintensive30_conversation', 'Superintensive German Course + Conversation — 30 units/week',
    'الدورة المكثفة الفائقة + محادثة — 30 وحدة أسبوعياً', 30, 45,
    'Follows the intensive course schedule', 'يتبع دوام الدورة المكثفة', 'A2–C2', false,
    'Follows the intensive course start dates; students with prior German confirm their start date with the school',
    'يتبع تواريخ بدء الدورة المكثفة؛ والطلاب الذين لديهم معرفة سابقة بالألمانية يؤكدون تاريخ البداية مع المدرسة',
    '[]'::jsonb, 50, 3, v_src, v_doc, 2026, v_ver)
  RETURNING id INTO v_course;

  INSERT INTO public.school_course_price_tiers (course_id, from_weeks, to_weeks, price_per_week, kind, sort_order) VALUES
    (v_course,1,4,275,'booking',1);

  -- Intensive Course + 5 one-to-one lessons/week.
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, registration_fee, sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version, 'intensive20_plus5', 'Intensive Course + One-to-One Tuition — 5 private lessons/week',
    'الدورة المكثفة + دروس فردية — 5 دروس خاصة أسبوعياً', 25, 45,
    'Follows the intensive course schedule plus individual lessons', 'يتبع دوام الدورة المكثفة مع دروس فردية إضافية',
    'A1–C2', false,
    'Follows the intensive course start dates; students with prior German confirm their start date with the school',
    'يتبع تواريخ بدء الدورة المكثفة؛ والطلاب الذين لديهم معرفة سابقة بالألمانية يؤكدون تاريخ البداية مع المدرسة',
    '[]'::jsonb, 50, 4, v_src, v_doc, 2026, v_ver)
  RETURNING id INTO v_course;

  INSERT INTO public.school_course_price_tiers (course_id, from_weeks, to_weeks, price_per_week, kind, sort_order) VALUES
    (v_course,1,3,415,'booking',1),(v_course,4,12,390,'booking',2),(v_course,13,NULL,365,'booking',3);

  -- Intensive Course + 10 one-to-one lessons/week.
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, registration_fee, sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version, 'intensive20_plus10', 'Intensive Course + One-to-One Tuition — 10 private lessons/week',
    'الدورة المكثفة + دروس فردية — 10 دروس خاصة أسبوعياً', 30, 45,
    'Follows the intensive course schedule plus individual lessons', 'يتبع دوام الدورة المكثفة مع دروس فردية إضافية',
    'A1–C2', false,
    'Follows the intensive course start dates; students with prior German confirm their start date with the school',
    'يتبع تواريخ بدء الدورة المكثفة؛ والطلاب الذين لديهم معرفة سابقة بالألمانية يؤكدون تاريخ البداية مع المدرسة',
    '[]'::jsonb, 50, 5, v_src, v_doc, 2026, v_ver)
  RETURNING id INTO v_course;

  INSERT INTO public.school_course_price_tiers (course_id, from_weeks, to_weeks, price_per_week, kind, sort_order) VALUES
    (v_course,1,3,615,'booking',1),(v_course,4,12,590,'booking',2),(v_course,13,NULL,565,'booking',3);

  -- Normal private lessons. Priced per lesson, not per week, so it carries
  -- no weekly band (the shared calculator then reports "not recorded").
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lesson_minutes,
    schedule_text_en, schedule_text_ar, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, registration_fee, sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version, 'private_normal', 'Normal private lessons', 'دروس فردية عادية', 45,
    'Start dates can be designed flexibly', 'يمكن ترتيب تواريخ البداية بمرونة', 'A1–C2', false,
    'Flexible start dates arranged with the school', 'تواريخ بداية مرنة تُرتَّب مع المدرسة',
    '[]'::jsonb, 50, 6, v_src, v_doc, 2026, v_ver);

  -- Private lessons — exam preparation. Priced per lesson.
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lesson_minutes,
    schedule_text_en, schedule_text_ar, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, registration_fee, sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version, 'private_exam_prep', 'Private lessons — Exam preparation', 'دروس فردية — التحضير للامتحان', 45,
    'Start dates can be designed flexibly', 'يمكن ترتيب تواريخ البداية بمرونة', 'A1–C2', false,
    'Flexible start dates arranged with the school', 'تواريخ بداية مرنة تُرتَّب مع المدرسة',
    '[]'::jsonb, 50, 7, v_src, v_doc, 2026, v_ver);

  -- Evening classes: the source prices the whole course, not a weekly rate.
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, registration_fee, sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version, 'evening', 'Evening Classes', 'الدورات المسائية', 4, 45,
    '2 evenings per week · 18:30–20:00', 'مساءان في الأسبوع · 18:30–20:00', 'A1–C1', false,
    'Course dates vary with demand; confirm the next start date with the school',
    'تختلف مواعيد الدورة حسب الطلب؛ يُؤكَّد موعد البداية القادم مع المدرسة',
    '[]'::jsonb, 50, 8, v_src, v_doc, 2026, v_ver);

  -- Preparation courses DSH / TestDaF, 20 lessons/week.
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, registration_fee, sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version, 'prep_dsh_testdaf', 'Preparation courses DSH / TestDaF — 20 lessons/week',
    'دورات التحضير DSH / TestDaF — 20 حصة أسبوعياً', 20, 45,
    'Usually 4–5 weeks before the exam', 'عادةً 4–5 أسابيع قبل الامتحان', 'B2–C2', false,
    'Start date depends on the exam date; confirm with the school',
    'يعتمد تاريخ البداية على موعد الامتحان؛ يُؤكَّد مع المدرسة',
    '[]'::jsonb, 50, 9, v_src, v_doc, 2026, v_ver)
  RETURNING id INTO v_course;

  INSERT INTO public.school_course_price_tiers (course_id, from_weeks, to_weeks, price_per_week, kind, sort_order) VALUES
    (v_course,1,NULL,205,'booking',1);

  -- Preparation courses telc, 20 lessons/week.
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, registration_fee, sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version, 'prep_telc', 'Preparation courses telc — 20 lessons/week',
    'دورات التحضير telc — 20 حصة أسبوعياً', 20, 45,
    'Usually 4–5 weeks before the exam', 'عادةً 4–5 أسابيع قبل الامتحان', 'B2–C2', false,
    'Start date depends on the exam date; confirm with the school',
    'يعتمد تاريخ البداية على موعد الامتحان؛ يُؤكَّد مع المدرسة',
    '[]'::jsonb, 50, 10, v_src, v_doc, 2026, v_ver)
  RETURNING id INTO v_course;

  INSERT INTO public.school_course_price_tiers (course_id, from_weeks, to_weeks, price_per_week, kind, sort_order) VALUES
    (v_course,1,NULL,205,'booking',1);

  -- School preparation course. The source prints a weekly price only.
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lesson_minutes,
    schedule_text_en, schedule_text_ar, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, registration_fee, sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version, 'school_preparation', 'School preparation course', 'دورة التحضير للمدرسة', 45,
    'Mon–Fri', 'الإثنين–الجمعة', false,
    'Confirm the start date with the school', 'يُؤكَّد تاريخ البداية مع المدرسة',
    '[]'::jsonb, 50, 11, v_src, v_doc, 2026, v_ver)
  RETURNING id INTO v_course;

  INSERT INTO public.school_course_price_tiers (course_id, from_weeks, to_weeks, price_per_week, kind, sort_order) VALUES
    (v_course,1,NULL,885,'booking',1);

  -- ── Levels ─────────────────────────────────────────────────────────
  -- Normal course range is A1–C2. Durations are the operational weeks
  -- already verified for Alpha Aktiv. C2 has no published duration, so it
  -- is deliberately absent rather than invented: the calculator then reads
  -- "Not recorded — verify with the school" for C2.
  INSERT INTO public.school_level_durations (school_id, level, weeks, sort_order, source_name, source_document,
    source_year, last_verified_at) VALUES
    (v_school,'A1',8,1,v_src,v_doc,2026,v_ver),
    (v_school,'A2',8,2,v_src,v_doc,2026,v_ver),
    (v_school,'B1',8,3,v_src,v_doc,2026,v_ver),
    (v_school,'B2',9,4,v_src,v_doc,2026,v_ver),
    (v_school,'C1',9,5,v_src,v_doc,2026,v_ver);

  -- ── Accommodation ──────────────────────────────────────────────────
  -- Student residence and apartment prices per person / per week, plus the
  -- published nightly rate. A 1-week stay is charged as one week at the
  -- "1–2 weeks" rate (the source has no separate 1-week column), and the
  -- nightly rate is kept as an extra-day rate so a single night is quotable.
  -- €100 housing placement fee, refundable deposit (amount not published).

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'res_single_a_bismarckplatz','Single Student Residence A — Bismarckplatz',
    'سكن طلابي فردي A — بسماركبلاتس','single','self_catering',190,100,false,
    v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,1,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,300,NULL,85,1),(v_acc,2,2,600,NULL,NULL,2),(v_acc,3,4,245,NULL,NULL,3),
    (v_acc,5,12,230,NULL,NULL,4),(v_acc,13,26,215,NULL,NULL,5),(v_acc,27,NULL,190,NULL,NULL,6);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'res_single_b_bismarckplatz','Single Student Residence B — Bismarckplatz',
    'سكن طلابي فردي B — بسماركبلاتس','single','self_catering',165,100,false,
    v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,2,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,280,NULL,75,1),(v_acc,2,2,560,NULL,NULL,2),(v_acc,3,4,220,NULL,NULL,3),
    (v_acc,5,12,190,NULL,NULL,4),(v_acc,13,26,175,NULL,NULL,5),(v_acc,27,NULL,165,NULL,NULL,6);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'res_single_ziegelhausen','Single Student Residence — Ziegelhausen',
    'سكن طلابي فردي — زيغلهاوزن','single','self_catering',150,100,false,
    v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,3,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,230,NULL,75,1),(v_acc,2,2,460,NULL,NULL,2),(v_acc,3,4,190,NULL,NULL,3),
    (v_acc,5,12,165,NULL,NULL,4),(v_acc,13,26,160,NULL,NULL,5),(v_acc,27,NULL,150,NULL,NULL,6);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'res_double_a_bismarckplatz','Double Student Residence A — Bismarckplatz',
    'سكن طلابي مزدوج A — بسماركبلاتس','double','self_catering',160,100,false,
    v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,4,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,240,NULL,65,1),(v_acc,2,2,480,NULL,NULL,2),(v_acc,3,4,200,NULL,NULL,3),
    (v_acc,5,12,180,NULL,NULL,4),(v_acc,13,26,170,NULL,NULL,5),(v_acc,27,NULL,160,NULL,NULL,6);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'res_double_b_bismarckplatz','Double Student Residence B — Bismarckplatz',
    'سكن طلابي مزدوج B — بسماركبلاتس','double','self_catering',140,100,false,
    v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,5,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,225,NULL,55,1),(v_acc,2,2,450,NULL,NULL,2),(v_acc,3,4,170,NULL,NULL,3),
    (v_acc,5,12,160,NULL,NULL,4),(v_acc,13,26,150,NULL,NULL,5),(v_acc,27,NULL,140,NULL,NULL,6);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'res_double_ziegelhausen','Double Student Residence — Ziegelhausen',
    'سكن طلابي مزدوج — زيغلهاوزن','double','self_catering',130,100,false,
    v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,6,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,215,NULL,55,1),(v_acc,2,2,430,NULL,NULL,2),(v_acc,3,4,160,NULL,NULL,3),
    (v_acc,5,12,145,NULL,NULL,4),(v_acc,13,26,140,NULL,NULL,5),(v_acc,27,NULL,130,NULL,NULL,6);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'apt_single_1room','Single Apartment — 1 room','شقة فردية — غرفة واحدة','apartment','self_catering',
    235,100,false,v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,7,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,370,NULL,100,1),(v_acc,2,2,740,NULL,NULL,2),(v_acc,3,4,305,NULL,NULL,3),
    (v_acc,5,12,295,NULL,NULL,4),(v_acc,13,26,265,NULL,NULL,5),(v_acc,27,NULL,235,NULL,NULL,6);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'apt_single_2rooms','Single Apartment — 2 rooms','شقة فردية — غرفتان','apartment','self_catering',
    295,100,false,v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,8,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,440,NULL,120,1),(v_acc,2,2,880,NULL,NULL,2),(v_acc,3,4,360,NULL,NULL,3),
    (v_acc,5,12,325,NULL,NULL,4),(v_acc,13,26,305,NULL,NULL,5),(v_acc,27,NULL,295,NULL,NULL,6);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'apt_double_a_2rooms','Double Apartment A — 2 rooms','شقة مزدوجة A — غرفتان','double','self_catering',
    225,100,false,v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,9,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,360,NULL,100,1),(v_acc,2,2,720,NULL,NULL,2),(v_acc,3,4,295,NULL,NULL,3),
    (v_acc,5,12,275,NULL,NULL,4),(v_acc,13,26,250,NULL,NULL,5),(v_acc,27,NULL,225,NULL,NULL,6);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'apt_double_2rooms','Double Apartment — 2 rooms','شقة مزدوجة — غرفتان','double','self_catering',
    215,100,false,v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,10,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,335,NULL,95,1),(v_acc,2,2,670,NULL,NULL,2),(v_acc,3,4,285,NULL,NULL,3),
    (v_acc,5,12,260,NULL,NULL,4),(v_acc,13,26,240,NULL,NULL,5),(v_acc,27,NULL,215,NULL,NULL,6);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'apt_double_studio','Double Apartment — 1 Studio Room','شقة مزدوجة — غرفة استوديو واحدة','double','self_catering',
    200,100,false,v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,11,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,350,NULL,95,1),(v_acc,2,2,700,NULL,NULL,2),(v_acc,3,4,275,NULL,NULL,3),
    (v_acc,5,12,250,NULL,NULL,4),(v_acc,13,26,235,NULL,NULL,5),(v_acc,27,NULL,200,NULL,NULL,6);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'apt_triple_3rooms','Triple Apartment — 3 separate rooms','شقة ثلاثية — 3 غرف منفصلة','shared','self_catering',
    205,100,false,v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,12,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,350,NULL,95,1),(v_acc,2,2,700,NULL,NULL,2),(v_acc,3,4,285,NULL,NULL,3),
    (v_acc,5,12,260,NULL,NULL,4),(v_acc,13,26,240,NULL,NULL,5),(v_acc,27,NULL,205,NULL,NULL,6);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'apt_triple_2rooms','Triple Apartment — 2 rooms','شقة ثلاثية — غرفتان','shared','self_catering',
    195,100,false,v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,13,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,310,NULL,95,1),(v_acc,2,2,620,NULL,NULL,2),(v_acc,3,4,260,NULL,NULL,3),
    (v_acc,5,12,240,NULL,NULL,4),(v_acc,13,26,230,NULL,NULL,5),(v_acc,27,NULL,195,NULL,NULL,6);

  -- Host family: the 2026 brochure only states that Alpha Aktiv can arrange
  -- host families. The website prints a half-board price, but it is
  -- explicitly "subject to change during summer" and the brochure does not
  -- carry it, so no amount is stored here.
  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'host_family','Host family — half board','عائلة مضيفة — نصف إقامة','single','half_board',
    100,false,v_dep_en,v_dep_ar,false,
    'Not recorded — verify with the school','غير مسجل — تحقق مع المدرسة',
    14,v_src,v_doc,2026,v_ver);

  -- ── Start dates ────────────────────────────────────────────────────
  -- Beginner (A1) courses start on the first Monday of every month.
  FOREACH d IN ARRAY ARRAY[
    DATE '2026-01-05', DATE '2026-02-02', DATE '2026-03-02', DATE '2026-04-06',
    DATE '2026-05-04', DATE '2026-06-01', DATE '2026-07-06', DATE '2026-08-03',
    DATE '2026-09-07', DATE '2026-10-05', DATE '2026-11-02', DATE '2026-12-07'
  ] LOOP
    INSERT INTO public.school_start_dates (school_id, year, start_date, audience, note_en, note_ar,
      source_name, source_document, source_year, last_verified_at)
    VALUES (v_school, 2026, d, 'beginner', 'First Monday of the month — absolute beginners (A1)',
      'أول يوم إثنين من الشهر — المبتدئون تماماً (A1)', v_src, v_doc, 2026, v_ver);
  END LOOP;

  -- ── Notes ──────────────────────────────────────────────────────────
  -- The accommodation and application tabs fall back to KAPITO-specific
  -- wording when a school has no notes of its own, so Alpha Aktiv carries
  -- its own so nothing about KAPITO leaks onto its page.
  INSERT INTO public.school_notes (school_id, kind, title_en, title_ar, body_en, body_ar, sort_order) VALUES
   (v_school,'accommodation','Student residence and apartment accommodation',
    'السكن الطلابي والشقق',
    'The student residence offers single and double bedrooms with a shared kitchen and bathroom on the same floor. Apartments have a private kitchenette and bathroom inside the apartment. The payment for the room includes a refundable deposit and a €100 housing placement fee. Prices are per person and are subject to change during summer (June, July, August).',
    'يوفر السكن الطلابي غرفاً فردية ومزدوجة مع مطبخ وحمام مشتركين في الطابق نفسه. وتضم الشقق مطبخاً صغيراً وحماماً خاصاً داخل الشقة. يشمل دفع الغرفة تأميناً قابلاً للاسترداد ورسوم ترتيب سكن 100 يورو. الأسعار للشخص الواحد وقد تتغير خلال الصيف (يونيو، يوليو، أغسطس).',
    1),
   (v_school,'accommodation','Host family','عائلة مضيفة',
    'Alpha Aktiv can arrange a stay with a selected host family, usually on half board (breakfast and dinner). The school works with each family for several years. The 2026 brochure does not publish a host-family price, so no amount is recorded — verify with the school.',
    'يمكن لألفا أكتيف ترتيب الإقامة لدى عائلة مضيفة مختارة، عادةً بنظام نصف إقامة (فطور وعشاء). وتتعامل المدرسة مع كل عائلة منذ سنوات. لا ينشر كتيب 2026 سعراً للعائلة المضيفة، لذلك لا يُسجَّل أي مبلغ — يُتحقق منه مع المدرسة.',
    2),
   (v_school,'registration_official','Registration and payment timing','التسجيل وموعد الدفع',
    'Register with the school, then pay the course fee. The registration fee is €50 for all courses and is charged once. The 2026 brochure does not publish a course deposit amount or a payment deadline — confirm the payment schedule with the school.',
    'يُسجَّل الطالب لدى المدرسة ثم يدفع رسوم الدورة. رسوم التسجيل 50 يورو لجميع الدورات وتُدفع مرة واحدة. لا ينشر كتيب 2026 مبلغ عربون للدورة ولا موعداً نهائياً للدفع — يُؤكَّد جدول الدفع مع المدرسة.',
    3),
   (v_school,'darb_recommendation','When should we apply?','متى نقدّم الطلب؟',
    'Submit 1–2 months before the preferred start date to improve the chance of securing the preferred accommodation. This is DARB office guidance, not an Alpha Aktiv minimum registration period.',
    'نوصي بالتقديم قبل موعد البداية المطلوب بشهر إلى شهرين لزيادة فرصة تأمين نوع السكن المفضل. هذه توصية من مكتب درب وليست مدة تسجيل إلزامية تفرضها ألفا أكتيف.',
    4);

  -- ── Policies ───────────────────────────────────────────────────────
  INSERT INTO public.school_policies (school_id, category, title_en, title_ar, body_en, body_ar, sort_order,
    source_name, source_document, source_year, last_verified_at) VALUES
   (v_school,'registration','Registration fee','رسوم التسجيل',
    'The registration fee is €50 for all courses and is charged once.',
    'رسوم التسجيل 50 يورو لجميع الدورات وتُدفع مرة واحدة.',
    1,v_src,v_doc,2026,v_ver),
   (v_school,'registration','Course levels and duration','مستويات الدورة ومدتها',
    'Alpha Aktiv teaches German from A1 to C2. To complete a level you need: A1 8 weeks, A2 8 weeks, B1 8 weeks, B2 9 weeks, C1 9 weeks. No duration is published for C2.',
    'تدرّس ألفا أكتيف الألمانية من A1 إلى C2. لإكمال المستوى تحتاج إلى: A1 ثمانية أسابيع، A2 ثمانية أسابيع، B1 ثمانية أسابيع، B2 تسعة أسابيع، C1 تسعة أسابيع. ولا تُنشر مدة للمستوى C2.',
    2,v_src,v_doc,2026,v_ver),
   (v_school,'arrival','Course schedule','دوام الدورة',
    'Intensive German courses take place Monday to Friday, 09:00–12:15 or 12:30–15:45. One course hour is 45 minutes. In addition to the face-to-face lessons, students should plan about 15 hours per week for homework, vocabulary and presentation preparation.',
    'تُقام دورات الألمانية المكثفة من الإثنين إلى الجمعة، 09:00–12:15 أو 12:30–15:45. مدة الحصة الدراسية 45 دقيقة. إضافة إلى الحصص المباشرة، يُنصح الطالب بتخصيص نحو 15 ساعة أسبوعياً للواجبات والمفردات والتحضير للعروض.',
    3,v_src,v_doc,2026,v_ver),
   (v_school,'accommodation','Accommodation payment','دفع السكن',
    'The payment for the room includes a refundable deposit, as well as a €100 housing placement fee. Accommodation prices are per person and are subject to change during summer (June, July, August).',
    'يشمل دفع الغرفة تأميناً قابلاً للاسترداد، إضافة إلى رسوم ترتيب سكن 100 يورو. أسعار السكن للشخص الواحد وقد تتغير خلال الصيف (يونيو، يوليو، أغسطس).',
    4,v_src,v_doc,2026,v_ver),
   (v_school,'age','Minimum age','الحد الأدنى للعمر',
    'The school states a minimum age of 16 for its German courses. The Summer Youth Course is for teenagers aged 14 to 18.',
    'تحدد المدرسة حداً أدنى للعمر هو 16 عاماً لدورات الألمانية. ودورة صيف الشباب مخصصة للمراهقين من 14 إلى 18 عاماً.',
    5,v_src,v_doc,2026,v_ver);

  -- ── Sources ────────────────────────────────────────────────────────
  INSERT INTO public.school_sources (school_id, name, url, document_path, source_year, kind, last_verified_at, sort_order) VALUES
   (v_school, v_src, v_url, v_doc, 2026, 'pdf', v_ver, 1),
   (v_school, 'Official Alpha Aktiv website', 'https://www.alpha-heidelberg.de/en/', NULL, 2026, 'website', v_ver, 2);
END $$;

-- ============================================================
-- 3. Catalog corrections — one consistent source of truth
--
-- The catalog drives the Team Catalog screen, so the 2026 brochure figures
-- have to land there too. Two defects are fixed:
--
--  a) Three apartments the 2026 brochure publishes were missing from the
--     catalog (Double A 2 rooms, Triple 3 separate rooms, Triple 2 rooms),
--     so those housing options had nothing to link to.
--  b) "Student Residence - Double Not Central" carried 140 in the 27+ band
--     where the brochure prints 130 — a contradiction between the two
--     screens. The band is corrected to the brochure value.
-- ============================================================

-- (a) the missing apartment records, prices exactly as printed
INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note,
  description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'),
  'شقة مزدوجة A - غرفتان (بسماركبلاتس)', 'Apartment - Double A 2 rooms (Bismarckplatz)', 'double', 'self_catering',
  225, 'EUR', 'Bismarckplatz, Heidelberg',
  'Two-room apartment for two people with its own bathroom and kitchenette. Price per person per week.',
  'شقة من غرفتين لشخصين مع حمام ومطبخ صغير خاص. السعر للشخص الواحد في الأسبوع.',
  'Two-room apartment for two people with its own bathroom and kitchenette. Price per person per week.',
  '[{"from_weeks":1,"to_weeks":2,"price":360},{"from_weeks":3,"to_weeks":4,"price":295},{"from_weeks":5,"to_weeks":12,"price":275},{"from_weeks":13,"to_weeks":26,"price":250},{"from_weeks":27,"to_weeks":null,"price":225}]'::jsonb,
  ARRAY['/lovable-uploads/schools/alpha-aktiv/school/hero.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv')
    AND name_en = 'Apartment - Double A 2 rooms (Bismarckplatz)'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note,
  description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'),
  'شقة ثلاثية - 3 غرف منفصلة (بسماركبلاتس)', 'Apartment - Triple 3 separate rooms (Bismarckplatz)', 'shared', 'self_catering',
  205, 'EUR', 'Bismarckplatz, Heidelberg',
  'Apartment with three separate rooms and its own bathroom and kitchenette. Price per person per week.',
  'شقة بثلاث غرف منفصلة مع حمام ومطبخ صغير خاص. السعر للشخص الواحد في الأسبوع.',
  'Apartment with three separate rooms and its own bathroom and kitchenette. Price per person per week.',
  '[{"from_weeks":1,"to_weeks":2,"price":350},{"from_weeks":3,"to_weeks":4,"price":285},{"from_weeks":5,"to_weeks":12,"price":260},{"from_weeks":13,"to_weeks":26,"price":240},{"from_weeks":27,"to_weeks":null,"price":205}]'::jsonb,
  ARRAY['/lovable-uploads/schools/alpha-aktiv/school/hero.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv')
    AND name_en = 'Apartment - Triple 3 separate rooms (Bismarckplatz)'
);

INSERT INTO public.accommodations (school_id, name_ar, name_en, room_type, meals, price, currency, distance_note,
  description, description_ar, description_en, price_tiers, photos, is_active)
SELECT (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv'),
  'شقة ثلاثية - غرفتان (بسماركبلاتس)', 'Apartment - Triple 2 rooms (Bismarckplatz)', 'shared', 'self_catering',
  195, 'EUR', 'Bismarckplatz, Heidelberg',
  'Apartment with two rooms for three people and its own bathroom and kitchenette. Price per person per week.',
  'شقة من غرفتين لثلاثة أشخاص مع حمام ومطبخ صغير خاص. السعر للشخص الواحد في الأسبوع.',
  'Apartment with two rooms for three people and its own bathroom and kitchenette. Price per person per week.',
  '[{"from_weeks":1,"to_weeks":2,"price":310},{"from_weeks":3,"to_weeks":4,"price":260},{"from_weeks":5,"to_weeks":12,"price":240},{"from_weeks":13,"to_weeks":26,"price":230},{"from_weeks":27,"to_weeks":null,"price":195}]'::jsonb,
  ARRAY['/lovable-uploads/schools/alpha-aktiv/school/hero.webp'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accommodations
  WHERE school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv')
    AND name_en = 'Apartment - Triple 2 rooms (Bismarckplatz)'
);

-- (b) 27+ band contradiction: the brochure prints €130 for Double Not Central
UPDATE public.accommodations SET price_tiers =
  '[{"from_weeks":1,"to_weeks":2,"price":215},{"from_weeks":3,"to_weeks":4,"price":160},{"from_weeks":5,"to_weeks":12,"price":145},{"from_weeks":13,"to_weeks":26,"price":140},{"from_weeks":27,"to_weeks":null,"price":130}]'::jsonb,
  price = 130
WHERE name_en = 'Student Residence - Double Not Central'
  AND school_id = (SELECT id FROM public.schools WHERE slug = 'alpha-aktiv');

-- ============================================================
-- 4. Catalog link
--
-- Point every Alpha Aktiv housing option at the existing catalog record it
-- corresponds to, using the established catalog_accommodation_ids mechanism.
-- The catalog is the single source of truth: records are matched by name,
-- never duplicated. Runs after section 3 so the apartments it adds are
-- linkable too.
-- ============================================================
UPDATE public.school_accommodations a
SET catalog_accommodation_ids = ARRAY[c.id]
FROM public.schools s
JOIN public.accommodations c ON c.school_id = s.id
JOIN public.partner_schools ps ON ps.catalog_school_id = s.id
JOIN public.school_price_versions v ON v.school_id = ps.id
WHERE a.price_version_id = v.id
  AND s.slug = 'alpha-aktiv'
  AND ps.slug = 'alpha-aktiv'
  AND c.name_en = CASE a.code
    WHEN 'res_single_a_bismarckplatz' THEN 'Student Residence - Single Central A'
    WHEN 'res_single_b_bismarckplatz' THEN 'Student Residence - Single Central B'
    WHEN 'res_single_ziegelhausen'    THEN 'Student Residence - Single Not Central'
    WHEN 'res_double_a_bismarckplatz' THEN 'Student Residence - Double Central A'
    WHEN 'res_double_b_bismarckplatz' THEN 'Student Residence - Double Central B'
    WHEN 'res_double_ziegelhausen'    THEN 'Student Residence - Double Not Central'
    WHEN 'apt_single_1room'           THEN 'Apartment - Single 1 room (Bismarckplatz)'
    WHEN 'apt_single_2rooms'          THEN 'Apartment - Single 2 rooms (Bismarckplatz)'
    WHEN 'apt_double_a_2rooms'        THEN 'Apartment - Double A 2 rooms (Bismarckplatz)'
    WHEN 'apt_double_2rooms'          THEN 'Apartment - Double 2 rooms (Bismarckplatz)'
    WHEN 'apt_double_studio'          THEN 'Apartment - Double Studio (Bismarckplatz)'
    WHEN 'apt_triple_3rooms'          THEN 'Apartment - Triple 3 separate rooms (Bismarckplatz)'
    WHEN 'apt_triple_2rooms'          THEN 'Apartment - Triple 2 rooms (Bismarckplatz)'
    WHEN 'host_family'                THEN 'Host Family'
    ELSE NULL END;