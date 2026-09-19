/**
 * Computer & IT — Major Intelligence
 * Uses Computer Science as the canonical structure: explicit aliases, Bagrut
 * rule, grade-conversion procedure, programme-level facts, and source-backed
 * university entries. Unknown facts stay explicitly unverified.
 */
import type { IntelSource } from './factTypes';
import { fact, unverified, guidance } from './factTypes';
import type { MajorIntel, ProgramIntel } from './types';

const CHECKED = '2026-09-19';
export const COMPUTER_IT_LAST_VERIFIED = '2026-09';

const SRC_ANABIN: IntelSource = {
  id: 'anabin-isr',
  url: 'https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang',
  title: "anabin (KMK/ZAB) — Israel, Te'udat bagrut (record ISR-BV01)",
  titleAR: 'anabin (KMK/ZAB) — إسرائيل، تعودات بجروت (السجل ISR-BV01)',
  authority: 'anabin',
  checkedAt: '2026-09-19',
};

const SRC_KMK: IntelSource = {
  id: 'kmk-gesnot',
  url: 'https://www.kmk.org/fileadmin/Dateien/pdf/ZAB/Hochschulzugang_Beschluesse_der_KMK/GesNot05.pdf',
  title: 'KMK — Gesamtnote bei ausländischen Hochschulzugangszeugnissen',
  titleAR: 'KMK — تحديد المعدل العام للشهادات الأجنبية',
  authority: 'kmk',
  checkedAt: '2026-09-19',
};

const BAGRUT_EN =
  "Israeli Te'udat bagrut is listed in anabin as direct university access for all subjects when it includes Mathematics 3 units, English 4 units and one further subject at 4 units.";
const BAGRUT_AR =
  'تعودات بجروت مُدرجة في anabin كقبول جامعي مباشر لجميع التخصصات إذا تضمّنت رياضيات 3 وحدات، إنجليزية 4 وحدات ومادة إضافية 4 وحدات.';

const GRADE_EN =
  'German grade = 1 + 3 × (Nmax − N) / (Nmax − Nmin). The formula is a conversion procedure, not an admission decision.';
const GRADE_AR =
  'الدرجة الألمانية = 1 + 3 × (Nmax − N) / (Nmax − Nmin). الصيغة إجراء لتحويل المعدل وليست قرار قبول.';

const IT_GUIDANCE_EN = guidance(
  'Darb operational guidance: use the named programme below as the university reference for this major; do not generalize its admission mode or language requirement to every German university.',
  'إرشاد تشغيلي من درب: استخدم البرنامج المحدد أدناه كمرجع جامعي لهذا التخصص؛ لا تعمّم طريقة القبول أو متطلبات اللغة الخاصة به على كل الجامعات الألمانية.',
);

function commonMajor(
  id: string,
  canonicalEN: string,
  canonicalAR: string,
  nameDE: string,
  aliases: MajorIntel['aliases'],
  programs: ProgramIntel[],
  extraSources: IntelSource[],
): MajorIntel {
  return {
    id,
    canonicalEN,
    canonicalAR,
    nameDE,
    degreeLevel: 'bachelor',
    aliases,
    status: 'verified',
    lastVerified: COMPUTER_IT_LAST_VERIFIED,
    bagrutAccess: fact(
      { mathUnits: 3, englishUnits: 4, furtherUnits: 4 },
      'OFFICIAL_REQUIREMENT',
      'anabin-isr',
      '2026-09-19',
      { note: BAGRUT_EN, noteAR: BAGRUT_AR },
    ),
    gradeConversion: fact(GRADE_EN, 'OFFICIAL_PROCEDURE', 'kmk-gesnot', '2026-09-19', {
      noteAR: GRADE_AR,
    }),
    language: unverified(
      'OFFICIAL_LANGUAGE',
      'There is no one field-wide German requirement for every Computer & IT degree; the programme entry below is the authority for its own language requirement.',
      'لا يوجد شرط ألماني موحّد لكل برامج الحاسوب وتقنية المعلومات؛ سجل البرنامج أدناه هو المرجع لمتطلب لغته.',
    ),
    programs,
    sources: [SRC_ANABIN, SRC_KMK, ...extraSources],
  };
}

