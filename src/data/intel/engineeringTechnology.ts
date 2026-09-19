/**
 * DARB Major Intelligence — Engineering & Technology category.
 *
 * Research scope: Bachelor's programmes in Germany for international applicants
 * holding an Israeli Te'udat Bagrut.
 *
 * Strict rule: only facts supported by an authoritative source are marked
 * verified. Missing programme-specific evidence remains unverified.
 */
import type { IntelSource } from './factTypes';
import { fact, unverified } from './factTypes';
import type { MajorIntel, ProgramIntel } from './types';

const CHECKED = '2026-09-19';

const SOURCES: IntelSource[] = [
  {
    id: 'daad-israel-bagrut',
    url: 'https://www.daad.de/en/studying-in-germany/requirements/admission-database/?ad-layer=3&ad-layerId=3143',
    title: 'DAAD — Database on admission requirements: Israel / Te\'udat bagrut',
    titleAR: 'DAAD — قاعدة بيانات شروط القبول: إسرائيل / تعودات بجروت',
    authority: 'daad',
    checkedAt: CHECKED,
  },
  {
    id: 'kmk-grade-conversion',
    url: 'https://www.kmk.org/fileadmin/pdf/PresseUndAktuelles/Beschluesse_Veroeffentlichungen/allg_Schulwesen/289-5_Ges_Not.pdf',
    title: 'KMK — Vereinbarung über die Festsetzung der Gesamtnote bei ausländischen Hochschulzugangszeugnissen',
    titleAR: 'KMK — اتفاقية تحديد المعدل العام للشهادات الأجنبية المؤهلة للجامعة',
    authority: 'kmk',
    checkedAt: CHECKED,
  },
  {
    id: 'stuttgart-international-application',
    url: 'https://www.uni-stuttgart.de/studium/bewerbung/international-degree/',
    title: 'Universität Stuttgart — Internationale Studieninteressierte, die einen Studienabschluss anstreben',
    titleAR: 'جامعة شتوتغارت — المتقدمون الدوليون الراغبون بالحصول على درجة',
    authority: 'university',
    checkedAt: CHECKED,
  },
  {
    id: 'stuttgart-application',
    url: 'https://www.uni-stuttgart.de/studium/bewerbung',
    title: 'Universität Stuttgart — Bewerbung und Einschreibung',
    titleAR: 'جامعة شتوتغارت — التقديم والتسجيل',
    authority: 'university',
    checkedAt: CHECKED,
  },
  {
    id: 'stuttgart-language',
    url: 'https://www.uni-stuttgart.de/studium/bewerbung/international-degree/sprachvoraussetzungen/',
    title: 'Universität Stuttgart — Sprachvoraussetzungen für deutschsprachige Studiengänge',
    titleAR: 'جامعة شتوتغارت — متطلبات اللغة للبرامج التي تُدرَّس بالألمانية',
    authority: 'university',
    checkedAt: CHECKED,
  },
  {
    id: 'stuttgart-language-statute',
    url: 'https://www.uni-stuttgart.de/universitaet/aktuelles/bekanntmachungen/Amtliche-Bekanntmachung-Nummer-57-2024/',
    title: 'Universität Stuttgart — Satzung über den Nachweis ausreichender deutscher Sprachkenntnisse',
    titleAR: 'جامعة شتوتغارت — لائحة إثبات المعرفة الكافية باللغة الألمانية',
    authority: 'university',
    checkedAt: CHECKED,
  },
  {
    id: 'stuttgart-mechanical',
    url: 'https://www.uni-stuttgart.de/studium/bachelor/maschinenbau-b.sc./bewerbung/',
    title: 'Universität Stuttgart — Maschinenbau B.Sc. Bewerbung',
    titleAR: 'جامعة شتوتغارت — بكالوريوس الهندسة الميكانيكية: التقديم',
    authority: 'university',
    checkedAt: CHECKED,
  },
  {
    id: 'stuttgart-electrical',
    url: 'https://www.uni-stuttgart.de/studium/bachelor/elektrotechnik-und-informationstechnik-b.sc./bewerbung/',
    title: 'Universität Stuttgart — Elektrotechnik und Informationstechnik B.Sc. Bewerbung',
    titleAR: 'جامعة شتوتغارت — بكالوريوس الهندسة الكهربائية وتقنية المعلومات: التقديم',
    authority: 'university',
    checkedAt: CHECKED,
  },
  {
    id: 'stuttgart-civil',
    url: 'https://www.uni-stuttgart.de/studium/bachelor/bauingenieurwesen-b.sc./bewerbung/',
    title: 'Universität Stuttgart — Bauingenieurwesen B.Sc. Bewerbung',
    titleAR: 'جامعة شتوتغارت — بكالوريوس الهندسة المدنية: التقديم',
    authority: 'university',
    checkedAt: CHECKED,
  },
  {
    id: 'stuttgart-environmental',
    url: 'https://www.uni-stuttgart.de/studium/bachelor/umweltschutztechnik-b.sc./bewerbung/',
    title: 'Universität Stuttgart — Umweltschutztechnik B.Sc. Bewerbung',
    titleAR: 'جامعة شتوتغارت — بكالوريوس هندسة حماية البيئة: التقديم',
    authority: 'university',
    checkedAt: CHECKED,
  },
  {
    id: 'stuttgart-materials',
    url: 'https://www.uni-stuttgart.de/studium/bachelor/materialwissenschaft-b.sc./bewerbung/',
    title: 'Universität Stuttgart — Materialwissenschaft B.Sc. Bewerbung',
    titleAR: 'جامعة شتوتغارت — بكالوريوس علم وهندسة المواد: التقديم',
    authority: 'university',
    checkedAt: CHECKED,
  },
];

