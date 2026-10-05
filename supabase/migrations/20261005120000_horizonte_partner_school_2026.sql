-- ============================================================
-- Partner Schools: add HORIZONTE German Language School (Regensburg) 2026
--
-- Fourth school on the internal Partner Schools tool, built exactly like
-- KAPITO / Alpha Aktiv / GoAcademy!: same tables, same tabs, same pricing-band
-- model, same catalog linking. No new architecture, no second calculator.
--
-- Source: HORIZONTE's current official pages (school, dates & prices,
-- intensive course, accommodation, FAQ), verified 2026-10-05. Anything the
-- official pages do not print stays empty and reads
-- "Not recorded — verify with the school".
--
-- Two figures are deliberately NOT stored, because HORIZONTE's own pages
-- contradict each other and a wrong number in the calculator is worse than a
-- blank one:
--   * the weekly rate for a week added after the 12-/24-week package
--     (English/Spanish/Italian pages print €200/€190, the German page €160/€150);
--   * a general cancellation-fee schedule (no current official table exists).
-- Both are recorded as internal notes for the team instead.
--
-- Idempotent: re-running after a db reset is safe. The school is keyed by its
-- unique slug; the price version by (school_id, year); levels by
-- (school_id, level); courses/accommodations by (price_version_id, code).
-- ============================================================

-- ── 1. schema: per-tier nightly rate ─────────────────────────────────
-- Alpha Aktiv introduced `night_price`; HORIZONTE publishes extra nights for
-- every housing type (€30 self-catering, €40 breakfast, €50 half board), so
-- the same column carries them. Guarded for a clean db reset.
ALTER TABLE public.school_accommodation_price_tiers
  ADD COLUMN IF NOT EXISTS night_price numeric;

-- `min_students` was introduced for F+U's published 12–15 class size; HORIZONTE
-- publishes 5–12, so the same optional lower bound is reused here.
ALTER TABLE public.school_courses
  ADD COLUMN IF NOT EXISTS min_students integer;

-- ── 2. seed: HORIZONTE Regensburg 2026 ───────────────────────────────
DO $$
DECLARE
  v_country uuid;
  v_school uuid;
  v_version uuid;
  v_catalog uuid;
  v_course uuid;
  v_acc uuid;
  v_src text := 'HORIZONTE official 2026 pages';
  v_doc text := 'horizonte-regensburg-2026';
  v_url text := 'https://www.horizonte.com/en-german-courses/regensburg';
  v_ver date := DATE '2026-10-05';
  v_dep_en text := 'A €100 security deposit applies to both the residence and the host family, as published by HORIZONTE';
  v_dep_ar text := 'يُطبَّق تأمين بقيمة 100 يورو على السكن وعلى العائلة المضيفة، كما تنشره هوريزونتي';
  v_avail_en text := 'Price available; current availability not confirmed';
  v_avail_ar text := 'السعر متوفر؛ التوفر الحالي غير مؤكد';
  d date;