const AI_PROGRAM_SOURCE: IntelSource = {
  id: 'uni-bamberg-ai-data-science-bsc',
  url: 'https://www.uni-bamberg.de/studiengaenge/kuenstliche-intelligenz-data-science-bachelor/',
  title: 'Universität Bamberg — Künstliche Intelligenz & Data Science B.Sc.',
  titleAR: 'جامعة بامبرغ — بكالوريوس الذكاء الاصطناعي وعلوم البيانات',
  authority: 'university',
  checkedAt: CHECKED,
};

const AI_PROGRAM: ProgramIntel = {
  id: 'bamberg-ai-data-science-bsc',
  universityName: 'University of Bamberg',
  universityNameAR: 'جامعة بامبرغ',
  city: 'Bamberg',
  cityAR: 'بامبرغ',
  programName: 'Künstliche Intelligenz & Data Science (B.Sc.)',
  programNameDE: 'Künstliche Intelligenz & Data Science',
  programNameAR: 'الذكاء الاصطناعي وعلوم البيانات (بكالوريوس)',
  degreeLevel: 'bachelor',
  teachingLanguage: fact(['German'], 'OFFICIAL_LANGUAGE', AI_PROGRAM_SOURCE.id, CHECKED, {
    note: 'The programme page states German as the main teaching language.',
    noteAR: 'صفحة البرنامج تنص على أن لغة التدريس الرئيسية هي الألمانية.',
  }),
  admissionMode: fact('open', 'OFFICIAL_ADMISSION_MODE', AI_PROGRAM_SOURCE.id, CHECKED, {
    note: 'The programme is listed as Zulassungsfrei.',
    noteAR: 'البرنامج مدرج كـ Zulassungsfrei.',
  }),
  applicationChannel: fact('university', 'OFFICIAL_PROCEDURE', AI_PROGRAM_SOURCE.id, CHECKED, {
    note: 'The university publishes enrolment/application information for the programme through its own study portal.',
    noteAR: 'الجامعة تنشر معلومات التقديم والتسجيل للبرنامج عبر بوابتها الجامعية.',
  }),
  foreignQualification: fact(BAGRUT_EN, 'OFFICIAL_REQUIREMENT', 'anabin-isr', '2026-09-19', {
    noteAR: BAGRUT_AR,
  }),
  subjectRequirements: unverified(
    'OFFICIAL_REQUIREMENT',
    'No additional Israeli Bagrut subject or unit threshold was verified for this programme.',
    'لم يتم التحقق من أي شرط إضافي لمواد أو وحدات البجروت لهذا البرنامج.',
  ),
  languageRequirement: unverified(
    'OFFICIAL_LANGUAGE',
    'The programme is German-taught, but an exact CEFR/certificate minimum was not verified from the checked programme page.',
    'البرنامج بالألمانية، لكن لم يتم التحقق من حد CEFR أو قائمة الشهادات الدقيقة من صفحة البرنامج المفحوصة.',
  ),
  gradeRequirement: unverified(
    'OFFICIAL_REQUIREMENT',
    'No fixed converted-grade threshold was stated on the checked programme page.',
    'لم يذكر البرنامج حداً ثابتاً للمعدل المحوّل في الصفحة المفحوصة.',
  ),
  entranceRequirement: unverified(
    'OFFICIAL_PROCEDURE',
    'No separate aptitude test or interview was verified on the checked programme page.',
    'لم يتم التحقق من اختبار أهلية أو مقابلة منفصلة في صفحة البرنامج المفحوصة.',
  ),
  deadline: unverified(
    'OFFICIAL_DEADLINE',
    'Current intake dates should be read from the university deadline page rather than inferred from the programme overview.',
    'يجب قراءة مواعيد الدفعة الحالية من صفحة المواعيد في الجامعة بدلاً من استنتاجها من صفحة البرنامج.',
  ),
  documents: unverified(
    'OFFICIAL_DOCUMENT_REQUIREMENT',
    'Programme-specific document list was not read on the checked programme page.',
    'قائمة الوثائق الخاصة بالبرنامج لم تُقرأ في صفحة البرنامج المفحوصة.',
  ),
  programUrl: AI_PROGRAM_SOURCE.url,
  lastVerified: CHECKED,
};

