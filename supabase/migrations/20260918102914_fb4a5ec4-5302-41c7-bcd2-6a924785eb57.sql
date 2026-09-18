-- ============ Partner Schools knowledge base ============

CREATE TABLE public.partner_countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  flag_emoji text,
  description_en text,
  description_ar text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.partner_schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES public.partner_countries(id) ON DELETE RESTRICT,
  catalog_school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  city text,
  address text,
  website_url text,
  phone text,
  email text,
  partner_status text NOT NULL DEFAULT 'partner',
  standard_course_note_en text,
  standard_course_note_ar text,
  minimum_age int,
  last_verified_at date,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.school_price_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.partner_schools(id) ON DELETE CASCADE,
  year int NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  label text,
  is_current boolean NOT NULL DEFAULT false,
  valid_from date,
  valid_to date,
  summer_supplement_per_week numeric,
  summer_from date,
  summer_to date,
  source_name text,
  source_url text,
  source_document text,
  source_year int,
  last_verified_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, year)
);

CREATE TABLE public.school_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_version_id uuid NOT NULL REFERENCES public.school_price_versions(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_en text NOT NULL,
  name_ar text,
  lessons_per_week int,
  lesson_minutes int,
  schedule_text_en text,
  schedule_text_ar text,
  max_students int,
  cefr_range text,
  is_darb_standard boolean NOT NULL DEFAULT false,
  start_rule_en text,
  start_rule_ar text,
  included_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  source_name text,
  source_url text,
  source_document text,
  source_year int,
  last_verified_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.school_course_price_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.school_courses(id) ON DELETE CASCADE,
  from_weeks int NOT NULL,
  to_weeks int,
  price_per_week numeric NOT NULL,
  kind text NOT NULL DEFAULT 'booking',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.school_level_durations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.partner_schools(id) ON DELETE CASCADE,
  level text NOT NULL,
  weeks int NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  source_name text,
  source_url text,
  source_document text,
  source_year int,
  last_verified_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, level)
);

