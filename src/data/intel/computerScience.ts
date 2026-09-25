/**
 * Computer Science / Informatik — the first fully researched Major Intelligence
 * entry. Every value below was read on the linked page on `CHECKED`.
 * Anything that was NOT explicitly stated on an official page is recorded as
 * `unverified(...)` with the page the team must open. Do not "fill the gap"
 * from another university, from the public majors page, or from memory.
 */
import type { IntelSource } from './factTypes';
import { fact, unverified, conflicting, guidance } from './factTypes';
import { COMPETITIVE_BGRUT_SOURCE, competitiveBagrutForMajor } from './competitiveBagrut';
import type { MajorIntel, ProgramIntel } from './types';

const CHECKED = '2026-09-17';
export const CS_LAST_VERIFIED = '2026-09';

const SOURCES: IntelSource[] = [
  COMPETITIVE_BGRUT_SOURCE,
  {
    id: 'anabin-isr',
    url: 'https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang',
    title: "anabin (KMK/ZAB) — Israel, Te'udat bagrut (record ISR-BV01)",
    titleAR: 'anabin (KMK/ZAB) — إسرائيل، تعودات بجروت (السجل ISR-BV01)',
    authority: 'anabin',
    checkedAt: '2026-09-06',
  },
  {
    id: 'kmk-gesnot',
    url: 'https://www.kmk.org/fileadmin/Dateien/pdf/ZAB/Hochschulzugang_Beschluesse_der_KMK/GesNot05.pdf',
    title: 'KMK — Festsetzung der Gesamtnote bei ausländischen Hochschulzugangszeugnissen (modified Bavarian formula)',
    titleAR: 'KMK — تحديد المعدل العام للشهادات الأجنبية (صيغة بافاريا المعدّلة)',
    authority: 'kmk',
    checkedAt: '2026-09-06',
  },
  {
    id: 'tum-cit-bsc',
    url: 'https://www.cit.tum.de/en/cit/studium/studiengaenge/bachelor-informatik/',
    title: 'TUM School of CIT — Bachelor Informatik (Eckdaten)',
    titleAR: 'TUM — بكالوريوس Informatik (البيانات الأساسية)',
    authority: 'university',
    checkedAt: CHECKED,
  },
  {
    id: 'tum-efv',
    url: 'https://www.tum.de/fileadmin/user_upload_87/gi32rab/BA_Informatik_Lesb.F._EfV_03.09.24.pdf',
    title: 'TUM — Satzung über die Eignungsfeststellung für den Bachelorstudiengang Informatik',
    titleAR: 'TUM — لائحة إثبات الأهلية لبرنامج بكالوريوس Informatik',
    authority: 'university',
    checkedAt: CHECKED,
  },
  {
    id: 'tum-sprach',
    url: 'https://www.tum.de/studium/bewerbung/infoportal-bewerbung/zulassungsvoraussetzungen/sprachnachweise',
    title: 'TUM — Sprachnachweise (Zulassungsvoraussetzungen)',
    titleAR: 'TUM — إثباتات اللغة (شروط القبول)',
    authority: 'university',
    checkedAt: CHECKED,
  },
  {
    id: 'rwth-int',
    url: 'https://www.rwth-aachen.de/go/id/drar',
    title: 'RWTH Aachen — Zugangsvoraussetzungen für internationale Studieninteressierte (Bachelor)',
    titleAR: 'RWTH آخن — شروط القبول للطلاب الدوليين (بكالوريوس)',
    authority: 'university',
    checkedAt: CHECKED,
  },
  {
    id: 'rwth-info-bew',
    url: 'https://www.informatik.rwth-aachen.de/cms/informatik/studium/vor-dem-studium/bewerbungsinfos/~npqh/bachelor-informatik/',
    title: 'RWTH Aachen — Bewerbung für den Bachelor Informatik',
    titleAR: 'RWTH آخن — التقديم لبكالوريوس Informatik',
    authority: 'university',
    checkedAt: CHECKED,
  },
  {
    id: 'rwth-sprach',
    url: 'https://www.rwth-aachen.de/global/show_document.asp?download=1&id=aaaaaaaaabpixrg',
    title: 'RWTH Aachen — Sprachanforderungen (Übersicht je Studiengang, PDF)',
    titleAR: 'RWTH آخن — متطلبات اللغة لكل برنامج (PDF)',
    authority: 'university',
    checkedAt: CHECKED,
  },
  {
    id: 'tud-info-bsc',
    url: 'https://www.informatik.tu-darmstadt.de/studium_fb20/im_studium/studiengaenge_liste/informatik_bsc.de.jsp',
    title: 'TU Darmstadt — Bachelorstudiengang Informatik (Überblick)',
    titleAR: 'TU دارمشتات — بكالوريوس Informatik (نظرة عامة)',
    authority: 'university',
    checkedAt: CHECKED,
  },
  {
    id: 'tud-fristen',
    url: 'https://www.tu-darmstadt.de/studieren/studieninteressierte/bewerbung_zulassung_tu/bewerbungsfristen/bachelor_studiengaenge_1/index.en.jsp',
    title: 'TU Darmstadt — Application deadlines, Bachelor degree programmes',
    titleAR: 'TU دارمشتات — مواعيد التقديم لبرامج البكالوريوس',
    authority: 'university',
    checkedAt: CHECKED,
  },
  {
    id: 'stg-int-bew',
    url: 'https://uni-stuttgart.de/studium/bewerbung/international-degree/bewerbung/',
    title: 'Universität Stuttgart — Bewerbungsinformationen für internationale Studieninteressierte',
    titleAR: 'جامعة شتوتغارت — معلومات التقديم للطلاب الدوليين',
    authority: 'university',
    checkedAt: CHECKED,
  },
  {
    id: 'stg-termine',
    url: 'https://www.uni-stuttgart.de/studium/bewerbung/bewerbungstermine',
    title: 'Universität Stuttgart — Bewerbungstermine',
    titleAR: 'جامعة شتوتغارت — مواعيد التقديم',
    authority: 'university',
    checkedAt: CHECKED,
  },
];