const BAGRUT_EN =
  'DAAD\'s admission database states that Te\'udat bagrut gives direct general admission for academic studies in any subject area when the final examination includes Mathematics with 3 study units, English with 4 study units, and one further subject with 4 study units.';
const BAGRUT_AR =
  'قاعدة بيانات DAAD تذكر أن تعودات بجروت تمنح قبولاً جامعياً عاماً مباشراً للدراسة الأكاديمية في أي مجال عندما يتضمن امتحان البجروت النهائي رياضيات 3 وحدات، إنجليزية 4 وحدات، ومادة إضافية 4 وحدات.';

const SHARED_FOREIGN_QUALIFICATION = fact(
  BAGRUT_EN,
  'OFFICIAL_REQUIREMENT',
  'daad-israel-bagrut',
  CHECKED,
  { noteAR: BAGRUT_AR },
);

const SHARED_LANGUAGE = fact(
  {
    language: 'German' as const,
    minimumLevel: 'C1' as const,
    certificates: [
      'TestDaF with at least level 4 in all four parts',
      'DSH-2 or better',
      'telc Deutsch C1 Hochschule',
      'DSD II',
      'Goethe-Zertifikat C1',
      'Goethe-Zertifikat C2: Großes Deutsches Sprachdiplom (GDS)',
      'Österreichisches Sprachdiplom C2 (ÖSD C2)',
      'Deutsche Sprachprüfung II des Sprachen- und Dolmetscher-Instituts München',
    ],
  },
  'OFFICIAL_LANGUAGE',
  'stuttgart-language-statute',
  CHECKED,
  {
    note:
      'This is the university-wide requirement for German-taught degree programmes. It must not be interpreted as evidence that every programme is German-taught; each programme language remains programme-specific.',
    noteAR:
      'هذا شرط الجامعة العام للبرامج التي تُدرَّس بالألمانية. لا يجوز اعتباره دليلاً على أن كل برنامج يُدرَّس بالألمانية؛ لغة كل برنامج تبقى معلومة خاصة بالبرنامج.',
  },
);

const SHARED_APPLICATION = fact(
  'university' as const,
  'OFFICIAL_PROCEDURE',
  'stuttgart-international-application',
  CHECKED,
  {
    note:
      'Applications are submitted online through the C@MPUS campus-management portal. The University of Stuttgart states that applications are free of application fees.',
    noteAR:
      'يتم التقديم إلكترونياً عبر بوابة C@MPUS، وتذكر جامعة شتوتغارت أن التقديم لا يفرض رسوم طلب.',
  },
);