BEGIN
  IF EXISTS (SELECT 1 FROM public.partner_schools WHERE slug = 'horizonte') THEN
    RAISE NOTICE 'HORIZONTE partner school already exists; skipping';
    RETURN;
  END IF;

  SELECT id INTO v_catalog FROM public.schools WHERE slug = 'horizonte' LIMIT 1;
  SELECT id INTO v_country FROM public.partner_countries WHERE slug = 'germany';

  INSERT INTO public.partner_schools (country_id, catalog_school_id, slug, name, city, address, website_url,
    phone, email, partner_status, standard_course_note_en, standard_course_note_ar, minimum_age,
    last_verified_at, sort_order)
  VALUES (v_country, v_catalog, 'horizonte', 'HORIZONTE German Language School', 'Regensburg',
    'Rote-Hahnen-Gasse 12, 93047 Regensburg', v_url,
    '+49 941 57207', NULL, 'partner',
    'HORIZONTE Intensive German Course — 24 lessons/week',
    'دورة الألمانية المكثفة — 24 حصة أسبوعياً', 17, v_ver, 4)
  RETURNING id INTO v_school;

  INSERT INTO public.school_price_versions (school_id, year, currency, label, is_current, summer_supplement_per_week,
    summer_from, summer_to, source_name, source_url, source_document, source_year, last_verified_at)
  VALUES (v_school, 2026, 'EUR', '2026', true, 30, DATE '2026-07-05', DATE '2026-08-29',
    v_src, v_url, v_doc, 2026, v_ver)
  RETURNING id INTO v_version;

  -- ── Courses ────────────────────────────────────────────────────────
  -- The current 2026 Intensive Course is 24 lessons/week: the 20-lesson
  -- standard component in the morning plus a 4-lesson intensive afternoon
  -- module on Monday and Thursday. HORIZONTE prints 1–4 weeks as fixed
  -- totals and a single weekly rate from week 5.
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, min_students, max_students, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, registration_fee, sort_order, source_name, source_document, source_year, last_verified_at, notes)
  VALUES (v_version, 'intensive24', 'Intensive German Course — 24 lessons/week', 'الدورة المكثفة — 24 حصة أسبوعياً',
    24, 45,
    'Mon–Fri · 09:00–12:30 + Mon & Thu · 13:30–15:00',
    'الإثنين–الجمعة · 09:00–12:30 + الإثنين والخميس · 13:30–15:00',
    5, 12, 'A1–C2', true,
    'Any Monday when a place is available; absolute beginners on the starred start dates',
    'أي يوم إثنين عند توفر مقعد؛ والمبتدئون تماماً في تواريخ البداية المعلَّمة بنجمة',
    '["Course fee","Enrolment fee","Teaching materials","Certificate","Leisure-time programme"]'::jsonb,
    0, 1, v_src, v_doc, 2026, v_ver,
    'HORIZONTE publishes 5–12 students for this course (maximum 12). The FAQ page words the afternoon module differently (Mon/Tue/Thu/Fri) than the dedicated Intensive Course 2026 page and the 2026 price page, which both print Monday & Thursday 13:30–15:00 — confirm with the school before publishing a daily timetable.')
  RETURNING id INTO v_course;

  INSERT INTO public.school_course_price_tiers (course_id, from_weeks, to_weeks, price_per_week, kind, sort_order) VALUES
    (v_course,1,1,250,'booking',1),(v_course,2,2,245,'booking',2),
    (v_course,3,3,240,'booking',3),(v_course,4,4,235,'booking',4),
    (v_course,5,NULL,210,'booking',5);

  -- The long-term packages HORIZONTE prints as fixed totals. Kept as their own
  -- course so the extension rate (which conflicts between language versions)
  -- is never quoted from an unverified band.
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, min_students, max_students, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, registration_fee, sort_order, source_name, source_document, source_year, last_verified_at, notes)
  VALUES (v_version, 'intensive24_longterm', 'Intensive German Course — 12 & 24 week packages',
    'الدورة المكثفة — باقات 12 و24 أسبوعاً', 24, 45,
    'Mon–Fri · 09:00–12:30 + Mon & Thu · 13:30–15:00',
    'الإثنين–الجمعة · 09:00–12:30 + الإثنين والخميس · 13:30–15:00',
    5, 12, 'A1–C2', false,
    'Any Monday when a place is available; absolute beginners on the starred start dates',
    'أي يوم إثنين عند توفر مقعد؛ والمبتدئون تماماً في تواريخ البداية المعلَّمة بنجمة',
    '["Course fee","Enrolment fee","Teaching materials","Certificate","Leisure-time programme"]'::jsonb,
    0, 2, v_src, v_doc, 2026, v_ver,
    '€2,520 for 12 weeks and €4,800 for 24 weeks are the verified published totals. The weekly rate for a further week after the package is NOT recorded: HORIZONTE''s English/Spanish/Italian pages print €200/€190 while the German page prints €160/€150 — confirm with the school.')
  RETURNING id INTO v_course;

  INSERT INTO public.school_course_price_tiers (course_id, from_weeks, to_weeks, price_per_week, kind, sort_order) VALUES
    (v_course,12,12,210,'booking',1),(v_course,24,24,200,'booking',2);

  -- ── Accommodation ──────────────────────────────────────────────────
  -- Prices are per person. A 1-week stay is charged as one week at the
  -- published 1-week total; longer stays use the published totals for 2/3/4
  -- weeks and the weekly rate from week 5. The published extra-night rate is
  -- kept on the tier so a single extra night is quotable.

  -- 4th floor: 24 rooms, each with private shower and toilet plus access to a
  -- large shared kitchen.
  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, deposit_amount, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'res_single_private','Single room with private bathroom — 4th floor',
    'غرفة فردية بحمام خاص — الطابق الرابع','single','self_catering',150,100,true,
    v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,1,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,300,NULL,30,1),(v_acc,2,2,450,NULL,NULL,2),(v_acc,3,3,600,NULL,NULL,3),
    (v_acc,4,4,750,NULL,NULL,4),(v_acc,5,NULL,NULL,150,NULL,5);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, deposit_amount, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'res_twin_private','Twin room with private bathroom — 4th floor',
    'غرفة مزدوجة بحمام خاص — الطابق الرابع','double','self_catering',100,100,true,
    v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,2,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,200,NULL,30,1),(v_acc,2,2,300,NULL,NULL,2),(v_acc,3,3,400,NULL,NULL,3),
    (v_acc,4,4,500,NULL,NULL,4),(v_acc,5,NULL,NULL,100,NULL,5);

  -- 2nd floor: 14 rooms in shared apartments with shared kitchen and bathroom.
  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, deposit_amount, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'res_single_shared','Single room in shared apartment',
    'غرفة فردية في شقة مشتركة','single','self_catering',140,100,true,
    v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,3,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,280,NULL,30,1),(v_acc,2,2,420,NULL,NULL,2),(v_acc,3,3,560,NULL,NULL,3),
    (v_acc,4,4,700,NULL,NULL,4),(v_acc,5,NULL,NULL,140,NULL,5);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, deposit_amount, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'res_twin_shared','Twin room in shared apartment',
    'غرفة مزدوجة في شقة مشتركة','double','self_catering',90,100,true,
    v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,4,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,180,NULL,30,1),(v_acc,2,2,270,NULL,NULL,2),(v_acc,3,3,360,NULL,NULL,3),
    (v_acc,4,4,450,NULL,NULL,4),(v_acc,5,NULL,NULL,90,NULL,5);

  -- Studios: private bathroom and kitchenette.
  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, deposit_amount, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'res_studio_one','Studio — one person',
    'استوديو — شخص واحد','studio','self_catering',200,100,true,
    v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,5,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,400,NULL,30,1),(v_acc,2,2,600,NULL,NULL,2),(v_acc,3,3,800,NULL,NULL,3),
    (v_acc,4,4,1000,NULL,NULL,4),(v_acc,5,NULL,NULL,200,NULL,5);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, deposit_amount, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'res_studio_two','Studio — two people (price per person)',
    'استوديو — شخصان (السعر للشخص)','studio','self_catering',135,100,true,
    v_dep_en,v_dep_ar,false,v_avail_en,v_avail_ar,6,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,1,1,270,NULL,30,1),(v_acc,2,2,405,NULL,NULL,2),(v_acc,3,3,540,NULL,NULL,3),
    (v_acc,4,4,675,NULL,NULL,4),(v_acc,5,NULL,NULL,135,NULL,5);

  -- Host family: most families are within ~20 minutes of the school and city
  -- centre by bus or bicycle; the exact address follows about one week before
  -- arrival, so no fixed address is stored.
  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, deposit_amount, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'host_breakfast','Host family — breakfast',
    'عائلة مضيفة — فطور','single','breakfast',200,100,true,
    v_dep_en,v_dep_ar,false,
    'Most host families are within about 20 minutes of the school by bus or bicycle; the exact address is provided about one week before arrival',
    'معظم العائلات المضيفة على بعد نحو 20 دقيقة من المدرسة بالباص أو الدراجة؛ ويُبلَّغ العنوان الدقيق قبل الوصول بنحو أسبوع',
    7,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,2,2,400,NULL,40,1),(v_acc,3,3,600,NULL,NULL,2),
    (v_acc,4,4,800,NULL,NULL,3),(v_acc,5,NULL,NULL,200,NULL,4);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals,
    from_price_per_week, deposit_amount, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'host_half_board','Host family — half board',
    'عائلة مضيفة — نصف إقامة','single','half_board',280,100,true,
    v_dep_en,v_dep_ar,false,
    'Most host families are within about 20 minutes of the school by bus or bicycle; the exact address is provided about one week before arrival',
    'معظم العائلات المضيفة على بعد نحو 20 دقيقة من المدرسة بالباص أو الدراجة؛ ويُبلَّغ العنوان الدقيق قبل الوصول بنحو أسبوع',
    8,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers
    (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, night_price, sort_order) VALUES
    (v_acc,2,2,560,NULL,50,1),(v_acc,3,3,840,NULL,NULL,2),
    (v_acc,4,4,1120,NULL,NULL,3),(v_acc,5,NULL,NULL,280,NULL,4);

  -- ── Start dates ────────────────────────────────────────────────────
  -- Only the 2026 dates HORIZONTE publishes on its current price page are
  -- stored. Starred dates are the designated absolute-beginner (A1) starts.
  FOREACH d IN ARRAY ARRAY[
    DATE '2026-10-12', DATE '2026-10-26', DATE '2026-11-09',
    DATE '2026-11-23', DATE '2026-12-07'
  ] LOOP
    INSERT INTO public.school_start_dates (school_id, year, start_date, audience, note_en, note_ar,
      source_name, source_document, source_year, last_verified_at)
    VALUES (v_school, 2026, d,
      CASE WHEN d IN (DATE '2026-10-26', DATE '2026-11-23') THEN 'beginner' ELSE 'all' END,
      CASE WHEN d IN (DATE '2026-10-26', DATE '2026-11-23')
        THEN 'Starred date — absolute beginners (A1 with no German)'
        ELSE 'Published start date — students with prior German can also start on another Monday when a place is available' END,
      CASE WHEN d IN (DATE '2026-10-26', DATE '2026-11-23')
        THEN 'تاريخ معلَّم بنجمة — المبتدئون تماماً (A1 بدون معرفة بالألمانية)'
        ELSE 'تاريخ بداية منشور — ويمكن للطلاب الذين لديهم معرفة بالألمانية البدء في أي يوم إثنين آخر عند توفر مقعد' END,
      v_src, v_doc, 2026, v_ver);
  END LOOP;

  -- ── Notes ──────────────────────────────────────────────────────────
  INSERT INTO public.school_notes (school_id, kind, title_en, title_ar, body_en, body_ar, severity, sort_order) VALUES
   (v_school,'accommodation','Residence and host family','السكن والعائلة المضيفة',
    'The HORIZONTE residence is in the same building as the school. The 4th floor has 24 rooms, each with a private shower and toilet and access to a large shared kitchen. The 2nd floor has 14 rooms in shared apartments with a shared kitchen and bathroom. Studio apartments with a private bathroom and kitchenette are also available. The building has Wi-Fi throughout, a washing machine and dryer in the common area and a library with mainly German literature. The price includes a furnished room, bed linen, kettle, fridge, Wi-Fi, water, heating, electricity and final cleaning. Towels are not provided, there is no room service, students clean their own rooms and the communal areas are professionally cleaned twice a week.',
    'يقع سكن هوريزونتي في المبنى نفسه الذي تقع فيه المدرسة. يضم الطابق الرابع 24 غرفة، لكل منها دوش ومرحاض خاصان وإمكانية استخدام مطبخ مشترك كبير. ويضم الطابق الثاني 14 غرفة في شقق مشتركة مع مطبخ وحمام مشتركين. وتتوفر أيضاً شقق استوديو بحمام ومطبخ صغير خاصين. ويضم المبنى إنترنت لاسلكياً في كل الطوابق، وغسالة ومجففاً في المنطقة المشتركة، ومكتبة بأدب ألماني في معظمه. يشمل السعر غرفة مفروشة وبياضات وغلاية وثلاجة وإنترنت وماء وتدفئة وكهرباء وتنظيفاً نهائياً. المناشف غير مشمولة، ولا توجد خدمة تنظيف الغرف، وينظّف الطالب غرفته بنفسه، وتُنظَّف المناطق المشتركة مهنياً مرتين أسبوعياً.',
    'info',1),
   (v_school,'registration_official','Deposits and payment timing','العربون وموعد الدفع',
    'HORIZONTE''s current FAQ states a €100 course deposit and a €100 accommodation deposit, with the remaining balance due no later than two weeks before the course begins. It states the deposits are refundable only in the case of non-availability: if HORIZONTE cannot provide a place, payments are fully refunded. An older enrolment page still says the deposit is "not refundable" — treat the current FAQ as the rule but confirm at booking.',
    'تنص الأسئلة الشائعة الحالية لهوريزونتي على عربون دورة بقيمة 100 يورو وعربون سكن بقيمة 100 يورو، على أن يُسدَّد المتبقي في موعد أقصاه أسبوعان قبل بدء الدورة. وتنص على أن العربون قابل للاسترداد فقط في حالة عدم التوفر: أي إذا لم تتمكن هوريزونتي من توفير مقعد، يُردّ المبلغ كاملاً. ولا تزال صفحة تسجيل قديمة تذكر أن العربون «غير قابل للاسترداد» — يُعتمد نص الأسئلة الشائعة الحالية كقاعدة مع التأكيد عند الحجز.',
    'info',2),
   (v_school,'darb_recommendation','When should we apply?','متى نقدّم الطلب؟',
    'Submit 1–2 months before the preferred start date, especially for the on-site residence, which is the first option to fill up. This is DARB office guidance, not a HORIZONTE minimum registration period.',
    'نوصي بالتقديم قبل موعد البداية المطلوب بشهر إلى شهرين، خصوصاً لحجز السكن في الموقع لأنه أول ما ينفد. هذه توصية من مكتب درب وليست مدة تسجيل إلزامية تفرضها هوريزونتي.',
    'info',3),
   (v_school,'internal','Unverified figures — do not quote','أرقام غير مؤكدة — لا تُقتبس',
    'Two figures must not be quoted until HORIZONTE confirms them in writing: (1) the weekly rate for a week added after the 12- or 24-week package — the English, Spanish and Italian price pages print €200 after 12 weeks and €190 after 24 weeks, while the German page prints €160 and €150; (2) a general cancellation-fee schedule — no current official table could be verified, so cancellation is subject to HORIZONTE''s General Terms and Conditions.',
    'لا يجوز اقتباس رَقمين حتى تؤكدهما هوريزونتي كتابةً: (1) سعر الأسبوع الإضافي بعد باقة 12 أو 24 أسبوعاً — تعرض صفحات الأسعار الإنجليزية والإسبانية والإيطالية 200 يورو بعد 12 أسبوعاً و190 يورو بعد 24 أسبوعاً، بينما تعرض الصفحة الألمانية 160 و150؛ (2) جدول رسوم الإلغاء العام — لم يُتحقق من جدول رسمي حالي، لذا يخضع الإلغاء للشروط والأحكام العامة لهوريزونتي.',
    'warning',4),
   (v_school,'internal','FAQ timetable wording conflicts','تعارض في صياغة الجدول في الأسئلة الشائعة',
    'HORIZONTE''s FAQ page words the intensive afternoon module as Monday, Tuesday, Thursday and Friday, while the dedicated Intensive Course 2026 page and the current 2026 price page both state Monday and Thursday 13:30–15:00. Store the Mon & Thu timetable, and confirm the daily timetable with the school before publishing it.',
    'تصف صفحة الأسئلة الشائعة وحدة ما بعد الظهر المكثفة بأنها الإثنين والثلاثاء والخميس والجمعة، بينما تنص صفحة الدورة المكثفة 2026 المخصصة وصفحة أسعار 2026 الحالية على الإثنين والخميس 13:30–15:00. يُحفظ جدول الإثنين والخميس، ويُؤكَّد الجدول اليومي مع المدرسة قبل نشره.',
    'warning',5);

  -- ── Policies ───────────────────────────────────────────────────────
  INSERT INTO public.school_policies (school_id, category, title_en, title_ar, body_en, body_ar, sort_order,
    source_name, source_document, source_year, last_verified_at) VALUES
   (v_school,'registration','What the course price includes','ما الذي تشمله رسوم الدورة',
    'The course price includes the course fee, the enrolment fee, the teaching materials, the certificate and the leisure-time programme. Transport and entrance fees for activities are excluded.',
    'تشمل رسوم الدورة رسم الدورة ورسوم التسجيل والمواد التعليمية والشهادة وبرنامج الأنشطة الترفيهية. أما المواصلات ورسوم الدخول للأنشطة فهي غير مشمولة.',
    1,v_src,v_doc,2026,v_ver),
   (v_school,'registration','Minimum duration and level timing','الحد الأدنى للمدة ومدة المستوى',
    'Courses can be booked from 1 week. HORIZONTE states that, in its experience, approximately 10–12 weeks are needed for one CEFR level. That is an educational recommendation, not a guarantee that a student will complete a level in exactly that time.',
    'يمكن حجز الدورات ابتداءً من أسبوع واحد. وتذكر هوريزونتي أنه بحسب خبرتها تحتاج إلى نحو 10–12 أسبوعاً لإكمال مستوى واحد وفق الإطار الأوروبي المرجعي. وهذه توصية تعليمية وليست ضماناً لإكمال المستوى في هذه المدة بالضبط.',
    2,v_src,v_doc,2026,v_ver),
   (v_school,'registration','Visa refusal','رفض التأشيرة',
    'If a German visa is refused, HORIZONTE refunds the payments less the deposit, provided the student supplies the official visa-refusal document.',
    'في حال رفض تأشيرة ألمانيا، ترد هوريزونتي المبالغ المدفوعة بعد خصم العربون، بشرط أن يقدّم الطالب وثيقة رفض التأشيرة الرسمية.',
    3,v_src,v_doc,2026,v_ver),
   (v_school,'cancellation','Cancellation and refunds','الإلغاء والاسترداد',
    'Cancellation is subject to HORIZONTE''s current General Terms and Conditions. No current official cancellation-fee schedule could be verified, so exact cancellation fees must be confirmed with HORIZONTE before booking. There is no verified general rule requiring three weeks'' notice.',
    'يخضع الإلغاء للشروط والأحكام العامة الحالية لهوريزونتي. ولم يُتحقق من جدول رسمي حالي لرسوم الإلغاء، لذا يجب تأكيد رسوم الإلغاء الدقيقة مع هوريزونتي قبل الحجز. ولا توجد قاعدة عامة مؤكدة تشترط إشعاراً قبل ثلاثة أسابيع.',
    4,v_src,v_doc,2026,v_ver),
   (v_school,'arrival','Arrival, departure and extra nights','الوصول والمغادرة والليالي الإضافية',
    'Accommodation is booked from the Sunday before the course starts to the Saturday after it finishes. Check-in is on Sunday 17:00–19:00 and check-out on Saturday by 10:00. Early arrival is not guaranteed. Published extra nights: €30 without meals, €40 with breakfast and €50 with half board.',
    'يُحجز السكن من الأحد الذي يسبق بدء الدورة إلى السبت الذي يلي انتهاءها. تسجيل الوصول الأحد 17:00–19:00، والمغادرة السبت قبل الساعة 10:00. الوصول المبكر غير مضمون. أسعار الليالي الإضافية المنشورة: 30 يورو بدون وجبات، و40 يورو مع الفطور، و50 يورو مع نصف الإقامة.',
    5,v_src,v_doc,2026,v_ver),
   (v_school,'accommodation','Summer surcharge','رسوم الصيف الإضافية',
    'A €30 per week summer surcharge applies to accommodation from 5 July to 29 August 2026. For on-site courses the same €30 per week surcharge applies in that window but excludes long-term courses of 12 or more weeks, one-to-one tuition and exam preparation.',
    'تُطبَّق رسوم صيفية إضافية بقيمة 30 يورو أسبوعياً على السكن من 5 يوليو إلى 29 أغسطس 2026. وفي الدورات في الموقع تُطبَّق الرسوم نفسها بقيمة 30 يورو أسبوعياً خلال هذه الفترة، لكنها لا تشمل الدورات طويلة الأمد من 12 أسبوعاً أو أكثر، ولا الدروس الفردية، ولا التحضير للامتحانات.',
    6,v_src,v_doc,2026,v_ver),
   (v_school,'age','Minimum age','الحد الأدنى للعمر',
    'The minimum age for HORIZONTE courses is 17.',
    'الحد الأدنى للعمر لدورات هوريزونتي هو 17 عاماً.',
    7,v_src,v_doc,2026,v_ver),
   (v_school,'registration','Accreditation and examinations','الاعتماد والامتحانات',
    'HORIZONTE states that it is a member of IALC and FDSV and an official examination centre for telc and TestDaF. The school teaches levels A1–C2.',
    'تذكر هوريزونتي أنها عضو في IALC وFDSV ومركز امتحانات رسمي لـ telc وTestDaF. وتدرّس المدرسة المستويات من A1 إلى C2.',
    8,v_src,v_doc,2026,v_ver);

  -- ── Sources ────────────────────────────────────────────────────────
  INSERT INTO public.school_sources (school_id, name, url, document_path, source_year, kind, last_verified_at, sort_order) VALUES
   (v_school, 'HORIZONTE Regensburg school page', 'https://www.horizonte.com/en-german-courses/regensburg', NULL, 2026, 'website', v_ver, 1),
   (v_school, 'HORIZONTE 2026 dates & prices', 'https://www.horizonte.com/en-german-courses/dates-prices', NULL, 2026, 'website', v_ver, 2),
   (v_school, 'HORIZONTE 2026 Intensive Course', 'https://www.horizonte.com/de-deutschkurse/deutschkurse/intensivkurs-deutsch', NULL, 2026, 'website', v_ver, 3),
   (v_school, 'HORIZONTE accommodation', 'https://www.horizonte.com/en-german-courses/en-accomodation', NULL, 2026, 'website', v_ver, 4),
   (v_school, 'HORIZONTE FAQ — payments & visa', 'https://www.horizonte.com/en-german-courses/language-school/faq-german-school', NULL, 2026, 'website', v_ver, 5);
END $$;