const BAGRUT_ROUTE_EN =
  'Israeli Te\'udat bagrut is listed in anabin as direct university access for all subjects when it includes Mathematics 3 units, English 4 units and one further subject at 4 units.';
const BAGRUT_ROUTE_AR =
  'تعودات بجروت مُدرجة في anabin كقبول جامعي مباشر لجميع التخصصات إذا تضمّنت رياضيات ٣ وحدات، إنجليزية ٤ وحدات ومادة إضافية ٤ وحدات.';

const PROGRAMS: ProgramIntel[] = [
  {
    id: 'tum-informatik-bsc',
    universityName: 'Technische Universität München (TUM)',
    universityNameAR: 'الجامعة التقنية في ميونخ (TUM)',
    city: 'Garching / Munich',
    cityAR: 'غارشينغ / ميونخ',
    programName: 'Informatik (B.Sc.)',
    programNameDE: 'Bachelor Informatik',
    programNameAR: 'علوم الحاسوب Informatik (بكالوريوس)',
    degreeLevel: 'bachelor',
    teachingLanguage: fact(['German'], 'OFFICIAL_LANGUAGE', 'tum-cit-bsc', CHECKED, {
      note: 'Eckdaten: "Unterrichtssprache: Deutsch".',
      noteAR: 'البيانات الأساسية: لغة التدريس ألمانية.',
    }),
    admissionMode: fact('aptitude_test', 'OFFICIAL_ADMISSION_MODE', 'tum-efv', CHECKED, {
      note: 'Admission requires the Eignungsfeststellungsverfahren (aptitude assessment) in addition to the general requirements.',
      noteAR: 'القبول يتطلب إجراء إثبات الأهلية (Eignungsfeststellung) إضافةً إلى الشروط العامة.',
    }),
    applicationChannel: unverified(
      'OFFICIAL_PROCEDURE',
      'The application channel for this programme was not stated on the checked page. Open the TUM application portal page before telling the student where to apply.',
      'قناة التقديم لهذا البرنامج غير مذكورة في الصفحة التي جرى فحصها. افتح صفحة بوابة التقديم في TUM قبل إبلاغ الطالب.',
    ),
    foreignQualification: fact(BAGRUT_ROUTE_EN, 'OFFICIAL_REQUIREMENT', 'anabin-isr', '2026-09-06', {
      noteAR: BAGRUT_ROUTE_AR,
    }),
    subjectRequirements: unverified(
      'OFFICIAL_REQUIREMENT',
      'No programme-specific Bagrut subject or unit requirement was found beyond the anabin access rule. Do not invent one; check the FPSO and the aptitude-assessment statute.',
      'لا يوجد شرط مواد أو وحدات خاص بالبرنامج غير قاعدة anabin. لا تفترض شرطاً؛ راجع لائحة البرنامج ولائحة إثبات الأهلية.',
    ),
    languageRequirement: unverified(
      'OFFICIAL_LANGUAGE',
      'The programme is taught in German, but the exact accepted certificates and minimum level must be read from the TUM Sprachnachweise page for this programme.',
      'البرنامج يُدرَّس بالألمانية، لكن الشهادات المقبولة والمستوى الأدنى يجب قراءتها من صفحة إثباتات اللغة في TUM لهذا البرنامج.',
    ),
    gradeRequirement: unverified(
      'OFFICIAL_REQUIREMENT',
      'TUM publishes no fixed converted-grade threshold for this programme on the checked pages; the grade is one element of the aptitude assessment.',
      'لا تنشر TUM حد معدل محوَّل ثابت لهذا البرنامج في الصفحات المفحوصة؛ المعدل أحد عناصر إجراء إثبات الأهلية.',
    ),
    entranceRequirement: fact(
      'Eignungsfeststellungsverfahren (aptitude assessment) under the statute of 13 May 2022, readable version of 3 September 2024.',
      'OFFICIAL_PROCEDURE',
      'tum-efv',
      CHECKED,
      { noteAR: 'إجراء إثبات الأهلية وفق اللائحة الصادرة في ١٣ أيار ٢٠٢٢، النسخة المقروءة بتاريخ ٣ أيلول ٢٠٢٤.' },
    ),
    deadline: unverified(
      'OFFICIAL_DEADLINE',
      'No application deadline was stated on the checked programme page. Read the current deadline from TUM before giving the student a date.',
      'لا يوجد موعد تقديم على صفحة البرنامج المفحوصة. اقرأ الموعد الحالي من TUM قبل إعطاء الطالب تاريخاً.',
    ),
    documents: unverified(
      'OFFICIAL_DOCUMENT_REQUIREMENT',
      'Document list not read on the checked pages.',
      'قائمة الوثائق غير مقروءة في الصفحات المفحوصة.',
    ),
    fees: fact(
      'Semester contribution, plus tuition fees for international students from non-EU countries.',
      'OFFICIAL_PROCEDURE',
      'tum-cit-bsc',
      CHECKED,
      { noteAR: 'رسوم الفصل، بالإضافة إلى رسوم دراسية للطلاب الدوليين من خارج الاتحاد الأوروبي.' },
    ),
    programUrl: 'https://www.cit.tum.de/en/cit/studium/studiengaenge/bachelor-informatik/',
    lastVerified: CHECKED,
  },
  {
    id: 'rwth-informatik-bsc',
    universityName: 'RWTH Aachen University',
    universityNameAR: 'جامعة RWTH آخن',
    city: 'Aachen',
    cityAR: 'آخن',
    programName: 'Informatik (B.Sc.)',
    programNameDE: 'Bachelor Informatik',
    programNameAR: 'علوم الحاسوب Informatik (بكالوريوس)',
    degreeLevel: 'bachelor',
    teachingLanguage: unverified(
      'OFFICIAL_LANGUAGE',
      'The teaching language was not stated on the checked application page. The per-programme row in the RWTH Sprachanforderungen PDF is the authoritative place to read it.',
      'لغة التدريس غير مذكورة في صفحة التقديم المفحوصة. الصف الخاص بالبرنامج في ملف متطلبات اللغة هو المرجع.',
    ),
    admissionMode: fact('nc', 'OFFICIAL_ADMISSION_MODE', 'rwth-info-bew', CHECKED, {
      note: 'The faculty application page explains the NC (restricted admission) procedure for this programme.',
      noteAR: 'صفحة التقديم في الكلية تشرح إجراء القبول المقيّد (NC) لهذا البرنامج.',
    }),
    applicationChannel: fact('university', 'OFFICIAL_PROCEDURE', 'rwth-info-bew', CHECKED, {
      note: 'Applications are submitted through RWTHonline; first subject semester starts in the winter semester only.',
      noteAR: 'التقديم يتم عبر منصة RWTHonline؛ الفصل الدراسي الأول يبدأ في الفصل الشتوي فقط.',
    }),
    foreignQualification: fact(BAGRUT_ROUTE_EN, 'OFFICIAL_REQUIREMENT', 'anabin-isr', '2026-09-06', {
      noteAR: BAGRUT_ROUTE_AR,
    }),
    subjectRequirements: unverified(
      'OFFICIAL_REQUIREMENT',
      'No programme-specific Bagrut subject or unit requirement was found on the checked pages.',
      'لا يوجد شرط مواد أو وحدات خاص بالبرنامج في الصفحات المفحوصة.',
    ),
    languageRequirement: unverified(
      'OFFICIAL_LANGUAGE',
      'RWTH lists the accepted language proof per programme in the Sprachanforderungen PDF. Read the Informatik B.Sc. row there instead of assuming a level.',
      'تدرج RWTH إثبات اللغة المقبول لكل برنامج في ملف متطلبات اللغة. اقرأ صف Informatik B.Sc. بدل افتراض مستوى.',
    ),
    gradeRequirement: fact(
      {
        maximumGermanGrade: 2.5,
        compensation:
          'A weaker converted grade can be compensated by presenting the TestAS (offered four times a year).',
        compensationAR:
          'يمكن تعويض المعدل الأضعف بتقديم اختبار TestAS (يُعقد أربع مرات سنوياً).',
      },
      'OFFICIAL_REQUIREMENT',
      'rwth-int',
      CHECKED,
      {
        note: 'International applicants not treated as equivalent to German applicants must show a converted overall grade of 2.5 or better.',
        noteAR: 'على المتقدمين الدوليين غير المُعامَلين معاملة الألمان إثبات معدل محوَّل ٢٫٥ أو أفضل.',
      },
    ),
    entranceRequirement: unverified(
      'OFFICIAL_PROCEDURE',
      'No aptitude test or interview was listed for this programme on the checked pages.',
      'لا يوجد اختبار أهلية أو مقابلة مذكورة لهذا البرنامج في الصفحات المفحوصة.',
    ),
    deadline: fact(
      { semester: 'Winter semester, first subject semester', semesterAR: 'الفصل الشتوي، الفصل الدراسي الأول', deadline: '15.07.' },
      'OFFICIAL_DEADLINE',
      'rwth-info-bew',
      CHECKED,
      {
        note: 'Start is possible in the winter semester only; the faculty page states the 15.07. application deadline. Re-check the year-specific date each round.',
        noteAR: 'البدء ممكن في الفصل الشتوي فقط؛ صفحة الكلية تذكر موعد ١٥٫٠٧. أعد التحقق من تاريخ السنة في كل جولة.',
      },
    ),
    documents: unverified(
      'OFFICIAL_DOCUMENT_REQUIREMENT',
      'Document list not read on the checked pages.',
      'قائمة الوثائق غير مقروءة في الصفحات المفحوصة.',
    ),
    programUrl:
      'https://www.informatik.rwth-aachen.de/cms/informatik/studium/vor-dem-studium/bewerbungsinfos/~npqh/bachelor-informatik/',
    lastVerified: CHECKED,
  },
  {
    id: 'tud-informatik-bsc',
    universityName: 'Technische Universität Darmstadt',
    universityNameAR: 'الجامعة التقنية في دارمشتات',
    city: 'Darmstadt',
    cityAR: 'دارمشتات',
    programName: 'Informatik (B.Sc.)',
    programNameDE: 'Bachelorstudiengang Informatik',
    programNameAR: 'علوم الحاسوب Informatik (بكالوريوس)',
    degreeLevel: 'bachelor',
    teachingLanguage: fact(['German'], 'OFFICIAL_LANGUAGE', 'tud-info-bsc', CHECKED, {
      note: 'Überblick: "Lehrsprache: Deutsch", 180 credits over six semesters, start in the winter semester.',
      noteAR: 'النظرة العامة: لغة التدريس ألمانية، ١٨٠ نقطة على ستة فصول، البدء في الفصل الشتوي.',
    }),
    admissionMode: unverified(
      'OFFICIAL_ADMISSION_MODE',
      'The programme overview does not state whether admission is restricted (NC). The central deadline table marks the procedure per programme — read the Informatik row there.',
      'صفحة البرنامج لا تذكر ما إذا كان القبول مقيّداً (NC). جدول المواعيد المركزي يبيّن الإجراء لكل برنامج — اقرأ صف Informatik هناك.',
    ),
    applicationChannel: unverified(
      'OFFICIAL_PROCEDURE',
      'The application route for applicants with an international qualification was not read on the checked pages.',
      'مسار التقديم لحاملي شهادة أجنبية غير مقروء في الصفحات المفحوصة.',
    ),
    foreignQualification: fact(BAGRUT_ROUTE_EN, 'OFFICIAL_REQUIREMENT', 'anabin-isr', '2026-09-06', {
      noteAR: BAGRUT_ROUTE_AR,
    }),
    subjectRequirements: unverified(
      'OFFICIAL_REQUIREMENT',
      'The overview names a university entrance qualification plus interest in logical problem solving and mathematics — no Bagrut unit or grade requirement is published.',
      'النظرة العامة تذكر شهادة تؤهل للجامعة واهتماماً بحل المسائل المنطقية والرياضيات — دون شرط وحدات أو علامات بجروت.',
    ),
    languageRequirement: unverified(
      'OFFICIAL_LANGUAGE',
      'The programme is taught in German; the accepted proof was not read on the checked pages.',
      'البرنامج يُدرَّس بالألمانية؛ إثبات اللغة المقبول غير مقروء في الصفحات المفحوصة.',
    ),
    gradeRequirement: unverified(
      'OFFICIAL_REQUIREMENT',
      'No converted-grade threshold was published on the checked pages.',
      'لا يوجد حد معدل محوَّل منشور في الصفحات المفحوصة.',
    ),
    entranceRequirement: unverified(
      'OFFICIAL_PROCEDURE',
      'No aptitude test or interview was listed on the checked pages.',
      'لا يوجد اختبار أهلية أو مقابلة مذكورة في الصفحات المفحوصة.',
    ),
    deadline: conflicting(
      'OFFICIAL_DEADLINE',
      [
        { value: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '01.06.–31.08.' }, sourceId: 'tud-info-bsc' },
        { value: { semester: 'Winter semester 2026/27', semesterAR: 'الفصل الشتوي ٢٠٢٦/٢٧', deadline: '15.07.2026 (cut-off)' }, sourceId: 'tud-fristen' },
      ],
      'The department page and the central deadline page state different application windows. Do not give the student a date; open both pages or ask the university which applies to this programme.',
      'صفحة القسم وصفحة المواعيد المركزية تذكران نافذتَي تقديم مختلفتين. لا تعطِ الطالب تاريخاً؛ افتح الصفحتين أو اسأل الجامعة أيهما ينطبق.',
    ),
    documents: unverified(
      'OFFICIAL_DOCUMENT_REQUIREMENT',
      'Document list not read on the checked pages.',
      'قائمة الوثائق غير مقروءة في الصفحات المفحوصة.',
    ),
    programUrl:
      'https://www.informatik.tu-darmstadt.de/studium_fb20/im_studium/studiengaenge_liste/informatik_bsc.de.jsp',
    lastVerified: CHECKED,
  },
  {
    id: 'stuttgart-informatik-bsc',
    universityName: 'Universität Stuttgart',
    universityNameAR: 'جامعة شتوتغارت',
    city: 'Stuttgart',
    cityAR: 'شتوتغارت',
    programName: 'Informatik (B.Sc.)',
    programNameDE: 'Bachelor Informatik',
    programNameAR: 'علوم الحاسوب Informatik (بكالوريوس)',
    degreeLevel: 'bachelor',
    teachingLanguage: unverified(
      'OFFICIAL_LANGUAGE',
      'Teaching language not read on the checked pages — open the programme page before stating it.',
      'لغة التدريس غير مقروءة في الصفحات المفحوصة — افتح صفحة البرنامج قبل ذكرها.',
    ),
    admissionMode: unverified(
      'OFFICIAL_ADMISSION_MODE',
      'Stuttgart states that single-subject bachelor programmes with NC but without an entrance examination also take part in the DoSV procedure; whether Informatik has an NC was not read.',
      'تذكر شتوتغارت أن برامج البكالوريوس أحادية التخصص ذات القبول المقيّد بلا امتحان قبول تشارك أيضاً في إجراء DoSV؛ ولم يُقرأ ما إذا كان Informatik مقيّداً.',
    ),
    applicationChannel: fact('university', 'OFFICIAL_PROCEDURE', 'stg-int-bew', CHECKED, {
      note: 'All applicant groups apply through the C@MPUS campus-management system; paper applications are not accepted and the application itself is free.',
      noteAR: 'جميع فئات المتقدمين تتقدم عبر نظام C@MPUS؛ لا تُقبل الطلبات الورقية والتقديم مجاني.',
    }),
    foreignQualification: fact(BAGRUT_ROUTE_EN, 'OFFICIAL_REQUIREMENT', 'anabin-isr', '2026-09-06', {
      noteAR: BAGRUT_ROUTE_AR,
    }),
    subjectRequirements: unverified(
      'OFFICIAL_REQUIREMENT',
      'No programme-specific Bagrut subject or unit requirement was read.',
      'لم يُقرأ أي شرط مواد أو وحدات خاص بالبرنامج.',
    ),
    languageRequirement: unverified(
      'OFFICIAL_LANGUAGE',
      'Language proof not read on the checked pages.',
      'إثبات اللغة غير مقروء في الصفحات المفحوصة.',
    ),
    gradeRequirement: unverified(
      'OFFICIAL_REQUIREMENT',
      'No converted-grade threshold was read on the checked pages.',
      'لم يُقرأ أي حد معدل محوَّل في الصفحات المفحوصة.',
    ),
    entranceRequirement: unverified(
      'OFFICIAL_PROCEDURE',
      'Not read on the checked pages.',
      'غير مقروء في الصفحات المفحوصة.',
    ),
    deadline: fact(
      { semester: 'Winter semester (bachelor, first subject semester only)', semesterAR: 'الفصل الشتوي (بكالوريوس، الفصل الأول فقط)', deadline: 'Application round opens mid-May' },
      'OFFICIAL_DEADLINE',
      'stg-termine',
      CHECKED,
      {
        note: 'Bachelor applications for the first subject semester are possible for the winter semester only; the round opens in mid-May. The exact closing date must be read per programme.',
        noteAR: 'التقديم للفصل الأول من البكالوريوس ممكن للفصل الشتوي فقط، وتفتح الجولة منتصف أيار. يجب قراءة موعد الإغلاق الدقيق لكل برنامج.',
      },
    ),
    documents: fact(
      [
        'All documents translated into German or English by a sworn translator',
        'Each document uploaded twice: original language and translation',
      ],
      'OFFICIAL_DOCUMENT_REQUIREMENT',
      'stg-int-bew',
      CHECKED,
      { noteAR: 'جميع الوثائق مترجمة إلى الألمانية أو الإنجليزية من مترجم محلَّف، وتُرفع مرتين: باللغة الأصلية ومترجمة.' },
    ),
    fees: fact(
      'International students who are not nationals of an EU/EEA member state pay tuition fees in Baden-Württemberg.',
      'OFFICIAL_PROCEDURE',
      'stg-int-bew',
      CHECKED,
      { noteAR: 'الطلاب الدوليون من غير مواطني دول الاتحاد الأوروبي/المنطقة الاقتصادية يدفعون رسوماً دراسية في بادن-فورتمبيرغ.' },
    ),
    programUrl: 'https://uni-stuttgart.de/studium/bewerbung/international-degree/bewerbung/',
    lastVerified: CHECKED,
  },
];