const CYBER_SOURCE: IntelSource = {
  id: 'uni-saarland-cybersecurity-bsc',
  url: 'https://www.uni-saarland.de/en/study/programmes/bachelor/cybersecurity-english.html',
  title: 'Saarland University — Cybersecurity (English) B.Sc.',
  titleAR: 'جامعة سارلاند — بكالوريوس الأمن السيبراني بالإنجليزية',
  authority: 'university',
  checkedAt: CHECKED,
};

const CYBER_PROGRAM: ProgramIntel = {
  id: 'saarland-cybersecurity-bsc',
  universityName: 'Saarland University',
  universityNameAR: 'جامعة سارلاند',
  city: 'Saarbrücken',
  cityAR: 'ساربروكن',
  programName: 'Cybersecurity (English) (B.Sc.)',
  programNameDE: 'Cybersecurity (English)',
  programNameAR: 'الأمن السيبراني (بالإنجليزية) (بكالوريوس)',
  degreeLevel: 'bachelor',
  teachingLanguage: fact(['English'], 'OFFICIAL_LANGUAGE', CYBER_SOURCE.id, CHECKED, {
    note: 'The programme is taught entirely in English.',
    noteAR: 'البرنامج يُدرّس بالكامل بالإنجليزية.',
  }),
  admissionMode: fact('nc', 'OFFICIAL_ADMISSION_MODE', CYBER_SOURCE.id, CHECKED, {
    note: 'The programme has restricted entry.',
    noteAR: 'البرنامج مقيد القبول.',
  }),
  applicationChannel: fact('university', 'OFFICIAL_PROCEDURE', CYBER_SOURCE.id, CHECKED, {
    note: 'Applications are submitted through the Saarland Informatics Campus application portal.',
    noteAR: 'التقديم يتم عبر بوابة Saarland Informatics Campus.',
  }),
  foreignQualification: fact(BAGRUT_EN, 'OFFICIAL_REQUIREMENT', 'anabin-isr', '2026-09-19', {
    noteAR: BAGRUT_AR,
  }),
  subjectRequirements: unverified(
    'OFFICIAL_REQUIREMENT',
    'No additional Israeli Bagrut subject or unit threshold was verified from the checked programme page.',
    'لم يتم التحقق من شرط إضافي لمواد أو وحدات البجروت من صفحة البرنامج المفحوصة.',
  ),
  languageRequirement: fact(
    { minimumLevel: 'B2', certificates: ['B2 advanced English (recommended)'] },
    'OFFICIAL_LANGUAGE',
    CYBER_SOURCE.id,
    CHECKED,
    {
      note: 'The programme page lists B2 advanced English as recommended.',
      noteAR: 'صفحة البرنامج تذكر B2 متقدم بالإنجليزية كمستوى موصى به.',
    },
  ),
  gradeRequirement: unverified(
    'OFFICIAL_REQUIREMENT',
    'The programme uses additional application tracks; no single fixed converted-grade threshold was asserted on the checked programme page.',
    'يستخدم البرنامج مسارات تقديم إضافية؛ لم يتم تثبيت حد واحد للمعدل المحوّل في صفحة البرنامج المفحوصة.',
  ),
  entranceRequirement: unverified(
    'OFFICIAL_PROCEDURE',
    'Additional qualifications and application tracks exist, but the exact track-specific test/interview conditions must be read before advising a student.',
    'توجد مؤهلات ومسارات تقديم إضافية، لكن يجب قراءة شروط كل مسار من اختبار أو مقابلة قبل إعطاء الطالب جواباً.',
  ),
  deadline: fact(
    {
      semester: 'Winter semester',
      semesterAR: 'الفصل الشتوي',
      deadline: '15.07.',
    },
    'OFFICIAL_DEADLINE',
    CYBER_SOURCE.id,
    CHECKED,
    {
      note: 'Regular deadline is 15 July; optional early/interview-track dates are also published.',
      noteAR: 'الموعد العادي 15 يوليو؛ وتوجد أيضاً مواعيد مبكرة/لمسار المقابلة.',
    },
  ),
  documents: unverified(
    'OFFICIAL_DOCUMENT_REQUIREMENT',
    'The full document checklist was not reproduced from the application page.',
    'لم يتم نقل قائمة الوثائق الكاملة من صفحة التقديم.',
  ),
  fees: fact('No tuition fees; semester contribution applies.', 'OFFICIAL_PROCEDURE', CYBER_SOURCE.id, CHECKED, {
    noteAR: 'لا توجد رسوم دراسية؛ يوجد رسم فصل دراسي.',
  }),
  programUrl: CYBER_SOURCE.url,
  lastVerified: CHECKED,
};