CREATE TABLE public.school_accommodations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_version_id uuid NOT NULL REFERENCES public.school_price_versions(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_en text NOT NULL,
  name_ar text,
  room_type text,
  meals text,
  minimum_age int,
  from_price_per_week numeric,
  arrangement_fee numeric,
  deposit_amount numeric,
  deposit_confirmed boolean NOT NULL DEFAULT false,
  deposit_note_en text,
  deposit_note_ar text,
  availability_confirmed boolean NOT NULL DEFAULT false,
  availability_note_en text,
  availability_note_ar text,
  sort_order int NOT NULL DEFAULT 0,
  source_name text,
  source_url text,
  source_document text,
  source_year int,
  last_verified_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.school_accommodation_price_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id uuid NOT NULL REFERENCES public.school_accommodations(id) ON DELETE CASCADE,
  from_weeks int NOT NULL,
  to_weeks int,
  total_price numeric,
  price_per_week numeric,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.school_start_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.partner_schools(id) ON DELETE CASCADE,
  year int NOT NULL,
  start_date date NOT NULL,
  audience text NOT NULL DEFAULT 'beginner',
  course_code text,
  note_en text,
  note_ar text,
  source_name text,
  source_url text,
  source_document text,
  source_year int,
  last_verified_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.school_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.partner_schools(id) ON DELETE CASCADE,
  category text NOT NULL,
  title_en text NOT NULL,
  title_ar text,
  body_en text,
  body_ar text,
  sort_order int NOT NULL DEFAULT 0,
  source_name text,
  source_url text,
  source_document text,
  source_year int,
  last_verified_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.school_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.partner_schools(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'internal',
  title_en text,
  title_ar text,
  body_en text,
  body_ar text,
  severity text NOT NULL DEFAULT 'info',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  updated_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.school_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.partner_schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text,
  document_path text,
  source_year int,
  kind text NOT NULL DEFAULT 'pdf',
  last_verified_at date,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- grants ----------
GRANT SELECT ON public.partner_countries, public.partner_schools, public.school_price_versions,
  public.school_courses, public.school_course_price_tiers, public.school_level_durations,
  public.school_accommodations, public.school_accommodation_price_tiers, public.school_start_dates,
  public.school_policies, public.school_notes, public.school_sources TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.partner_countries, public.partner_schools, public.school_price_versions,
  public.school_courses, public.school_course_price_tiers, public.school_level_durations,
  public.school_accommodations, public.school_accommodation_price_tiers, public.school_start_dates,
  public.school_policies, public.school_notes, public.school_sources TO authenticated;
GRANT ALL ON public.partner_countries, public.partner_schools, public.school_price_versions,
  public.school_courses, public.school_course_price_tiers, public.school_level_durations,
  public.school_accommodations, public.school_accommodation_price_tiers, public.school_start_dates,
  public.school_policies, public.school_notes, public.school_sources TO service_role;

-- ---------- RLS ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'partner_countries','partner_schools','school_price_versions','school_courses',
    'school_course_price_tiers','school_level_durations','school_accommodations',
    'school_accommodation_price_tiers','school_start_dates','school_policies',
    'school_notes','school_sources'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "Staff read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''team_member''))', t);
    EXECUTE format(
      'CREATE POLICY "Admins manage %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))', t);
  END LOOP;
END $$;

CREATE INDEX idx_partner_schools_country ON public.partner_schools(country_id);
CREATE INDEX idx_school_price_versions_school ON public.school_price_versions(school_id);
CREATE INDEX idx_school_courses_version ON public.school_courses(price_version_id);
CREATE INDEX idx_school_course_tiers_course ON public.school_course_price_tiers(course_id);
CREATE INDEX idx_school_accs_version ON public.school_accommodations(price_version_id);
CREATE INDEX idx_school_acc_tiers_acc ON public.school_accommodation_price_tiers(accommodation_id);
CREATE INDEX idx_school_start_dates_school ON public.school_start_dates(school_id, year);

-- ---------- seed: Germany + KAPITO 2026 ----------
DO $$
DECLARE
  v_country uuid; v_school uuid; v_version uuid; v_course uuid; v_plus uuid; v_acc uuid;
  v_catalog uuid;
  v_src text := 'KAPITO Dates and Prices 2026';
  v_doc text := 'KAPITO-Dates-and-Prices-2026-v1.pdf';
  v_brochure text := 'KAPITO-Broschuere-EN.pdf';
  v_ver date := DATE '2026-09-18';
  d date;
BEGIN
  SELECT id INTO v_catalog FROM public.schools WHERE name_en ILIKE '%KAPITO%' LIMIT 1;

  INSERT INTO public.partner_countries (slug, name_en, name_ar, flag_emoji, description_en, description_ar, sort_order)
  VALUES ('germany','Germany','ألمانيا','🇩🇪','Language schools and educational partners in Germany','مدارس اللغة والشركاء التعليميون في ألمانيا',1)
  RETURNING id INTO v_country;

  INSERT INTO public.partner_schools (country_id, catalog_school_id, slug, name, city, address, website_url, phone, email,
    partner_status, standard_course_note_en, standard_course_note_ar, minimum_age, last_verified_at, sort_order)
  VALUES (v_country, v_catalog, 'kapito', 'KAPITO Sprachschule', 'Münster', 'Servatiiplatz 9, 48143 Münster',
    'https://www.kapito.com', '+49 251 9811970', 'info@kapito.com', 'partner',
    'KAPITO Intensive German Course — 20 lessons/week', 'دورة الألمانية المكثفة — 20 حصة أسبوعياً', 16, v_ver, 1)
  RETURNING id INTO v_school;

  INSERT INTO public.school_price_versions (school_id, year, currency, label, is_current, summer_supplement_per_week,
    summer_from, summer_to, source_name, source_url, source_document, source_year, last_verified_at)
  VALUES (v_school, 2026, 'EUR', '2026', true, 30, DATE '2026-07-06', DATE '2026-08-28',
    v_src, 'https://www.kapito.com', v_doc, 2026, v_ver)
  RETURNING id INTO v_version;

  -- Standard course
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, max_students, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version, 'intensive20', 'German Intensive Course — 20 lessons/week', 'الدورة المكثفة — 20 حصة أسبوعياً',
    20, 45, 'Mon–Fri · 09:00–12:30', 'الإثنين–الجمعة · 09:00–12:30', 12, 'A1–C1', true,
    'Every Monday; absolute beginners on recommended start dates only',
    'كل يوم إثنين؛ المبتدئون تماماً في تواريخ محددة فقط',
    '["Tuition","Course material","Cultural and social activities","Enrolment fee","Support for visa application","Placement test","Certificate","Student card","Internet access (wifi)","Learning support in the afternoon"]'::jsonb,
    1, v_src, v_doc, 2026, v_ver)
  RETURNING id INTO v_course;

  INSERT INTO public.school_course_price_tiers (course_id, from_weeks, to_weeks, price_per_week, kind, sort_order) VALUES
    (v_course,1,4,210,'booking',1),(v_course,5,8,190,'booking',2),(v_course,9,16,180,'booking',3),
    (v_course,17,23,170,'booking',4),(v_course,24,NULL,160,'booking',5),
    (v_course,1,4,210,'extension',6),(v_course,5,8,200,'extension',7),(v_course,9,16,190,'extension',8),
    (v_course,17,23,180,'extension',9),(v_course,24,NULL,160,'extension',10);

  -- Intensive Plus
  INSERT INTO public.school_courses (price_version_id, code, name_en, name_ar, lessons_per_week, lesson_minutes,
    schedule_text_en, schedule_text_ar, max_students, cefr_range, is_darb_standard, start_rule_en, start_rule_ar,
    included_items, sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version, 'intensive24', 'Intensive Course Plus — 24 lessons/week', 'الدورة المكثفة بلَس — 24 حصة أسبوعياً',
    24, 45, 'Mon–Fri · 09:00–12:30 plus 2× 13:30–15:00', 'الإثنين–الجمعة · 09:00–12:30 بالإضافة إلى حصتين 13:30–15:00',
    12, 'A1–C1', false, 'Every Monday; absolute beginners on recommended start dates only',
    'كل يوم إثنين؛ المبتدئون تماماً في تواريخ محددة فقط', '[]'::jsonb,
    2, v_src, v_doc, 2026, v_ver)
  RETURNING id INTO v_plus;

  INSERT INTO public.school_course_price_tiers (course_id, from_weeks, to_weeks, price_per_week, kind, sort_order) VALUES
    (v_plus,1,4,250,'booking',1),(v_plus,5,8,230,'booking',2),(v_plus,9,16,210,'booking',3),
    (v_plus,17,23,200,'booking',4),(v_plus,24,NULL,190,'booking',5),
    (v_plus,1,4,250,'extension',6),(v_plus,5,8,240,'extension',7),(v_plus,9,16,220,'extension',8),
    (v_plus,17,23,210,'extension',9),(v_plus,24,NULL,190,'extension',10);

  -- Level durations (brochure)
  INSERT INTO public.school_level_durations (school_id, level, weeks, sort_order, source_name, source_document, source_year, last_verified_at) VALUES
    (v_school,'A1',8,1,'KAPITO brochure (course levels)',v_brochure,2026,v_ver),
    (v_school,'A2',8,2,'KAPITO brochure (course levels)',v_brochure,2026,v_ver),
    (v_school,'B1',8,3,'KAPITO brochure (course levels)',v_brochure,2026,v_ver),
    (v_school,'B2',12,4,'KAPITO brochure (course levels)',v_brochure,2026,v_ver),
    (v_school,'C1',8,5,'KAPITO brochure (course levels)',v_brochure,2026,v_ver);

  -- Accommodation: single room, no meals
  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals, minimum_age,
    from_price_per_week, arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'single_no_meals','Single room — no meals (kitchen use)','غرفة فردية — بدون وجبات (استخدام المطبخ)',
    'single','none',18,110,150,false,
    'Security deposit required for long-term bookings — amount to confirm with the school',
    'مطلوب تأمين للحجوزات طويلة الأمد — يُؤكَّد المبلغ مع المدرسة',
    false,'Price available; current availability not confirmed','السعر متوفر؛ التوفر الحالي غير مؤكد',
    1,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, sort_order) VALUES
    (v_acc,1,1,140,NULL,1),(v_acc,2,2,240,NULL,2),(v_acc,3,3,330,NULL,3),(v_acc,4,4,440,NULL,4),(v_acc,5,NULL,NULL,110,5);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals, minimum_age,
    from_price_per_week, arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'single_breakfast','Single room + breakfast','غرفة فردية + فطور','single','breakfast',NULL,135,150,false,
    'Security deposit required for long-term bookings — amount to confirm with the school',
    'مطلوب تأمين للحجوزات طويلة الأمد — يُؤكَّد المبلغ مع المدرسة',
    false,'Price available; current availability not confirmed','السعر متوفر؛ التوفر الحالي غير مؤكد',
    2,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, sort_order) VALUES
    (v_acc,1,1,185,NULL,1),(v_acc,2,2,295,NULL,2),(v_acc,3,3,405,NULL,3),(v_acc,4,4,540,NULL,4),(v_acc,5,NULL,NULL,135,5);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals, minimum_age,
    from_price_per_week, arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'single_half_board','Single room + half-board (full board at weekends)','غرفة فردية + نصف إقامة (إقامة كاملة في عطلة الأسبوع)',
    'single','half_board',NULL,195,150,false,
    'Security deposit required for long-term bookings — amount to confirm with the school',
    'مطلوب تأمين للحجوزات طويلة الأمد — يُؤكَّد المبلغ مع المدرسة',
    false,'Price available; current availability not confirmed','السعر متوفر؛ التوفر الحالي غير مؤكد',
    3,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, sort_order) VALUES
    (v_acc,1,1,245,NULL,1),(v_acc,2,2,415,NULL,2),(v_acc,3,3,585,NULL,3),(v_acc,4,4,780,NULL,4),(v_acc,5,NULL,NULL,195,5);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals, minimum_age,
    from_price_per_week, arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'apartment','Private apartment (self-catering)','شقة خاصة (تدبير ذاتي)','apartment','none',23,200,150,false,
    'Security deposit required — amount to confirm with the school','مطلوب تأمين — يُؤكَّد المبلغ مع المدرسة',
    false,'Price available; current availability not confirmed','السعر متوفر؛ التوفر الحالي غير مؤكد',
    4,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, sort_order) VALUES
    (v_acc,1,NULL,NULL,200,1);

  INSERT INTO public.school_accommodations (price_version_id, code, name_en, name_ar, room_type, meals, minimum_age,
    from_price_per_week, arrangement_fee, deposit_confirmed, deposit_note_en, deposit_note_ar,
    availability_confirmed, availability_note_en, availability_note_ar,
    sort_order, source_name, source_document, source_year, last_verified_at)
  VALUES (v_version,'studio','KAPITO Studio (self-catering)','استوديو كابيتو (تدبير ذاتي)','studio','none',18,225,150,false,
    'Security deposit required — amount to confirm with the school','مطلوب تأمين — يُؤكَّد المبلغ مع المدرسة',
    false,'Price available; current availability not confirmed','السعر متوفر؛ التوفر الحالي غير مؤكد',
    5,v_src,v_doc,2026,v_ver)
  RETURNING id INTO v_acc;
  INSERT INTO public.school_accommodation_price_tiers (accommodation_id, from_weeks, to_weeks, total_price, price_per_week, sort_order) VALUES
    (v_acc,1,NULL,NULL,225,1);

  -- Beginner start dates 2026
  FOREACH d IN ARRAY ARRAY[
    DATE '2026-01-05', DATE '2026-02-02', DATE '2026-03-02', DATE '2026-04-07',
    DATE '2026-05-04', DATE '2026-06-01', DATE '2026-07-06', DATE '2026-08-03',
    DATE '2026-08-31', DATE '2026-09-28', DATE '2026-10-26', DATE '2026-11-23'
  ] LOOP
    INSERT INTO public.school_start_dates (school_id, year, start_date, audience, note_en, note_ar,
      source_name, source_document, source_year, last_verified_at)
    VALUES (v_school, 2026, d, 'beginner', 'Absolute beginners (A1 with no German)','المبتدئون تماماً (A1 بدون معرفة بالألمانية)',
      v_src, v_doc, 2026, v_ver);
  END LOOP;

  -- Policies
  INSERT INTO public.school_policies (school_id, category, title_en, title_ar, body_en, body_ar, sort_order,
    source_name, source_document, source_year, last_verified_at) VALUES
   (v_school,'registration','Registration and deposit','التسجيل والعربون',
    'Send the registration form (or register online at kapito.com/en/registration). Transfer €200 deposit — or the full amount — to reserve the place. The remaining balance is paid before departure to Münster, or in cash/card at the front office. Courses longer than 6 months can be paid in instalments. Bank charges are paid by the student.',
    'يُرسل نموذج التسجيل (أو التسجيل عبر الموقع). يُحوَّل عربون 200 يورو أو المبلغ كاملاً لحجز المقعد. يُدفع الرصيد المتبقي قبل السفر إلى مونستر أو نقداً/ببطاقة في المدرسة. الدورات الأطول من 6 أشهر يمكن دفعها بالتقسيط. رسوم البنك على الطالب.',
    1,v_src,v_doc,2026,v_ver),
   (v_school,'cancellation','Cancellation','الإلغاء',
    'Written cancellation at least 14 days before the course start: deposit refunded minus a €100 handling fee. Later: the €200 deposit is lost, plus the €150 accommodation arrangement fee and 50% of 4 weeks of booked accommodation if KAPITO cannot re-let it. After the course starts, cancellation or shortening is not possible.',
    'الإلغاء كتابياً قبل 14 يوماً على الأقل من بداية الدورة: يُعاد العربون ناقص 100 يورو رسوم معالجة. بعد ذلك: يُفقد عربون 200 يورو، إضافة إلى 150 يورو رسوم ترتيب السكن و50% من أربعة أسابيع سكن إذا لم تتمكن المدرسة من إعادة تأجيره. بعد بدء الدورة لا يمكن الإلغاء أو التقصير.',
    2,v_src,v_doc,2026,v_ver),
   (v_school,'arrival','Arrival and departure','الوصول والمغادرة',
    'Day of arrival is the Sunday before the course begins; day of departure is the Saturday after it ends. Accommodation arranged by KAPITO may only be used for the duration of the course.',
    'يوم الوصول هو الأحد الذي يسبق بداية الدورة، ويوم المغادرة هو السبت الذي يلي نهايتها. السكن الذي ترتبه المدرسة يُستخدم لمدة الدورة فقط.',
    3,v_src,v_doc,2026,v_ver),
   (v_school,'closures','Closures and holidays 2026','الإغلاق والعطل 2026',
    'Winter break 19.12.2026 – 03.01.2027 (school closed). No tuition on 16.2, 3.4, 6.4, 1.5, 14.5, 25.5 and 4.6.2026; lost lessons are not made up (except individual lessons).',
    'عطلة الشتاء 19.12.2026 – 03.01.2027 (المدرسة مغلقة). لا دروس في 16.2 و3.4 و6.4 و1.5 و14.5 و25.5 و4.6.2026، ولا تُعوَّض.',
    4,v_src,v_doc,2026,v_ver),
   (v_school,'age','Minimum age','الحد الأدنى للعمر',
    'Minimum age for all courses: 16 years. Single room without meals: 18. Private apartment: 23. KAPITO Studio: 18.',
    'الحد الأدنى للعمر لجميع الدورات: 16 سنة. غرفة فردية بدون وجبات: 18. شقة خاصة: 23. استوديو كابيتو: 18.',
    5,v_src,v_doc,2026,v_ver),
   (v_school,'discount','Returning student discount','خصم الطالب العائد',
    'Participants who have already attended a KAPITO course receive a €50 discount, provided at least 3 months passed between courses.',
    'الطلاب الذين درسوا سابقاً في كابيتو يحصلون على خصم 50 يورو بشرط مرور 3 أشهر على الأقل بين الدورتين.',
    6,v_src,v_doc,2026,v_ver);

  -- Sources
  INSERT INTO public.school_sources (school_id, name, url, document_path, source_year, kind, last_verified_at, sort_order) VALUES
   (v_school,'KAPITO Dates and Prices 2026','https://www.kapito.com',v_doc,2026,'pdf',v_ver,1),
   (v_school,'KAPITO brochure (EN)','https://www.kapito.com',v_brochure,2026,'pdf',v_ver,2),
   (v_school,'Official KAPITO website','https://www.kapito.com',NULL,2026,'website',v_ver,3);