export const COMPUTER_SCIENCE_INTEL: MajorIntel = {
  id: 'computer-science',
  canonicalEN: 'Computer Science',
  canonicalAR: 'علوم الحاسوب',
  nameDE: 'Informatik',
  degreeLevel: 'bachelor',
  aliases: {
    ar: ['علوم الحاسوب', 'علم الحاسوب', 'هندسة برمجيات', 'حوسبة', 'كمبيوتر'],
    he: ['מדעי המחשב', 'הנדסת תוכנה', 'מחשבים'],
    en: ['Computer Science', 'Software Engineering', 'Informatics', 'CS'],
    de: ['Informatik', 'Angewandte Informatik', 'Technische Informatik'],
  },
  status: 'verified',
  lastVerified: CS_LAST_VERIFIED,
  competitiveBagrutThreshold: competitiveBagrutForMajor('computer-science'),
  bagrutAccess: fact(
    { mathUnits: 3, englishUnits: 4, furtherUnits: 4 },
    'OFFICIAL_REQUIREMENT',
    'anabin-isr',
    '2026-09-06',
    {
      note: BAGRUT_ROUTE_EN,
      noteAR: BAGRUT_ROUTE_AR,
    },
  ),
  gradeConversion: fact(
    'German grade = 1 + 3 × (Nmax − N) / (Nmax − Nmin). The result is a conversion, not an admission decision.',
    'OFFICIAL_PROCEDURE',
    'kmk-gesnot',
    '2026-09-06',
    { noteAR: 'الدرجة الألمانية = ١ + ٣ × (Nmax − N) / (Nmax − Nmin). النتيجة تحويل حسابي وليست قرار قبول.' },
  ),
  language: unverified(
    'OFFICIAL_LANGUAGE',
    'There is no single field-wide German level for Computer Science. Each programme sets its own requirement — read the programme card.',
    'لا يوجد مستوى ألماني موحّد لعلوم الحاسوب. كل برنامج يحدد شرطه — اقرأ بطاقة البرنامج.',
  ),
  programs: PROGRAMS,
  sources: SOURCES,
};

/** DARB operational guidance, kept strictly separate from official facts. */
export const CS_GUIDANCE = [
  guidance(
    'Keep at least one programme with no published grade threshold on the list, so a single NC result does not end the application round.',
    'أبقِ على الأقل برنامجاً واحداً بلا حد معدل منشور ضمن القائمة، حتى لا تنهي نتيجة قبول مقيّد واحدة جولة التقديم.',
  ),
  guidance(
    'Confirm the German certificate date before proposing a programme as an immediate application option.',
    'تأكّد من موعد شهادة اللغة الألمانية قبل اقتراح برنامج كخيار تقديم فوري.',
  ),
];