const DATA_SOURCE: IntelSource = {
  id: 'uni-augsburg-data-science-bsc',
  url: 'https://www.uni-augsburg.de/de/studium/studienangebot/uebersicht/data-science-bsc/',
  title: 'Universität Augsburg — Data Science B.Sc.',
  titleAR: 'جامعة أوغسبورغ — بكالوريوس علوم البيانات',
  authority: 'university',
  checkedAt: CHECKED,
};

const DATA_PROGRAM: ProgramIntel = {
  id: 'augsburg-data-science-bsc',
  universityName: 'University of Augsburg',
  universityNameAR: 'جامعة أوغسبورغ',
  city: 'Augsburg',
  cityAR: 'أوغسبورغ',
  programName: 'Data Science (B.Sc.)',
  programNameDE: 'Data Science',
  programNameAR: 'علوم البيانات (بكالوريوس)',
  degreeLevel: 'bachelor',
  teachingLanguage: fact(['German'], 'OFFICIAL_LANGUAGE', DATA_SOURCE.id, CHECKED, {
    note: 'The programme page lists German as the language of instruction.',
    noteAR: 'صفحة البرنامج تذكر الألمانية كلغة تدريس.',
  }),
  admissionMode: fact('open', 'OFFICIAL_ADMISSION_MODE', DATA_SOURCE.id, CHECKED, {
    note: 'The programme is listed as Zulassungsfrei.',
    noteAR: 'البرنامج مدرج كـ Zulassungsfrei.',
  }),
  applicationChannel: fact('university', 'OFFICIAL_PROCEDURE', DATA_SOURCE.id, CHECKED, {
    note: 'The programme page links the university application/enrolment route for foreign higher-education entrance qualifications.',
    noteAR: 'صفحة البرنامج تربط بمسار التقديم/التسجيل في الجامعة لحاملي شهادات القبول الجامعي الأجنبية.',
  }),
  foreignQualification: fact(BAGRUT_EN, 'OFFICIAL_REQUIREMENT', 'anabin-isr', '2026-09-19', { noteAR: BAGRUT_AR }),
  subjectRequirements: unverified(
    'OFFICIAL_REQUIREMENT',
    'No additional Israeli Bagrut subject or unit threshold was verified on the programme page.',
    'لم يتم التحقق من شرط إضافي لمواد أو وحدات البجروت من صفحة البرنامج.',
  ),
  languageRequirement: fact(
    { minimumLevel: 'B2', certificates: ['German B2'] },
    'OFFICIAL_LANGUAGE',
    DATA_SOURCE.id,
    CHECKED,
    {
      note: 'The minimum German requirement shown is B2.',
      noteAR: 'الحد الأدنى للألمانية الظاهر في الصفحة هو B2.',
    },
  ),
  gradeRequirement: unverified(
    'OFFICIAL_REQUIREMENT',
    'No fixed converted-grade threshold is published on the checked programme page.',
    'لا يوجد حد ثابت للمعدل المحوّل منشور في صفحة البرنامج المفحوصة.',
  ),
  entranceRequirement: unverified(
    'OFFICIAL_PROCEDURE',
    'No separate aptitude test or interview was verified on the checked programme page.',
    'لم يتم التحقق من اختبار أهلية أو مقابلة منفصلة في صفحة البرنامج.',
  ),
  deadline: unverified(
    'OFFICIAL_DEADLINE',
    'The programme page says the enrolment/application deadline is published separately; read the current deadline page for the intake.',
    'صفحة البرنامج تنص على أن موعد التقديم/التسجيل يُنشر بشكل منفصل؛ اقرأ صفحة المواعيد الحالية للدفعة.',
  ),
  documents: unverified(
    'OFFICIAL_DOCUMENT_REQUIREMENT',
    'The full foreign-qualification document checklist was not read from the university page.',
    'قائمة الوثائق الكاملة لحاملي الشهادات الأجنبية لم تُقرأ من صفحة الجامعة.',
  ),
  programUrl: DATA_SOURCE.url,
  lastVerified: CHECKED,
};