const SHARED_DOCUMENTS = fact(
  [
    'University entrance qualification / school-leaving certificate',
    'Foreign documents must be accompanied by an officially certified German translation where required by the university rules',
    'Proof of the required language skills for German-taught programmes',
  ],
  'OFFICIAL_DOCUMENT_REQUIREMENT',
  'stuttgart-international-application',
  CHECKED,
  {
    noteAR:
      'شهادة تؤهل للجامعة، وترجمة ألمانية مصدقة رسمياً للوثائق الأجنبية عند طلبها، وإثبات اللغة المطلوبة للبرامج الألمانية.',
  },
);

const SHARED_FEES = fact(
  'International students who are not nationals of an EU/EEA member state are subject to tuition fees in Baden-Württemberg; the university also charges a semester contribution. Exact amounts are not recorded here because this category record does not use a current programme-specific fee source.',
  'OFFICIAL_PROCEDURE',
  'stuttgart-international-application',
  CHECKED,
  {
    noteAR:
      'الطلاب الدوليون غير مواطني EU/EEA يخضعون للرسوم الدراسية في بادن-فورتمبيرغ، إضافة إلى مساهمة الفصل. لم تُسجَّل مبالغ محددة هنا لعدم وجود مصدر حالي خاص بالبرنامج ضمن هذا السجل.',
  },
);

function makeProgram(
  base: Omit<ProgramIntel, 'teachingLanguage' | 'applicationChannel' | 'foreignQualification' | 'documents' | 'fees'>,
): ProgramIntel {
  return {
    ...base,
    teachingLanguage: unverified(
      'OFFICIAL_LANGUAGE',
      'The exact teaching language was not verified on the programme-specific page checked for this record. Do not infer it from the programme name.',
      'لم يتم التحقق من لغة التدريس الدقيقة من صفحة البرنامج المفحوصة. لا تستنتجها من اسم التخصص.',
    ),
    applicationChannel: SHARED_APPLICATION,
    foreignQualification: SHARED_FOREIGN_QUALIFICATION,
    documents: SHARED_DOCUMENTS,
    fees: SHARED_FEES,
  };
}