END $$;

-- ---------- catalog correction: KAPITO single-room week tiers ----------
UPDATE public.accommodations SET price_tiers =
  '[{"from_weeks":1,"to_weeks":1,"price":140},{"from_weeks":2,"to_weeks":2,"price":120},{"from_weeks":3,"to_weeks":3,"price":110},{"from_weeks":4,"to_weeks":4,"price":110},{"from_weeks":5,"to_weeks":null,"price":110}]'::jsonb
WHERE name_en = 'Single room, no meals included'
  AND school_id = (SELECT id FROM public.schools WHERE name_en ILIKE '%KAPITO%' LIMIT 1);

UPDATE public.accommodations SET price_tiers =
  '[{"from_weeks":1,"to_weeks":1,"price":185},{"from_weeks":2,"to_weeks":2,"price":148},{"from_weeks":3,"to_weeks":3,"price":135},{"from_weeks":4,"to_weeks":4,"price":135},{"from_weeks":5,"to_weeks":null,"price":135}]'::jsonb
WHERE name_en = 'Single room with breakfast'
  AND school_id = (SELECT id FROM public.schools WHERE name_en ILIKE '%KAPITO%' LIMIT 1);

UPDATE public.accommodations SET price_tiers =
  '[{"from_weeks":1,"to_weeks":1,"price":245},{"from_weeks":2,"to_weeks":2,"price":208},{"from_weeks":3,"to_weeks":3,"price":195},{"from_weeks":4,"to_weeks":4,"price":195},{"from_weeks":5,"to_weeks":null,"price":195}]'::jsonb
WHERE name_en = 'Single room with half-board'
  AND school_id = (SELECT id FROM public.schools WHERE name_en ILIKE '%KAPITO%' LIMIT 1);