const BAMBERG_CS_SOURCE: IntelSource = {
  id: 'uni-bamberg-informatik-bsc',
  url: 'https://www.uni-bamberg.de/studiengaenge/informatik-bachelor/',
  title: 'Universität Bamberg — Informatik B.Sc.',
  titleAR: 'جامعة بامبرغ — بكالوريوس Informatik',
  authority: 'university',
  checkedAt: CHECKED,
};

const CLOUD_PROGRAM: ProgramIntel = {
  id: 'bamberg-informatik-bsc-cloud-route',
  universityName: 'University of Bamberg',
  universityNameAR: 'جامعة بامبرغ',
  city: 'Bamberg',
  cityAR: 'بامبرغ',
  programName: 'Informatik (B.Sc.) — Cloud-related route',
  programNameDE: 'Informatik',
  programNameAR: 'علوم الحاسوب (بكالوريوس) — مسار مرتبط بالحوسبة السحابية',
  degreeLevel: 'bachelor',
  teachingLanguage: fact(['German'], 'OFFICIAL_LANGUAGE', BAMBERG_CS_SOURCE.id, CHECKED, {
    note: 'The programme page lists German as the main teaching language.',
    noteAR: 'صفحة البرنامج تذكر الألمانية كلغة التدريس الرئيسية.',
  }),
  admissionMode: fact('open', 'OFFICIAL_ADMISSION_MODE', BAMBERG_CS_SOURCE.id, CHECKED, {
    note: 'The programme is listed as Zulassungsfrei.',
    noteAR: 'البرنامج مدرج كـ Zulassungsfrei.',
  }),
  applicationChannel: fact('university', 'OFFICIAL_PROCEDURE', BAMBERG_CS_SOURCE.id, CHECKED, {
    note: 'The public programme route is handled by the University of Bamberg.',
    noteAR: 'مسار البرنامج العام يُدار من جامعة بامبرغ.',
  }),
  foreignQualification: fact(BAGRUT_EN, 'OFFICIAL_REQUIREMENT', 'anabin-isr', '2026-09-19', { noteAR: BAGRUT_AR }),
  subjectRequirements: unverified(
    'OFFICIAL_REQUIREMENT',
    'No additional Israeli Bagrut subject or unit threshold was verified for Informatik.',
    'لم يتم التحقق من شرط إضافي لمواد أو وحدات البجروت لتخصص Informatik.',
  ),
  languageRequirement: unverified(
    'OFFICIAL_LANGUAGE',
    'The programme is German-taught, but a programme-specific minimum certificate level was not independently verified in this pass.',
    'البرنامج بالألمانية، لكن الحد الأدنى الخاص بالشهادات لم يتم التحقق منه بشكل مستقل في هذا المرور.',
  ),
  gradeRequirement: unverified(
    'OFFICIAL_REQUIREMENT',
    'No fixed converted-grade threshold was published on the checked programme page.',
    'لا يوجد حد ثابت للمعدل المحوّل منشور في صفحة البرنامج المفحوصة.',
  ),
  entranceRequirement: unverified(
    'OFFICIAL_PROCEDURE',
    'No separate aptitude test or interview was verified on the checked programme page.',
    'لم يتم التحقق من اختبار أهلية أو مقابلة منفصلة في صفحة البرنامج.',
  ),
  deadline: unverified(
    'OFFICIAL_DEADLINE',
    'Current enrolment dates are published by the university and should be read for the intake being handled.',
    'مواعيد التسجيل الحالية تنشرها الجامعة ويجب قراءتها للدفعة التي يجري التعامل معها.',
  ),
  documents: unverified(
    'OFFICIAL_DOCUMENT_REQUIREMENT',
    'Full foreign-qualification documents were not read on the checked programme page.',
    'لم تتم قراءة الوثائق الكاملة لحاملي الشهادات الأجنبية من صفحة البرنامج.',
  ),
  programUrl: BAMBERG_CS_SOURCE.url,
  lastVerified: CHECKED,
};