export const ENGINEERING_TECHNOLOGY_INTEL: MajorIntel = {
  id: 'engineering-technology',
  canonicalEN: 'Engineering & Technology',
  canonicalAR: 'الهندسة والتكنولوجيا',
  nameDE: 'Ingenieurwissenschaften und Technologie',
  degreeLevel: 'bachelor',
  aliases: {
    ar: ['هندسة', 'الهندسة والتكنولوجيا', 'تخصصات الهندسة'],
    he: ['הנדסה', 'הנדסה וטכנולוגיה'],
    en: ['Engineering', 'Engineering & Technology', 'Engineering Sciences'],
    de: ['Ingenieurwissenschaften', 'Ingenieurwesen', 'Technik'],
  },
  status: 'verified',
  lastVerified: '2026-09',
  bagrutAccess: fact(
    { mathUnits: 3, englishUnits: 4, furtherUnits: 4 },
    'OFFICIAL_REQUIREMENT',
    'daad-israel-bagrut',
    CHECKED,
    { note: BAGRUT_EN, noteAR: BAGRUT_AR },
  ),
  gradeConversion: fact(
    'The KMK uses the modified Bavarian formula for converting foreign higher-education entrance grades. The converted result is a grade-conversion value, not an admission decision.',
    'OFFICIAL_PROCEDURE',
    'kmk-grade-conversion',
    CHECKED,
    {
      noteAR:
        'تستخدم KMK صيغة بافاريا المعدلة لتحويل درجات شهادات التأهل الأجنبية للجامعة. النتيجة قيمة تحويل وليست قرار قبول.',
    },
  ),
  language: SHARED_LANGUAGE,
  programs: [
    makeProgram({
      id: 'stuttgart-maschinenbau-bsc',
      universityName: 'Universität Stuttgart',
      universityNameAR: 'جامعة شتوتغارت',
      city: 'Stuttgart',
      cityAR: 'شتوتغارت',
      programName: 'Mechanical Engineering (B.Sc.)',
      programNameDE: 'Maschinenbau (B.Sc.)',
      programNameAR: 'الهندسة الميكانيكية (بكالوريوس)',
      degreeLevel: 'bachelor',
      admissionMode: fact('open', 'OFFICIAL_ADMISSION_MODE', 'stuttgart-mechanical', CHECKED, {
        note: 'Maschinenbau B.Sc. is not admission-restricted (nicht zulassungsbeschränkt).',
        noteAR: 'بكالوريوس الهندسة الميكانيكية غير مقيّد القبول (بدون NC).',
      }),
      subjectRequirements: unverified(
        'OFFICIAL_REQUIREMENT',
        'No programme-specific Israeli Bagrut subject/unit requirement was verified on the checked programme page. Do not add a mathematics or physics unit threshold.',
        'لم يتم التحقق من شرط وحدات/مواد بجروت خاص بالبرنامج في صفحة البرنامج المفحوصة. لا تضف حداً لوحدات الرياضيات أو الفيزياء.',
      ),
      languageRequirement: SHARED_LANGUAGE,
      gradeRequirement: unverified(
        'OFFICIAL_REQUIREMENT',
        'No programme-specific converted-grade threshold was verified on the checked page.',
        'لم يتم التحقق من حد معدل محوَّل خاص بالبرنامج في الصفحة المفحوصة.',
      ),
      entranceRequirement: unverified(
        'OFFICIAL_PROCEDURE',
        'No programme-specific entrance/aptitude test was verified on the checked page.',
        'لم يتم التحقق من اختبار قبول/أهلية خاص بالبرنامج في الصفحة المفحوصة.',
      ),
      deadline: fact(
        { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '15 May – 15 September' },
        'OFFICIAL_DEADLINE',
        'stuttgart-mechanical',
        CHECKED,
        {
          note: 'The programme page lists 15 May–15 September for the winter-semester application period.',
          noteAR: 'صفحة البرنامج تذكر الفترة من 15 أيار إلى 15 أيلول للتقديم للفصل الشتوي.',
        },
      ),
      programUrl: 'https://www.uni-stuttgart.de/studium/bachelor/maschinenbau-b.sc./bewerbung/',
      lastVerified: CHECKED,
    }),
    makeProgram({
      id: 'stuttgart-electrical-information-technology-bsc',
      universityName: 'Universität Stuttgart',
      universityNameAR: 'جامعة شتوتغارت',
      city: 'Stuttgart',
      cityAR: 'شتوتغارت',
      programName: 'Electrical Engineering and Information Technology (B.Sc.)',
      programNameDE: 'Elektrotechnik und Informationstechnik (B.Sc.)',
      programNameAR: 'الهندسة الكهربائية وتقنية المعلومات (بكالوريوس)',
      degreeLevel: 'bachelor',
      admissionMode: fact('open', 'OFFICIAL_ADMISSION_MODE', 'stuttgart-electrical', CHECKED, {
        note: 'Elektrotechnik und Informationstechnik B.Sc. is not admission-restricted.',
        noteAR: 'بكالوريوس الهندسة الكهربائية وتقنية المعلومات غير مقيّد القبول.',
      }),
      subjectRequirements: unverified(
        'OFFICIAL_REQUIREMENT',
        'No programme-specific Israeli Bagrut subject/unit requirement was verified on the checked programme page.',
        'لم يتم التحقق من شرط مواد/وحدات بجروت خاص بالبرنامج في صفحة البرنامج المفحوصة.',
      ),
      languageRequirement: SHARED_LANGUAGE,
      gradeRequirement: unverified(
        'OFFICIAL_REQUIREMENT',
        'No programme-specific converted-grade threshold was verified on the checked page.',
        'لم يتم التحقق من حد معدل محوَّل خاص بالبرنامج في الصفحة المفحوصة.',
      ),
      entranceRequirement: unverified(
        'OFFICIAL_PROCEDURE',
        'No programme-specific entrance/aptitude test was verified on the checked page.',
        'لم يتم التحقق من اختبار قبول/أهلية خاص بالبرنامج في الصفحة المفحوصة.',
      ),
      deadline: fact(
        { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '15 May – 15 September' },
        'OFFICIAL_DEADLINE',
        'stuttgart-electrical',
        CHECKED,
        {
          note: 'The programme page lists 15 May–15 September for the winter-semester application period.',
          noteAR: 'صفحة البرنامج تذكر الفترة من 15 أيار إلى 15 أيلول للتقديم للفصل الشتوي.',
        },
      ),
      programUrl:
        'https://www.uni-stuttgart.de/studium/bachelor/elektrotechnik-und-informationstechnik-b.sc./bewerbung/',
      lastVerified: CHECKED,
    }),
    makeProgram({
      id: 'stuttgart-bauingenieurwesen-bsc',
      universityName: 'Universität Stuttgart',
      universityNameAR: 'جامعة شتوتغارت',
      city: 'Stuttgart',
      cityAR: 'شتوتغارت',
      programName: 'Civil Engineering (B.Sc.)',
      programNameDE: 'Bauingenieurwesen (B.Sc.)',
      programNameAR: 'الهندسة المدنية (بكالوريوس)',
      degreeLevel: 'bachelor',
      admissionMode: fact('open', 'OFFICIAL_ADMISSION_MODE', 'stuttgart-civil', CHECKED, {
        note: 'Bauingenieurwesen B.Sc. is not admission-restricted.',
        noteAR: 'بكالوريوس الهندسة المدنية غير مقيّد القبول.',
      }),
      subjectRequirements: unverified(
        'OFFICIAL_REQUIREMENT',
        'No programme-specific Israeli Bagrut subject/unit requirement was verified on the checked programme page. The six-week construction-site internship is recorded separately as a programme requirement.',
        'لم يتم التحقق من شرط مواد/وحدات بجروت خاص بالبرنامج في صفحة البرنامج المفحوصة. تم تسجيل التدريب العملي لمدة ستة أسابيع بشكل منفصل كشرط للبرنامج.',
      ),
      languageRequirement: SHARED_LANGUAGE,
      gradeRequirement: unverified(
        'OFFICIAL_REQUIREMENT',
        'No programme-specific converted-grade threshold was verified on the checked page.',
        'لم يتم التحقق من حد معدل محوَّل خاص بالبرنامج في الصفحة المفحوصة.',
      ),
      entranceRequirement: fact(
        'At least six weeks of practical training on a construction site (Baustellenpraktikum) is required. This is a programme prerequisite, not an entrance examination.',
        'OFFICIAL_REQUIREMENT',
        'stuttgart-civil',
        CHECKED,
        { noteAR: 'يُطلب تدريب عملي في موقع بناء لمدة لا تقل عن ستة أسابيع. هذا شرط للبرنامج وليس امتحان قبول.' },
      ),
      deadline: fact(
        { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '15 May – 15 September' },
        'OFFICIAL_DEADLINE',
        'stuttgart-civil',
        CHECKED,
        {
          note: 'The programme page lists 15 May–15 September for the winter-semester application period.',
          noteAR: 'صفحة البرنامج تذكر الفترة من 15 أيار إلى 15 أيلول للتقديم للفصل الشتوي.',
        },
      ),
      programUrl: 'https://www.uni-stuttgart.de/studium/bachelor/bauingenieurwesen-b.sc./bewerbung/',
      lastVerified: CHECKED,
    }),
    makeProgram({
      id: 'stuttgart-umweltschutztechnik-bsc',
      universityName: 'Universität Stuttgart',
      universityNameAR: 'جامعة شتوتغارت',
      city: 'Stuttgart',
      cityAR: 'شتوتغارت',
      programName: 'Environmental Protection Technology (B.Sc.)',
      programNameDE: 'Umweltschutztechnik (B.Sc.)',
      programNameAR: 'هندسة حماية البيئة (بكالوريوس)',
      degreeLevel: 'bachelor',
      admissionMode: fact('open', 'OFFICIAL_ADMISSION_MODE', 'stuttgart-environmental', CHECKED, {
        note: 'Umweltschutztechnik B.Sc. is not admission-restricted.',
        noteAR: 'بكالوريوس هندسة حماية البيئة غير مقيّد القبول.',
      }),
      subjectRequirements: unverified(
        'OFFICIAL_REQUIREMENT',
        'No programme-specific Israeli Bagrut subject/unit requirement was verified on the checked programme page.',
        'لم يتم التحقق من شرط مواد/وحدات بجروت خاص بالبرنامج في صفحة البرنامج المفحوصة.',
      ),
      languageRequirement: SHARED_LANGUAGE,
      gradeRequirement: unverified(
        'OFFICIAL_REQUIREMENT',
        'No programme-specific converted-grade threshold was verified on the checked page.',
        'لم يتم التحقق من حد معدل محوَّل خاص بالبرنامج في الصفحة المفحوصة.',
      ),
      entranceRequirement: unverified(
        'OFFICIAL_PROCEDURE',
        'No programme-specific entrance/aptitude test was verified on the checked page.',
        'لم يتم التحقق من اختبار قبول/أهلية خاص بالبرنامج في الصفحة المفحوصة.',
      ),
      deadline: fact(
        { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '15 May – 15 September' },
        'OFFICIAL_DEADLINE',
        'stuttgart-environmental',
        CHECKED,
        {
          note: 'The programme page lists 15 May–15 September for the winter-semester application period.',
          noteAR: 'صفحة البرنامج تذكر الفترة من 15 أيار إلى 15 أيلول للتقديم للفصل الشتوي.',
        },
      ),
      programUrl:
        'https://www.uni-stuttgart.de/studium/bachelor/umweltschutztechnik-b.sc./bewerbung/',
      lastVerified: CHECKED,
    }),
    makeProgram({
      id: 'stuttgart-materialwissenschaft-bsc',
      universityName: 'Universität Stuttgart',
      universityNameAR: 'جامعة شتوتغارت',
      city: 'Stuttgart',
      cityAR: 'شتوتغارت',
      programName: 'Materials Science (B.Sc.)',
      programNameDE: 'Materialwissenschaft (B.Sc.)',
      programNameAR: 'علم وهندسة المواد (بكالوريوس)',
      degreeLevel: 'bachelor',
      admissionMode: fact('open', 'OFFICIAL_ADMISSION_MODE', 'stuttgart-materials', CHECKED, {
        note: 'Materialwissenschaft B.Sc. is not admission-restricted.',
        noteAR: 'بكالوريوس علم وهندسة المواد غير مقيّد القبول.',
      }),
      subjectRequirements: unverified(
        'OFFICIAL_REQUIREMENT',
        'No programme-specific Israeli Bagrut subject/unit requirement was verified on the checked programme page.',
        'لم يتم التحقق من شرط مواد/وحدات بجروت خاص بالبرنامج في صفحة البرنامج المفحوصة.',
      ),
      languageRequirement: SHARED_LANGUAGE,
      gradeRequirement: unverified(
        'OFFICIAL_REQUIREMENT',
        'No programme-specific converted-grade threshold was verified on the checked page.',
        'لم يتم التحقق من حد معدل محوَّل خاص بالبرنامج في الصفحة المفحوصة.',
      ),
      entranceRequirement: unverified(
        'OFFICIAL_PROCEDURE',
        'No programme-specific entrance/aptitude test was verified on the checked page.',
        'لم يتم التحقق من اختبار قبول/أهلية خاص بالبرنامج في الصفحة المفحوصة.',
      ),
      deadline: fact(
        { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '15 May – 15 September' },
        'OFFICIAL_DEADLINE',
        'stuttgart-materials',
        CHECKED,
        {
          note: 'The programme page lists 15 May–15 September for the winter-semester application period.',
          noteAR: 'صفحة البرنامج تذكر الفترة من 15 أيار إلى 15 أيلول للتقديم للفصل الشتوي.',
        },
      ),
      programUrl:
        'https://www.uni-stuttgart.de/studium/bachelor/materialwissenschaft-b.sc./bewerbung/',
      lastVerified: CHECKED,
    }),
  ],
  sources: SOURCES,
};


function makeVerifiedEngineeringMajor(
  id: string,
  canonicalEN: string,
  canonicalAR: string,
  nameDE: string,
  program: ProgramIntel,
  aliases: { ar: string[]; he: string[]; en: string[]; de: string[] },
): MajorIntel {
  return {
    id,
    canonicalEN,
    canonicalAR,
    nameDE,
    degreeLevel: 'bachelor',
    aliases,
    status: 'verified',
    lastVerified: '2026-09',
    bagrutAccess: fact(
      { mathUnits: 3, englishUnits: 4, furtherUnits: 4 },
      'OFFICIAL_REQUIREMENT',
      'daad-israel-bagrut',
      CHECKED,
      { note: BAGRUT_EN, noteAR: BAGRUT_AR },
    ),
    gradeConversion: fact(
      'The KMK uses the modified Bavarian formula for converting foreign higher-education entrance grades. The converted result is a grade-conversion value, not an admission decision.',
      'OFFICIAL_PROCEDURE',
      'kmk-grade-conversion',
      CHECKED,
      { noteAR: 'تستخدم KMK صيغة بافاريا المعدلة لتحويل درجات شهادات التأهل الأجنبية للجامعة. النتيجة قيمة تحويل وليست قرار قبول.' },
    ),
    language: SHARED_LANGUAGE,
    programs: [program],
    sources: SOURCES,
  };
}