const GAME_SOURCE: IntelSource = {
  id: 'hs-ansbach-vis-bachelor',
  url: 'https://www.hs-ansbach.de/bachelor/visualisierung-und-interaktion-in-digitalen-medien',
  title: 'Hochschule Ansbach — Visualisierung und Interaktion in digitalen Medien B.A.',
  titleAR: 'جامعة أنسباخ للعلوم التطبيقية — التصور والتفاعل في الوسائط الرقمية B.A.',
  authority: 'university',
  checkedAt: CHECKED,
};

const GAME_PROGRAM: ProgramIntel = {
  id: 'ansbach-vis-ba-game-route',
  universityName: 'Ansbach University of Applied Sciences',
  universityNameAR: 'جامعة أنسباخ للعلوم التطبيقية',
  city: 'Ansbach',
  cityAR: 'أنسباخ',
  programName: 'Visualization and Interaction in Digital Media (B.A.) — Game-related route',
  programNameDE: 'Visualisierung und Interaktion in digitalen Medien',
  programNameAR: 'التصور والتفاعل في الوسائط الرقمية (بكالوريوس) — مسار مرتبط بالألعاب',
  degreeLevel: 'bachelor',
  teachingLanguage: fact(['German'], 'OFFICIAL_LANGUAGE', GAME_SOURCE.id, CHECKED, {
    note: 'The programme is taught in German.',
    noteAR: 'البرنامج يُدرّس بالألمانية.',
  }),
  admissionMode: fact('open', 'OFFICIAL_ADMISSION_MODE', GAME_SOURCE.id, CHECKED, {
    note: 'The programme is listed as having no admission restriction.',
    noteAR: 'البرنامج مدرج بلا قيود قبول.',
  }),
  applicationChannel: fact('university', 'OFFICIAL_PROCEDURE', GAME_SOURCE.id, CHECKED, {
    note: 'Applications are handled by Hochschule Ansbach.',
    noteAR: 'التقديم يتم عبر Hochschule Ansbach.',
  }),
  foreignQualification: fact(BAGRUT_EN, 'OFFICIAL_REQUIREMENT', 'anabin-isr', '2026-09-19', { noteAR: BAGRUT_AR }),
  subjectRequirements: unverified(
    'OFFICIAL_REQUIREMENT',
    'No additional Israeli Bagrut subject/unit threshold was verified for the programme.',
    'لم يتم التحقق من شرط إضافي لمواد أو وحدات البجروت لهذا البرنامج.',
  ),
  languageRequirement: unverified(
    'OFFICIAL_LANGUAGE',
    'The programme is German-taught; the exact certificate minimum was not verified on the checked programme page.',
    'البرنامج بالألمانية؛ الحد الأدنى الدقيق للشهادة لم يتم التحقق منه من صفحة البرنامج المفحوصة.',
  ),
  gradeRequirement: unverified(
    'OFFICIAL_REQUIREMENT',
    'No fixed converted-grade threshold was published on the checked programme page.',
    'لم ينشر حد ثابت للمعدل المحوّل في صفحة البرنامج المفحوصة.',
  ),
  entranceRequirement: unverified(
    'OFFICIAL_PROCEDURE',
    'No programme-specific aptitude test/portfolio requirement was asserted from the checked page; verify before advising a student who wants the game route.',
    'لم يتم تثبيت اختبار/ملف أعمال خاص بالبرنامج من الصفحة المفحوصة؛ تحقّق قبل توجيه طالب يريد مسار الألعاب.',
  ),
  deadline: unverified(
    'OFFICIAL_DEADLINE',
    'Read the current application period from the university before giving a date.',
    'اقرأ فترة التقديم الحالية من الجامعة قبل إعطاء تاريخ.',
  ),
  documents: unverified(
    'OFFICIAL_DOCUMENT_REQUIREMENT',
    'The complete foreign-qualification document list was not read on the checked page.',
    'لم تُقرأ قائمة الوثائق الكاملة لحاملي الشهادات الأجنبية من الصفحة المفحوصة.',
  ),
  programUrl: GAME_SOURCE.url,
  lastVerified: CHECKED,
};