const ENGINEERING_PROGRAMS = ENGINEERING_TECHNOLOGY_INTEL.programs;

export const ENGINEERING_TECHNOLOGY_MAJORS: MajorIntel[] = [
  makeVerifiedEngineeringMajor(
    'mechanical-engineering',
    'Mechanical Engineering',
    'الهندسة الميكانيكية',
    'Maschinenbau',
    ENGINEERING_PROGRAMS.find((p) => p.id === 'stuttgart-maschinenbau-bsc')!,
    {
      ar: ['الهندسة الميكانيكية', 'هندسة ميكانيكية', 'ميكانيك'],
      he: ['הנדסת מכונות', 'הנדסה מכנית'],
      en: ['Mechanical Engineering', 'Mechanical Engineering BSc'],
      de: ['Maschinenbau'],
    },
  ),
  makeVerifiedEngineeringMajor(
    'electrical-engineering-information-technology',
    'Electrical Engineering and Information Technology',
    'الهندسة الكهربائية وتقنية المعلومات',
    'Elektrotechnik und Informationstechnik',
    ENGINEERING_PROGRAMS.find((p) => p.id === 'stuttgart-electrical-information-technology-bsc')!,
    {
      ar: ['الهندسة الكهربائية', 'الهندسة الكهربائية وتقنية المعلومات', 'هندسة كهرباء'],
      he: ['הנדסת חשמל', 'הנדסת חשמל ומידע'],
      en: ['Electrical Engineering', 'Electrical Engineering and Information Technology', 'EEIT'],
      de: ['Elektrotechnik', 'Elektrotechnik und Informationstechnik'],
    },
  ),
  makeVerifiedEngineeringMajor(
    'civil-engineering',
    'Civil Engineering',
    'الهندسة المدنية',
    'Bauingenieurwesen',
    ENGINEERING_PROGRAMS.find((p) => p.id === 'stuttgart-bauingenieurwesen-bsc')!,
    {
      ar: ['الهندسة المدنية', 'هندسة مدنية', 'هندسة بناء'],
      he: ['הנדסה אזרחית', 'הנדסת בניין'],
      en: ['Civil Engineering', 'Civil Engineering BSc'],
      de: ['Bauingenieurwesen'],
    },
  ),
  makeVerifiedEngineeringMajor(
    'environmental-protection-engineering',
    'Environmental Protection Technology',
    'هندسة حماية البيئة',
    'Umweltschutztechnik',
    ENGINEERING_PROGRAMS.find((p) => p.id === 'stuttgart-umweltschutztechnik-bsc')!,
    {
      ar: ['هندسة حماية البيئة', 'الهندسة البيئية', 'هندسة البيئة'],
      he: ['הנדסת סביבה', 'הנדסת הגנת הסביבה'],
      en: ['Environmental Engineering', 'Environmental Protection Technology', 'Environmental Protection'],
      de: ['Umweltschutztechnik'],
    },
  ),
  makeVerifiedEngineeringMajor(
    'materials-science',
    'Materials Science',
    'علم وهندسة المواد',
    'Materialwissenschaft',
    ENGINEERING_PROGRAMS.find((p) => p.id === 'stuttgart-materialwissenschaft-bsc')!,
    {
      ar: ['علم المواد', 'هندسة المواد', 'علم وهندسة المواد'],
      he: ['מדע החומרים', 'הנדסת חומרים'],
      en: ['Materials Science', 'Materials Engineering', 'Materials Science and Engineering'],
      de: ['Materialwissenschaft'],
    },
  ),
];