const INFO_SOURCE: IntelSource = {
  id: 'uni-bamberg-wirtschaftsinformatik-bsc',
  url: 'https://www.uni-bamberg.de/studiengaenge/wirtschaftsinformatik-bachelor/',
  title: 'Universität Bamberg — Wirtschaftsinformatik / Information Systems B.Sc.',
  titleAR: 'جامعة بامبرغ — Wirtschaftsinformatik / Information Systems B.Sc.',
  authority: 'university',
  checkedAt: CHECKED,
};

const INFO_PROGRAM: ProgramIntel = {
  id: 'bamberg-wirtschaftsinformatik-bsc',
  universityName: 'University of Bamberg',
  universityNameAR: 'جامعة بامبرغ',
  city: 'Bamberg',
  cityAR: 'بامبرغ',
  programName: 'Wirtschaftsinformatik / Information Systems (B.Sc.)',
  programNameDE: 'Wirtschaftsinformatik',
  programNameAR: 'نظم المعلومات / Wirtschaftsinformatik (بكالوريوس)',
  degreeLevel: 'bachelor',
  teachingLanguage: fact(['German'], 'OFFICIAL_LANGUAGE', INFO_SOURCE.id, CHECKED, {
    note: 'The programme page lists German as the main teaching language; some specialist material is in English.',
    noteAR: 'صفحة البرنامج تذكر الألمانية كلغة تدريس رئيسية؛ بعض المحتوى المتخصص بالإنجليزية.',
  }),
  admissionMode: fact('open', 'OFFICIAL_ADMISSION_MODE', INFO_SOURCE.id, CHECKED, {
    note: 'The programme is listed as Zulassungsfrei.',
    noteAR: 'البرنامج مدرج كـ Zulassungsfrei.',
  }),
  applicationChannel: fact('university', 'OFFICIAL_PROCEDURE', INFO_SOURCE.id, CHECKED, {
    note: 'The public programme route is handled by the University of Bamberg.',
    noteAR: 'مسار البرنامج العام يُدار من جامعة بامبرغ.',
  }),
  foreignQualification: fact(BAGRUT_EN, 'OFFICIAL_REQUIREMENT', 'anabin-isr', '2026-09-19', { noteAR: BAGRUT_AR }),
  subjectRequirements: unverified(
    'OFFICIAL_REQUIREMENT',
    'No additional Israeli Bagrut subject/unit threshold was verified for Wirtschaftsinformatik.',
    'لم يتم التحقق من شرط إضافي لمواد أو وحدات البجروت لتخصص Wirtschaftsinformatik.',
  ),
  languageRequirement: unverified(
    'OFFICIAL_LANGUAGE',
    'The programme is German-led, but the exact certificate minimum for an Israeli applicant was not independently verified in this pass.',
    'البرنامج بالألمانية، لكن الحد الأدنى الدقيق للشهادة لطالب إسرائيلي لم يتم التحقق منه بشكل مستقل في هذا المرور.',
  ),
  gradeRequirement: unverified(
    'OFFICIAL_REQUIREMENT',
    'No fixed converted-grade threshold was published on the checked programme page.',
    'لا يوجد حد ثابت للمعدل المحوّل منشور في صفحة البرنامج المفحوصة.',
  ),
  entranceRequirement: unverified(
    'OFFICIAL_PROCEDURE',
    'No separate aptitude test or interview was verified from the checked programme page.',
    'لم يتم التحقق من اختبار أهلية أو مقابلة منفصلة من صفحة البرنامج.',
  ),
  deadline: fact(
    {
      semester: 'Winter semester 2026/27',
      semesterAR: 'الفصل الشتوي 2026/27',
      deadline: '22.06.–02.10.2026',
    },
    'OFFICIAL_DEADLINE',
    INFO_SOURCE.id,
    CHECKED,
    {
      note: 'The university publishes this enrolment period for the cited 2026/27 winter intake; international applicants should verify any country-specific variation.',
      noteAR: 'الجامعة تنشر فترة التسجيل هذه للدفعة الشتوية 2026/27؛ على المتقدم الدولي التحقق من أي اختلاف خاص بالدولة.',
    },
  ),
  documents: unverified(
    'OFFICIAL_DOCUMENT_REQUIREMENT',
    'The full foreign-qualification document checklist was not read from the checked programme page.',
    'لم تُقرأ قائمة الوثائق الكاملة لحاملي الشهادات الأجنبية من صفحة البرنامج المفحوصة.',
  ),
  programUrl: INFO_SOURCE.url,
  lastVerified: CHECKED,
};

export const ARTIFICIAL_INTELLIGENCE_INTEL = commonMajor(
  'artificial-intelligence',
  'Artificial Intelligence',
  'الذكاء الاصطناعي',
  'Künstliche Intelligenz',
  { ar: ['الذكاء الاصطناعي', 'ذكاء اصطناعي'], he: ['בינה מלאכותית'], en: ['Artificial Intelligence', 'AI'], de: ['Künstliche Intelligenz', 'KI'] },
  [AI_PROGRAM],
  [AI_PROGRAM_SOURCE],
);

export const CYBERSECURITY_INTEL = commonMajor(
  'cybersecurity',
  'Cybersecurity',
  'الأمن السيبراني',
  'Cybersecurity',
  { ar: ['الأمن السيبراني', 'أمن المعلومات'], he: ['סייבר', 'אבטחת סייבר'], en: ['Cybersecurity', 'Cyber Security'], de: ['Cybersecurity', 'Cybersicherheit'] },
  [CYBER_PROGRAM],
  [CYBER_SOURCE],
);

export const DATA_SCIENCE_INTEL = commonMajor(
  'data-science',
  'Data Science',
  'علوم البيانات',
  'Data Science',
  { ar: ['علوم البيانات', 'علم البيانات'], he: ['מדעי הנתונים'], en: ['Data Science', 'Data Science B.Sc.'], de: ['Data Science', 'Datenwissenschaft'] },
  [DATA_PROGRAM],
  [DATA_SOURCE],
);

export const CLOUD_COMPUTING_INTEL = commonMajor(
  'cloud-computing',
  'Cloud Computing',
  'الحوسبة السحابية',
  'Cloud Computing',
  { ar: ['الحوسبة السحابية', 'كلاود'], he: ['מחשוב ענן'], en: ['Cloud Computing', 'Cloud'], de: ['Cloud Computing', 'Cloud Computing'] },
  [CLOUD_PROGRAM],
  [BAMBERG_CS_SOURCE],
);

export const GAME_DEVELOPMENT_INTEL = commonMajor(
  'game-development',
  'Game Development',
  'تطوير الألعاب',
  'Game Design',
  { ar: ['تطوير الألعاب', 'تصميم الألعاب'], he: ['פיתוח משחקים', 'עיצוב משחקים'], en: ['Game Development', 'Game Design'], de: ['Game Design', 'Spieleentwicklung'] },
  [GAME_PROGRAM],
  [GAME_SOURCE],
);

export const INFORMATION_MANAGEMENT_INTEL = commonMajor(
  'information-management',
  'Information Management',
  'إدارة المعلومات',
  'Wirtschaftsinformatik',
  { ar: ['إدارة المعلومات', 'إدارة تكنولوجيا المعلومات', 'نظم المعلومات'], he: ['ניהול מידע', 'מערכות מידע'], en: ['Information Management', 'IT Management', 'Information Systems'], de: ['Wirtschaftsinformatik', 'Informationsmanagement'] },
  [INFO_PROGRAM],
  [INFO_SOURCE],
);

/**
 * One concrete university route is required for every verified major.
 * The route is a source-backed reference, not a claim that it is suitable for
 * every student or the only university that offers the field.
 */
export const COMPUTER_IT_MAJORS: MajorIntel[] = [
  ARTIFICIAL_INTELLIGENCE_INTEL,
  CYBERSECURITY_INTEL,
  DATA_SCIENCE_INTEL,
  CLOUD_COMPUTING_INTEL,
  GAME_DEVELOPMENT_INTEL,
  INFORMATION_MANAGEMENT_INTEL,
];

export const COMPUTER_IT_GUIDANCE = [IT_GUIDANCE_EN];
