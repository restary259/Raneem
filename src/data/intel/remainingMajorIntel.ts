/**
 * DARB Major Intelligence — remaining public-major coverage.
 *
 * Computer Science is the canonical structure: every entry has bilingual
 * canonical names/aliases, verified Bagrut access, the official grade-conversion
 * procedure, one concrete university/programme reference, and explicit
 * unverified states instead of invented requirements.
 */
import type { IntelSource } from './factTypes';
import { fact, unverified } from './factTypes';
import type { MajorIntel, ProgramIntel, LanguageRequirementValue } from './types';
import { majorsData } from '@/data/majorsData';

const CHECKED = '2026-09-19';

const SRC_ANABIN: IntelSource = {
  id: 'anabin-isr',
  url: 'https://anabin.kmk.org/db/schulabschluesse-mit-hochschulzugang',
  title: "anabin (KMK/ZAB) — Israel, Te'udat bagrut (record ISR-BV01)",
  titleAR: 'anabin (KMK/ZAB) — إسرائيل، تعودات بجروت (السجل ISR-BV01)',
  authority: 'anabin',
  checkedAt: CHECKED,
};
const SRC_KMK: IntelSource = {
  id: 'kmk-grade-conversion',
  url: 'https://www.kmk.org/fileadmin/Dateien/pdf/ZAB/Hochschulzugang_Beschluesse_der_KMK/GesNot05.pdf',
  title: 'KMK — Gesamtnote bei ausländischen Hochschulzugangszeugnissen',
  titleAR: 'KMK — تحديد المعدل العام للشهادات الأجنبية',
  authority: 'kmk',
  checkedAt: CHECKED,
};
const SRC_RO_DT: IntelSource = {
  id: 'kmk-ro-dt',
  url: 'https://www.kmk.org/fileadmin/Dateien/veroeffentlichungen_beschluesse/2004/2004_06_25-RO_DT.pdf',
  title: 'KMK/HRK — Rahmenordnung für deutsche Sprachprüfungen',
  titleAR: 'KMK/HRK — الإطار التنظيمي لامتحانات اللغة الألمانية',
  authority: 'kmk',
  checkedAt: CHECKED,
};

const BAGRUT_EN = "Israeli Te'udat bagrut is listed in anabin as direct university access for all subjects when it includes Mathematics 3 units, English 4 units and one further subject at 4 units.";
const BAGRUT_AR = 'تعودات بجروت مُدرجة في anabin كقبول جامعي مباشر لجميع التخصصات إذا تضمّنت رياضيات 3 وحدات، إنجليزية 4 وحدات ومادة إضافية 4 وحدات.';
const GRADE_EN = 'German grade = 1 + 3 × (Nmax − N) / (Nmax − Nmin). The formula is a conversion procedure, not an admission decision.';
const GRADE_AR = 'الدرجة الألمانية = 1 + 3 × (Nmax − N) / (Nmax − Nmin). الصيغة إجراء لتحويل المعدل وليست قرار قبول.';
const GERMAN_C1_CERTS = ['DSH-2', 'TestDaF 4×4', 'telc C1 Hochschule', 'Goethe-Zertifikat C2', 'DSD II'];

type Route = {
  id: string;
  universityName: string;
  universityNameAR: string;
  city: string;
  cityAR: string;
  programName: string;
  programNameDE: string;
  programNameAR: string;
  url: string;
  title: string;
  titleAR: string;
  language?: LanguageRequirementValue | null;
  admission?: 'open' | 'nc' | 'aptitude_test' | 'selection_procedure' | 'unknown';
  channel?: 'university' | 'uni_assist' | 'hochschulstart' | 'other';
  deadline?: { semester: string; semesterAR: string; deadline: string };
  entrance?: string;
  entranceAR?: string;
  note?: string;
  noteAR?: string;
};

function sourceFor(r: Route): IntelSource {
  return {
    id: r.id,
    url: r.url,
    title: r.title,
    titleAR: r.titleAR,
    authority: 'university',
    checkedAt: CHECKED,
  };
}

function makeProgram(r: Route): ProgramIntel {
  const language = r.language
    ? fact(r.language, 'OFFICIAL_LANGUAGE', r.id, CHECKED, { note: r.note, noteAR: r.noteAR })
    : unverified(
        'OFFICIAL_LANGUAGE',
        'The named route is recorded, but its programme-specific minimum language level was not verified in this pass.',
        'تم تسجيل المسار المحدد، لكن لم يتم التحقق من الحد الأدنى للغة الخاص بالبرنامج في هذا المرور.',
      );
  return {
    id: r.id,
    universityName: r.universityName,
    universityNameAR: r.universityNameAR,
    city: r.city,
    cityAR: r.cityAR,
    programName: r.programName,
    programNameDE: r.programNameDE,
    programNameAR: r.programNameAR,
    degreeLevel: r.programName.includes('Staatsexamen') ? 'staatsexamen' : 'bachelor',
    teachingLanguage: fact(
      [r.language?.language === 'English' ? 'English' : 'German'],
      'OFFICIAL_LANGUAGE',
      r.id,
      CHECKED,
      { note: 'Teaching language follows the named university route.', noteAR: 'لغة التدريس مأخوذة من مسار الجامعة المحدد.' },
    ),
    admissionMode: r.admission
      ? fact(r.admission, 'OFFICIAL_ADMISSION_MODE', r.id, CHECKED)
      : unverified(
          'OFFICIAL_ADMISSION_MODE',
          'Admission mode was not locked from the named programme source; re-check the current intake page.',
          'لم يتم تثبيت نمط القبول من مصدر البرنامج؛ أعد التحقق من صفحة الدفعة الحالية.',
        ),
    applicationChannel: r.channel
      ? fact(r.channel, 'OFFICIAL_PROCEDURE', r.id, CHECKED)
      : unverified(
          'OFFICIAL_PROCEDURE',
          'Application channel was not independently locked from the named programme source.',
          'قناة التقديم لم يتم تثبيتها بشكل مستقل من مصدر البرنامج.',
        ),
    foreignQualification: fact(BAGRUT_EN, 'OFFICIAL_REQUIREMENT', SRC_ANABIN.id, CHECKED, { noteAR: BAGRUT_AR }),
    subjectRequirements: unverified(
      'OFFICIAL_REQUIREMENT',
      'No additional Israeli Bagrut subject/unit threshold was verified beyond the anabin access rule.',
      'لم يتم التحقق من أي شرط إضافي لمواد أو وحدات البجروت يتجاوز قاعدة anabin.',
    ),
    languageRequirement: language,
    gradeRequirement: unverified(
      'OFFICIAL_REQUIREMENT',
      'No fixed converted-grade threshold is asserted unless the named programme explicitly publishes one.',
      'لا يتم تثبيت حد للمعدل المحوّل إلا إذا نشره البرنامج المحدد صراحةً.',
    ),
    entranceRequirement: r.entrance
      ? fact(r.entrance, 'OFFICIAL_PROCEDURE', r.id, CHECKED, { noteAR: r.entranceAR })
      : unverified(
          'OFFICIAL_PROCEDURE',
          'No separate programme-specific aptitude/interview requirement was locked in this pass.',
          'لم يتم تثبيت شرط اختبار أهلية أو مقابلة خاص بالبرنامج في هذا المرور.',
        ),
    deadline: r.deadline
      ? fact(r.deadline, 'OFFICIAL_DEADLINE', r.id, CHECKED)
      : unverified(
          'OFFICIAL_DEADLINE',
          'Read the current intake deadline before giving the student a date.',
          'اقرأ موعد الدفعة الحالية قبل إعطاء الطالب تاريخاً.',
        ),
    documents: unverified(
      'OFFICIAL_DOCUMENT_REQUIREMENT',
      'Use the university application checklist for the current intake; the full list is not duplicated here.',
      'استخدم قائمة وثائق الجامعة للدفعة الحالية؛ لم تُكرر القائمة الكاملة هنا.',
    ),
    programUrl: r.url,
    lastVerified: CHECKED,
  };
}

function makeMajor(id: string, route: Route): MajorIntel {
  const row = majorsData.flatMap((c) => c.subMajors).find((m) => m.id === id);
  const en = row?.nameEN ?? id;
  const ar = row?.nameAR ?? id;
  const de = row?.nameDE ?? en;
  return {
    id,
    canonicalEN: en,
    canonicalAR: ar,
    nameDE: de,
    degreeLevel: route.programName.includes('Staatsexamen') ? 'staatsexamen' : 'bachelor',
    aliases: { ar: [ar], he: [], en: [en], de: [de] },
    status: 'verified',
    lastVerified: CHECKED,
    bagrutAccess: fact(
      { mathUnits: 3, englishUnits: 4, furtherUnits: 4 },
      'OFFICIAL_REQUIREMENT',
      SRC_ANABIN.id,
      CHECKED,
      { note: BAGRUT_EN, noteAR: BAGRUT_AR },
    ),
    gradeConversion: fact(GRADE_EN, 'OFFICIAL_PROCEDURE', SRC_KMK.id, CHECKED, { noteAR: GRADE_AR }),
    language: route.language
      ? fact(route.language, 'OFFICIAL_LANGUAGE', route.id, CHECKED, { note: route.note, noteAR: route.noteAR })
      : unverified(
          'OFFICIAL_LANGUAGE',
          'No single field-wide language rule is assumed; use the named programme route.',
          'لا نفترض شرط لغة موحداً للمجال؛ استخدم مسار البرنامج المحدد.',
        ),
    programs: [makeProgram(route)],
    sources: [SRC_ANABIN, SRC_KMK, SRC_RO_DT, sourceFor(route)],
  };
}

const R: Record<string, Route> = {
  // Health & Medical ---------------------------------------------------------
  'public-health': {
    id: 'bremen-public-health-ba',
    universityName: 'University of Bremen', universityNameAR: 'جامعة بريمن',
    city: 'Bremen', cityAR: 'بريمن',
    programName: 'Public Health (B.A.)', programNameDE: 'Public Health', programNameAR: 'الصحة العامة (بكالوريوس)',
    url: 'https://www.uni-bremen.de/fb11/studium/public-health-gesundheitswissenschaften-ba',
    title: 'University of Bremen — Public Health / Gesundheitswissenschaften B.A.',
    titleAR: 'جامعة بريمن — Public Health / العلوم الصحية B.A.',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS },
    admission: 'open', channel: 'university',
  },
  bioinformatics: {
    id: 'saarland-bioinformatics-bsc',
    universityName: 'Saarland University', universityNameAR: 'جامعة سارلاند',
    city: 'Saarbrücken', cityAR: 'ساربروكن',
    programName: 'Bioinformatics (B.Sc.)', programNameDE: 'Bioinformatik', programNameAR: 'المعلوماتية الحيوية (بكالوريوس)',
    url: 'https://www.uni-saarland.de/en/study/programmes/bachelor/bioinformatics.html',
    title: 'Saarland University — Bioinformatics B.Sc.', titleAR: 'جامعة سارلاند — بكالوريوس Bioinformatics',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS },
    admission: 'open', channel: 'university',
  },
  'biomedical-engineering': {
    id: 'fau-medical-engineering-bsc',
    universityName: 'Friedrich-Alexander-Universität Erlangen-Nürnberg (FAU)', universityNameAR: 'جامعة فريدريش ألكسندر إرلانغن-نورنبيرغ (FAU)',
    city: 'Erlangen', cityAR: 'إرلانغن',
    programName: 'Medical Engineering (B.Sc.)', programNameDE: 'Medizintechnik', programNameAR: 'الهندسة الطبية / Medizintechnik (بكالوريوس)',
    url: 'https://www.medizintechnik.studium.fau.de/studieninteressierte/zugang-bachelorstudium/',
    title: 'FAU — Zugang zum Bachelor Medizintechnik', titleAR: 'FAU — القبول في بكالوريوس Medizintechnik',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS },
    admission: 'open', channel: 'university',
  },
  pharmacy: {
    id: 'saarland-pharmacy-staatsexamen',
    universityName: 'Saarland University', universityNameAR: 'جامعة سارلاند',
    city: 'Saarbrücken', cityAR: 'ساربروكن',
    programName: 'Pharmacy (Staatsexamen)', programNameDE: 'Pharmazie', programNameAR: 'الصيدلة (امتحان الدولة)',
    url: 'https://www.uni-saarland.de/studium/bewerbung/studienplatzvergabe/hochschulstart/pharmazie-test.html',
    title: 'Saarland University — Pharmacy / Pharmazie', titleAR: 'جامعة سارلاند — الصيدلة / Pharmazie',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS },
    admission: 'nc', channel: 'hochschulstart',
  },
  dentistry: {
    id: 'leipzig-dentistry-staatsexamen',
    universityName: 'Leipzig University', universityNameAR: 'جامعة لايبزيغ',
    city: 'Leipzig', cityAR: 'لايبزيغ',
    programName: 'Dentistry (Staatsexamen)', programNameDE: 'Zahnmedizin', programNameAR: 'طب الأسنان (امتحان الدولة)',
    url: 'https://www.uni-leipzig.de/studium/studienangebot/studiengang/course/show/zahnmedizin-staatsexamen',
    title: 'Leipzig University — Zahnmedizin Staatsexamen', titleAR: 'جامعة لايبزيغ — طب الأسنان Staatsexamen',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS },
    admission: 'nc', channel: 'hochschulstart',
  },
  medicine: {
    id: 'goethe-frankfurt-medicine-staatsexamen',
    universityName: 'Goethe University Frankfurt', universityNameAR: 'جامعة غوته فرانكفورت',
    city: 'Frankfurt am Main', cityAR: 'فرانكفورت',
    programName: 'Medicine (Staatsexamen)', programNameDE: 'Medizin', programNameAR: 'الطب (امتحان الدولة)',
    url: 'https://www.uni-frankfurt.de/35791076/Medizin__Staatsexamen',
    title: 'Goethe University Frankfurt — Medicine Staatsexamen', titleAR: 'جامعة غوته فرانكفورت — الطب Staatsexamen',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS },
    admission: 'nc', channel: 'hochschulstart',
  },
  physiotherapy: {
    id: 'hs-fulda-physiotherapy-bsc',
    universityName: 'Hochschule Fulda', universityNameAR: 'جامعة فولدا للعلوم التطبيقية',
    city: 'Fulda', cityAR: 'فولدا',
    programName: 'Physiotherapy (B.Sc.)', programNameDE: 'Physiotherapie', programNameAR: 'العلاج الطبيعي (بكالوريوس)',
    url: 'https://www.hs-fulda.de/studiengang/physiotherapie-bsc',
    title: 'Hochschule Fulda — Physiotherapy B.Sc.', titleAR: 'جامعة فولدا — بكالوريوس العلاج الطبيعي',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS },
    admission: 'open', channel: 'university',
  },
  veterinary: {
    id: 'lmu-veterinary-staatsexamen',
    universityName: 'LMU Munich', universityNameAR: 'جامعة LMU ميونخ',
    city: 'Munich', cityAR: 'ميونخ',
    programName: 'Veterinary Medicine (Staatsexamen)', programNameDE: 'Tiermedizin', programNameAR: 'الطب البيطري (امتحان الدولة)',
    url: 'https://www.vetmed.lmu.de/studiendekanat/de/studium/studieninteressierte/zulassung/',
    title: 'LMU Munich — Veterinary Medicine admission', titleAR: 'جامعة LMU ميونخ — قبول الطب البيطري',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS },
    admission: 'nc', channel: 'hochschulstart',
  },
  nursing: {
    id: 'cologne-clinical-nursing-bsc',
    universityName: 'University of Cologne', universityNameAR: 'جامعة كولونيا',
    city: 'Cologne', cityAR: 'كولونيا',
    programName: 'Clinical Nursing (B.Sc.)', programNameDE: 'Klinische Pflege', programNameAR: 'التمريض السريري (بكالوريوس)',
    url: 'https://pflegewissenschaft.uni-koeln.de/studium-lehre/bachelorstudiengang-klinische-pflege',
    title: 'University of Cologne — Clinical Nursing B.Sc.', titleAR: 'جامعة كولونيا — بكالوريوس التمريض السريري',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS },
    admission: 'selection_procedure', channel: 'university',
  },

  // Engineering & Technology ------------------------------------------------
  'computer-engineering': {
    id: 'tu-berlin-computer-engineering-bsc', universityName: 'TU Berlin', universityNameAR: 'جامعة برلين التقنية',
    city: 'Berlin', cityAR: 'برلين', programName: 'Computer Engineering (B.Sc.)', programNameDE: 'Computer Engineering',
    programNameAR: 'هندسة الكمبيوتر (بكالوريوس)',
    url: 'https://www.tu.berlin/en/studying/study-programs/all-programs-offered/study-course/computer-engineering-b-sc',
    title: 'TU Berlin — Computer Engineering B.Sc.', titleAR: 'جامعة برلين التقنية — بكالوريوس هندسة الكمبيوتر',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, channel: 'university',
  },
  'aerospace-engineering': {
    id: 'stuttgart-aerospace-bsc', universityName: 'University of Stuttgart', universityNameAR: 'جامعة شتوتغارت',
    city: 'Stuttgart', cityAR: 'شتوتغارت', programName: 'Aerospace Engineering (B.Sc.)', programNameDE: 'Luft- und Raumfahrttechnik',
    programNameAR: 'هندسة الطيران والفضاء (بكالوريوس)',
    url: 'https://www.uni-stuttgart.de/studium/bachelor/luft-und-raumfahrttechnik-b.sc./',
    title: 'University of Stuttgart — Luft- und Raumfahrttechnik B.Sc.', titleAR: 'جامعة شتوتغارت — بكالوريوس Luft- und Raumfahrttechnik',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'university',
    deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '15.07.' },
    entrance: 'A six-week pre-study internship is required.', entranceAR: 'يُطلب تدريب عملي تمهيدي لمدة 6 أسابيع قبل التسجيل.',
  },
  'renewable-energy': {
    id: 'stuttgart-renewable-energy-bsc', universityName: 'University of Stuttgart', universityNameAR: 'جامعة شتوتغارت',
    city: 'Stuttgart', cityAR: 'شتوتغارت', programName: 'Renewable Energy Engineering (B.Sc.)', programNameDE: 'Erneuerbare Energien',
    programNameAR: 'هندسة الطاقة المتجددة (بكالوريوس)',
    url: 'https://www.uni-stuttgart.de/studium/bachelor/erneuerbare-energien-b.sc./',
    title: 'University of Stuttgart — Erneuerbare Energien B.Sc.', titleAR: 'جامعة شتوتغارت — بكالوريوس الطاقة المتجددة',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, channel: 'university',
  },
  'software-engineering': {
    id: 'stuttgart-software-engineering-bsc', universityName: 'University of Stuttgart', universityNameAR: 'جامعة شتوتغارت',
    city: 'Stuttgart', cityAR: 'شتوتغارت', programName: 'Software Engineering (B.Sc.)', programNameDE: 'Software Engineering',
    programNameAR: 'هندسة البرمجيات (بكالوريوس)',
    url: 'https://www.uni-stuttgart.de/en/study/bachelor-programs/software-engineering-b.sc./',
    title: 'University of Stuttgart — Software Engineering B.Sc.', titleAR: 'جامعة شتوتغارت — بكالوريوس Software Engineering',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS, additionalLanguage: { language: 'English', minimumLevel: 'B2', certificates: ['English B2'] } },
    admission: 'nc', channel: 'university', deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '15.07.' },
    note: 'German is the teaching language and the programme additionally requires English B2.', noteAR: 'الألمانية لغة التدريس والبرنامج يطلب إضافةً إلى ذلك الإنجليزية B2.',
  },
  'industrial-engineering': {
    id: 'kit-industrial-engineering-bsc', universityName: 'Karlsruhe Institute of Technology (KIT)', universityNameAR: 'معهد كارلسروه للتقنية (KIT)',
    city: 'Karlsruhe', cityAR: 'كارلسروه', programName: 'Industrial Engineering (B.Sc.)', programNameDE: 'Wirtschaftsingenieurwesen',
    programNameAR: 'الهندسة الصناعية / Wirtschaftsingenieurwesen (بكالوريوس)',
    url: 'https://www.sle.kit.edu/vorstudium/bachelor-wirtschaftsingenieurwesen.php',
    title: 'KIT — Bachelor Wirtschaftsingenieurwesen', titleAR: 'KIT — بكالوريوس Wirtschaftsingenieurwesen',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, channel: 'university',
  },
  'space-engineering': {
    id: 'stuttgart-space-route-bsc', universityName: 'University of Stuttgart', universityNameAR: 'جامعة شتوتغارت',
    city: 'Stuttgart', cityAR: 'شتوتغارت', programName: 'Aerospace Engineering (B.Sc.) — space-engineering route',
    programNameDE: 'Luft- und Raumfahrttechnik', programNameAR: 'هندسة الطيران والفضاء (بكالوريوس) — مسار هندسة الفضاء',
    url: 'https://www.uni-stuttgart.de/studium/bachelor/luft-und-raumfahrttechnik-b.sc./',
    title: 'University of Stuttgart — Luft- und Raumfahrttechnik B.Sc.', titleAR: 'جامعة شتوتغارت — بكالوريوس هندسة الطيران والفضاء',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'university',
    note: 'Mapped route: the public bachelor is Luft- und Raumfahrttechnik; this record does not assert a separate Stuttgart bachelor titled Space Engineering.',
    noteAR: 'مسار مطابق: البكالوريوس العام هو Luft- und Raumfahrttechnik؛ لا نثبت وجود بكالوريوس مستقل باسم Space Engineering في شتوتغارت.',
  },
  'chemical-engineering': {
    id: 'tu-dortmund-chemical-engineering-bsc', universityName: 'TU Dortmund University', universityNameAR: 'جامعة TU دورتموند',
    city: 'Dortmund', cityAR: 'دورتموند', programName: 'Chemical Engineering (B.Sc.)', programNameDE: 'Chemieingenieurwesen',
    programNameAR: 'الهندسة الكيميائية (بكالوريوس)',
    url: 'https://www.tu-dortmund.de/en/study-program-details/chemical-engineering-659/',
    title: 'TU Dortmund — Chemical Engineering', titleAR: 'جامعة TU دورتموند — الهندسة الكيميائية',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, channel: 'university',
  },
  'environmental-engineering': {
    id: 'tum-environmental-engineering-bsc', universityName: 'Technical University of Munich (TUM)', universityNameAR: 'الجامعة التقنية في ميونخ (TUM)',
    city: 'Munich', cityAR: 'ميونخ', programName: 'Environmental Engineering (B.Sc.)', programNameDE: 'Umweltingenieurwesen',
    programNameAR: 'الهندسة البيئية (بكالوريوس)',
    url: 'https://www.tum.de/studium/studienangebot/detail/umweltingenieurwesen-bachelor-of-science-bsc',
    title: 'TUM — Umweltingenieurwesen B.Sc.', titleAR: 'TUM — بكالوريوس الهندسة البيئية',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, channel: 'university',
    deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '15.07.' },
  },
  'electrical-it': {
    id: 'kit-electrical-it-bsc', universityName: 'Karlsruhe Institute of Technology (KIT)', universityNameAR: 'معهد كارلسروه للتقنية (KIT)',
    city: 'Karlsruhe', cityAR: 'كارلسروه', programName: 'Electrical Engineering and Information Technology (B.Sc.)',
    programNameDE: 'Elektrotechnik und Informationstechnik', programNameAR: 'الهندسة الكهربائية وتقنية المعلومات (بكالوريوس)',
    url: 'https://www.sle.kit.edu/vorstudium/bachelor-elektrotechnik-informationstechnik.php',
    title: 'KIT — Elektrotechnik und Informationstechnik B.Sc.', titleAR: 'KIT — بكالوريوس الهندسة الكهربائية وتقنية المعلومات',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, channel: 'university',
  },
  'electrical-engineering': {
    id: 'kit-electrical-engineering-route-bsc', universityName: 'Karlsruhe Institute of Technology (KIT)', universityNameAR: 'معهد كارلسروه للتقنية (KIT)',
    city: 'Karlsruhe', cityAR: 'كارلسروه', programName: 'Electrical Engineering and Information Technology (B.Sc.) — electrical-engineering route',
    programNameDE: 'Elektrotechnik und Informationstechnik', programNameAR: 'الهندسة الكهربائية (بكالوريوس) — المسار الجامعي المطابق هو Elektrotechnik und Informationstechnik',
    url: 'https://www.sle.kit.edu/vorstudium/bachelor-elektrotechnik-informationstechnik.php',
    title: 'KIT — Elektrotechnik und Informationstechnik B.Sc.', titleAR: 'KIT — بكالوريوس Elektrotechnik und Informationstechnik',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, channel: 'university',
    note: 'Mapped route: this public programme combines electrical engineering and information technology instead of using a separate bachelor title.',
    noteAR: 'مسار مطابق: البرنامج العام يجمع الهندسة الكهربائية وتقنية المعلومات ولا يستخدم عنوان بكالوريوس مستقلاً.',
  },

  // Natural sciences --------------------------------------------------------
  'environmental-science': {
    id: 'freiburg-environmental-natural-sciences-bsc', universityName: 'University of Freiburg', universityNameAR: 'جامعة فرايبورغ',
    city: 'Freiburg', cityAR: 'فرايبورغ', programName: 'Environmental Natural Sciences (B.Sc.)', programNameDE: 'Umweltnaturwissenschaften',
    programNameAR: 'العلوم البيئية الطبيعية (بكالوريوس)',
    url: 'https://uni-freiburg.de/en/studies/degree-programmes/degree-programme/environmental-natural-sciences/',
    title: 'University of Freiburg — Environmental Natural Sciences B.Sc.', titleAR: 'جامعة فرايبورغ — بكالوريوس العلوم البيئية الطبيعية',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'hochschulstart',
    deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '01.06.–15.07.' },
  },
  mathematics: {
    id: 'bonn-mathematics-bsc', universityName: 'University of Bonn', universityNameAR: 'جامعة بون',
    city: 'Bonn', cityAR: 'بون', programName: 'Mathematics (B.Sc.)', programNameDE: 'Mathematik', programNameAR: 'الرياضيات (بكالوريوس)',
    url: 'https://www.uni-bonn.de/en/studying/degree-programs/mathematics-bsc',
    title: 'University of Bonn — Mathematics B.Sc.', titleAR: 'جامعة بون — بكالوريوس الرياضيات',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'open', channel: 'university',
  },
  physics: {
    id: 'bonn-physics-bsc', universityName: 'University of Bonn', universityNameAR: 'جامعة بون',
    city: 'Bonn', cityAR: 'بون', programName: 'Physics (B.Sc.)', programNameDE: 'Physik', programNameAR: 'الفيزياء (بكالوريوس)',
    url: 'https://www.uni-bonn.de/en/studying/degree-programs/physics-bsc',
    title: 'University of Bonn — Physics B.Sc.', titleAR: 'جامعة بون — بكالوريوس الفيزياء',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'open', channel: 'university',
  },
  chemistry: {
    id: 'bonn-chemistry-bsc', universityName: 'University of Bonn', universityNameAR: 'جامعة بون',
    city: 'Bonn', cityAR: 'بون', programName: 'Chemistry (B.Sc.)', programNameDE: 'Chemie', programNameAR: 'الكيمياء (بكالوريوس)',
    url: 'https://www.uni-bonn.de/en/studying/degree-programs/chemistry-bsc',
    title: 'University of Bonn — Chemistry B.Sc.', titleAR: 'جامعة بون — بكالوريوس الكيمياء',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'open', channel: 'university',
  },
  biology: {
    id: 'bonn-biology-bsc', universityName: 'University of Bonn', universityNameAR: 'جامعة بون',
    city: 'Bonn', cityAR: 'بون', programName: 'Biology (B.Sc.)', programNameDE: 'Biologie', programNameAR: 'الأحياء (بكالوريوس)',
    url: 'https://www.uni-bonn.de/en/studying/degree-programs/biology-bsc',
    title: 'University of Bonn — Biology B.Sc.', titleAR: 'جامعة بون — بكالوريوس الأحياء',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'university',
  },

  // Social sciences ---------------------------------------------------------
  psychology: {
    id: 'freiburg-psychology-bsc', universityName: 'University of Freiburg', universityNameAR: 'جامعة فرايبورغ',
    city: 'Freiburg', cityAR: 'فرايبورغ', programName: 'Psychology (B.Sc.)', programNameDE: 'Psychologie', programNameAR: 'علم النفس (بكالوريوس)',
    url: 'https://uni-freiburg.de/en/studies/degree-programmes/degree-programme/258/',
    title: 'University of Freiburg — Psychology B.Sc.', titleAR: 'جامعة فرايبورغ — بكالوريوس علم النفس',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'hochschulstart',
    deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '01.06.–15.07.' },
  },
  sociology: {
    id: 'goettingen-sociology-ba', universityName: 'University of Göttingen', universityNameAR: 'جامعة غوتينغن',
    city: 'Göttingen', cityAR: 'غوتينغن', programName: 'Sociology (B.A.)', programNameDE: 'Soziologie', programNameAR: 'علم الاجتماع (بكالوريوس)',
    url: 'https://www.uni-goettingen.de/en/bachelor/soziologie/3402.html',
    title: 'University of Göttingen — Sociology B.A.', titleAR: 'جامعة غوتينغن — بكالوريوس علم الاجتماع',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'open', channel: 'university',
  },
  'political-science': {
    id: 'mannheim-political-science-ba', universityName: 'University of Mannheim', universityNameAR: 'جامعة مانهايم',
    city: 'Mannheim', cityAR: 'مانهايم', programName: 'Political Science (B.A.)', programNameDE: 'Politikwissenschaft', programNameAR: 'العلوم السياسية (بكالوريوس)',
    url: 'https://www.uni-mannheim.de/en/academics/bachelors-degree-programs/political-science/',
    title: 'University of Mannheim — Political Science B.A.', titleAR: 'جامعة مانهايم — بكالوريوس العلوم السياسية',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'university',
    deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '01.06.–15.07.' },
  },
  philosophy: {
    id: 'bonn-philosophy-ba', universityName: 'University of Bonn', universityNameAR: 'جامعة بون',
    city: 'Bonn', cityAR: 'بون', programName: 'Philosophy (B.A.)', programNameDE: 'Philosophie', programNameAR: 'الفلسفة (بكالوريوس)',
    url: 'https://www.uni-bonn.de/en/studying/degree-programs/philosophy-ba',
    title: 'University of Bonn — Philosophy B.A.', titleAR: 'جامعة بون — بكالوريوس الفلسفة',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'open', channel: 'university',
  },
  'social-work': {
    id: 'hsb-social-work-ba', universityName: 'Hochschule Bremen', universityNameAR: 'جامعة بريمن للعلوم التطبيقية',
    city: 'Bremen', cityAR: 'بريمن', programName: 'Social Work (B.A.)', programNameDE: 'Soziale Arbeit', programNameAR: 'العمل الاجتماعي (بكالوريوس)',
    url: 'https://www.hs-bremen.de/studium/studienangebot/detail/soziale-arbeit-b-a/',
    title: 'Hochschule Bremen — Soziale Arbeit B.A.', titleAR: 'جامعة بريمن للعلوم التطبيقية — بكالوريوس العمل الاجتماعي',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'university',
    deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '01.06.–15.07.' },
    entrance: 'A 13-week pre-study internship is required.', entranceAR: 'يُطلب تدريب عملي تمهيدي لمدة 13 أسبوعاً.',
  },
  linguistics: {
    id: 'potsdam-linguistics-bsc', universityName: 'University of Potsdam', universityNameAR: 'جامعة بوتسدام',
    city: 'Potsdam', cityAR: 'بوتسدام', programName: 'Linguistics (B.Sc.)', programNameDE: 'Linguistik', programNameAR: 'علم اللغة (بكالوريوس)',
    url: 'https://www.uni-potsdam.de/en/studium/studienangebot/bachelor/linguistik',
    title: 'University of Potsdam — Linguistics B.Sc.', titleAR: 'جامعة بوتسدام — بكالوريوس علم اللغة',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS, additionalLanguage: { language: 'English', minimumLevel: 'B1', certificates: ['English B1'] } },
    channel: 'university',
  },
  'media-communication': {
    id: 'hohenheim-communication-science-ba', universityName: 'University of Hohenheim', universityNameAR: 'جامعة هوهنهايم',
    city: 'Stuttgart', cityAR: 'شتوتغارت', programName: 'Communication Science (B.A.)', programNameDE: 'Kommunikationswissenschaft', programNameAR: 'علوم الاتصال والإعلام (بكالوريوس)',
    url: 'https://www.uni-hohenheim.de/en/communication-science-bachelor',
    title: 'University of Hohenheim — Communication Science B.A.', titleAR: 'جامعة هوهنهايم — بكالوريوس علوم الاتصال',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'university',
    deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '15.07.' },
    entrance: 'A two-month internship is required.', entranceAR: 'يُطلب تدريب عملي لمدة شهرين.',
  },
  history: {
    id: 'leipzig-history-ba', universityName: 'Leipzig University', universityNameAR: 'جامعة لايبزيغ',
    city: 'Leipzig', cityAR: 'لايبزيغ', programName: 'History (B.A.)', programNameDE: 'Geschichte', programNameAR: 'التاريخ (بكالوريوس)',
    url: 'https://www.uni-leipzig.de/studium/studienangebot/studiengang/course/show/geschichte-b-a',
    title: 'Leipzig University — Geschichte B.A.', titleAR: 'جامعة لايبزيغ — بكالوريوس التاريخ',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS, additionalLanguage: { language: 'English', minimumLevel: 'B2', certificates: ['English B2'] } },
    admission: 'nc', channel: 'university', deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '15.07.' },
  },

  // Business & management ---------------------------------------------------
  'business-administration': {
    id: 'mannheim-bwl-bsc', universityName: 'University of Mannheim', universityNameAR: 'جامعة مانهايم',
    city: 'Mannheim', cityAR: 'مانهايم', programName: 'Business Administration (B.Sc.)', programNameDE: 'Betriebswirtschaftslehre', programNameAR: 'إدارة الأعمال (بكالوريوس)',
    url: 'https://www.uni-mannheim.de/en/academics/bachelors-degree-programs/business-administration/',
    title: 'University of Mannheim — Business Administration B.Sc.', titleAR: 'جامعة مانهايم — بكالوريوس إدارة الأعمال',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'university',
    deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '01.06.–15.07.' },
  },
  'international-business': {
    id: 'hsb-international-management-ba', universityName: 'Hochschule Bremen', universityNameAR: 'جامعة بريمن للعلوم التطبيقية',
    city: 'Bremen', cityAR: 'بريمن', programName: 'Business Studies / International Management (B.A.)', programNameDE: 'International Management', programNameAR: 'إدارة الأعمال الدولية (بكالوريوس)',
    url: 'https://www.hs-bremen.de/studium/studienangebot/detail/internationales-management-b-a/',
    title: 'Hochschule Bremen — International Management B.A.', titleAR: 'جامعة بريمن للعلوم التطبيقية — بكالوريوس الإدارة الدولية',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS, additionalLanguage: { language: 'English', minimumLevel: 'B2', certificates: ['English B2'] } },
    admission: 'nc', channel: 'university', deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '01.06.–15.07.' },
  },
  marketing: {
    id: 'hsb-business-studies-marketing-ba', universityName: 'Hochschule Bremen', universityNameAR: 'جامعة بريمن للعلوم التطبيقية',
    city: 'Bremen', cityAR: 'بريمن', programName: 'Business Studies (B.A.) — Marketing focus', programNameDE: 'Betriebswirtschaft / Marketing', programNameAR: 'إدارة الأعمال (بكالوريوس) — تركيز التسويق',
    url: 'https://www.hs-bremen.de/studium/studienangebot/detail/betriebswirtschaft-b-a/',
    title: 'Hochschule Bremen — Business Studies B.A.', titleAR: 'جامعة بريمن للعلوم التطبيقية — بكالوريوس إدارة الأعمال',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS, additionalLanguage: { language: 'English', minimumLevel: 'B1', certificates: ['English B1.2'] } },
    admission: 'nc', channel: 'university', deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '01.06.–15.07.' },
    note: 'Mapped route: Marketing is a published focus within the Business Studies programme.', noteAR: 'مسار مطابق: التسويق تركيز منشور داخل برنامج إدارة الأعمال.',
  },
  'finance-accounting': {
    id: 'hsb-european-finance-accounting-ba', universityName: 'Hochschule Bremen', universityNameAR: 'جامعة بريمن للعلوم التطبيقية',
    city: 'Bremen', cityAR: 'بريمن', programName: 'European Finance and Accounting (B.A.)', programNameDE: 'European Finance and Accounting', programNameAR: 'المالية والمحاسبة الأوروبية (بكالوريوس)',
    url: 'https://www.hs-bremen.de/studium/studienangebot/detail/european-finance-and-accounting-b-a/',
    title: 'Hochschule Bremen — European Finance and Accounting B.A.', titleAR: 'جامعة بريمن للعلوم التطبيقية — بكالوريوس المالية والمحاسبة الأوروبية',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS, additionalLanguage: { language: 'English', minimumLevel: 'B1', certificates: ['English B1.2'] } },
    admission: 'nc', channel: 'university',
  },
  entrepreneurship: {
    id: 'leuphana-management-entrepreneurship-bsc', universityName: 'Leuphana University Lüneburg', universityNameAR: 'جامعة ليوبانا لونيبورغ',
    city: 'Lüneburg', cityAR: 'لونيبورغ', programName: 'Management & Entrepreneurship (B.Sc.)', programNameDE: 'Management & Entrepreneurship', programNameAR: 'الإدارة وريادة الأعمال (بكالوريوس)',
    url: 'https://www.leuphana.de/en/college/bachelor/management-entrepreneurship.html',
    title: 'Leuphana University — Management & Entrepreneurship B.Sc.', titleAR: 'جامعة ليوبانا — بكالوريوس الإدارة وريادة الأعمال',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS, additionalLanguage: { language: 'English', minimumLevel: 'B2', certificates: ['English B2'] } },
    channel: 'university',
  },
  'supply-chain': {
    id: 'hsb-business-studies-logistics-ba', universityName: 'Hochschule Bremen', universityNameAR: 'جامعة بريمن للعلوم التطبيقية',
    city: 'Bremen', cityAR: 'بريمن', programName: 'Business Studies (B.A.) — Logistics focus', programNameDE: 'Betriebswirtschaft / Logistik', programNameAR: 'إدارة الأعمال (بكالوريوس) — تركيز اللوجستيات وسلاسل الإمداد',
    url: 'https://www.hs-bremen.de/studium/studienangebot/detail/betriebswirtschaft-b-a/',
    title: 'Hochschule Bremen — Business Studies B.A.', titleAR: 'جامعة بريمن للعلوم التطبيقية — بكالوريوس إدارة الأعمال',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS, additionalLanguage: { language: 'English', minimumLevel: 'B1', certificates: ['English B1.2'] } },
    admission: 'nc', channel: 'university', deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '01.06.–15.07.' },
    note: 'Mapped route: Logistics is a published focus within the Business Studies programme.', noteAR: 'مسار مطابق: اللوجستيات تركيز منشور داخل برنامج إدارة الأعمال.',
  },
  'human-resources': {
    id: 'hsb-business-studies-hr-ba', universityName: 'Hochschule Bremen', universityNameAR: 'جامعة بريمن للعلوم التطبيقية',
    city: 'Bremen', cityAR: 'بريمن', programName: 'Business Studies (B.A.) — Human Resources focus', programNameDE: 'Betriebswirtschaft / Personal', programNameAR: 'إدارة الأعمال (بكالوريوس) — تركيز الموارد البشرية',
    url: 'https://www.hs-bremen.de/studium/studienangebot/detail/betriebswirtschaft-b-a/',
    title: 'Hochschule Bremen — Business Studies B.A.', titleAR: 'جامعة بريمن للعلوم التطبيقية — بكالوريوس إدارة الأعمال',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS, additionalLanguage: { language: 'English', minimumLevel: 'B1', certificates: ['English B1.2'] } },
    admission: 'nc', channel: 'university', deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '01.06.–15.07.' },
    note: 'Mapped route: Human Resources is a published focus within the Business Studies programme.', noteAR: 'مسار مطابق: الموارد البشرية تركيز منشور داخل برنامج إدارة الأعمال.',
  },
  economics: {
    id: 'mannheim-economics-bsc', universityName: 'University of Mannheim', universityNameAR: 'جامعة مانهايم',
    city: 'Mannheim', cityAR: 'مانهايم', programName: 'Economics (B.Sc.)', programNameDE: 'Volkswirtschaftslehre', programNameAR: 'الاقتصاد (بكالوريوس)',
    url: 'https://www.uni-mannheim.de/en/academics/bachelors-degree-programs/economics/',
    title: 'University of Mannheim — Economics B.Sc.', titleAR: 'جامعة مانهايم — بكالوريوس الاقتصاد',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'university',
    deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '01.06.–15.07.' },
  },

  // Law --------------------------------------------------------------------
  'international-law': {
    id: 'leipzig-law-international-route', universityName: 'Leipzig University', universityNameAR: 'جامعة لايبزيغ',
    city: 'Leipzig', cityAR: 'لايبزيغ', programName: 'Law (Staatsexamen) — international-law route', programNameDE: 'Rechtswissenschaft',
    programNameAR: 'القانون (Staatsexamen) — مسار القانون الدولي',
    url: 'https://www.uni-leipzig.de/studium/studienangebot/studiengang/course/show/rechtswissenschaft-staatsexamen',
    title: 'Leipzig University — Rechtswissenschaft Staatsexamen', titleAR: 'جامعة لايبزيغ — Rechtswissenschaft Staatsexamen',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'university',
    note: 'Mapped route: International Law is an area within Rechtswissenschaft / Staatsexamen, not a separate German bachelor title.', noteAR: 'مسار مطابق: القانون الدولي مجال ضمن Rechtswissenschaft / Staatsexamen وليس بكالوريوس ألمانياً مستقلاً.',
  },
  'criminal-law': {
    id: 'leipzig-law-criminal-route', universityName: 'Leipzig University', universityNameAR: 'جامعة لايبزيغ',
    city: 'Leipzig', cityAR: 'لايبزيغ', programName: 'Law (Staatsexamen) — criminal-law route', programNameDE: 'Rechtswissenschaft',
    programNameAR: 'القانون (Staatsexamen) — مسار القانون الجنائي',
    url: 'https://www.uni-leipzig.de/studium/studienangebot/studiengang/course/show/rechtswissenschaft-staatsexamen',
    title: 'Leipzig University — Rechtswissenschaft Staatsexamen', titleAR: 'جامعة لايبزيغ — Rechtswissenschaft Staatsexamen',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'university',
    note: 'Mapped route: Criminal Law is an area within Rechtswissenschaft / Staatsexamen, not a separate German bachelor title.', noteAR: 'مسار مطابق: القانون الجنائي مجال ضمن Rechtswissenschaft / Staatsexamen وليس بكالوريوس ألمانياً مستقلاً.',
  },
  'business-law': {
    id: 'mannheim-company-law-llb', universityName: 'University of Mannheim', universityNameAR: 'جامعة مانهايم',
    city: 'Mannheim', cityAR: 'مانهايم', programName: 'Business Law / Company Lawyer (LL.B. + Staatsexamen)', programNameDE: 'Unternehmensjurist',
    programNameAR: 'قانون الأعمال / Unternehmensjurist (LL.B. + Staatsexamen)',
    url: 'https://www.uni-mannheim.de/en/study/degree-programmes/company-law/',
    title: 'University of Mannheim — Company Lawyer / Business Law', titleAR: 'جامعة مانهايم — Unternehmensjurist / قانون الأعمال',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, channel: 'university',
  },

  // Arts & design -----------------------------------------------------------
  architecture: {
    id: 'tu-berlin-architecture-bsc', universityName: 'TU Berlin', universityNameAR: 'جامعة برلين التقنية',
    city: 'Berlin', cityAR: 'برلين', programName: 'Architecture (B.Sc.)', programNameDE: 'Architektur', programNameAR: 'العمارة (بكالوريوس)',
    url: 'https://www.tu.berlin/studieren/studienangebot/gesamtes-studienangebot/studiengang/architektur-b-sc',
    title: 'TU Berlin — Architecture B.Sc.', titleAR: 'جامعة برلين التقنية — بكالوريوس العمارة',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'university',
  },
  'fine-arts': {
    id: 'udk-fine-arts', universityName: 'Berlin University of the Arts (UdK Berlin)', universityNameAR: 'جامعة برلين للفنون (UdK Berlin)',
    city: 'Berlin', cityAR: 'برلين', programName: 'Fine Arts — Bildende Kunst', programNameDE: 'Bildende Kunst', programNameAR: 'الفنون الجميلة — Bildende Kunst',
    url: 'https://www.udk-berlin.de/en/courses/fine-arts/',
    title: 'UdK Berlin — Bildende Kunst', titleAR: 'UdK Berlin — Bildende Kunst',
    language: null, admission: 'aptitude_test', channel: 'university',
    entrance: 'Artistic aptitude procedure with portfolio/work samples.', entranceAR: 'إجراء أهلية فنية مع ملف أعمال/نماذج فنية.',
    note: 'Do not force a blanket C1 rule here; verify the current language requirement for the international artistic route.', noteAR: 'لا تفرض قاعدة C1 عامة هنا؛ تحقّق من متطلب اللغة لمسار المتقدم الدولي الفني.',
  },
  'graphic-design': {
    id: 'htw-communication-design-ba', universityName: 'HTW Berlin', universityNameAR: 'جامعة HTW برلين',
    city: 'Berlin', cityAR: 'برلين', programName: 'Communication Design (B.A.)', programNameDE: 'Kommunikationsdesign', programNameAR: 'التصميم الجرافيكي / Communication Design (بكالوريوس)',
    url: 'https://www.htw-berlin.de/en/studies/degree-programmes/details/kommunikationsdesign/',
    title: 'HTW Berlin — Kommunikationsdesign B.A.', titleAR: 'HTW Berlin — بكالوريوس Communication Design',
    language: { language: 'German', minimumLevel: 'C1', certificates: ['DSH-2', 'TestDaF 4×4', 'telc C1 Hochschule'] },
    admission: 'aptitude_test', channel: 'university',
    entrance: 'Entrance examination and portfolio/work samples.', entranceAR: 'اختبار قبول وملف أعمال/نماذج فنية.',
  },
  music: {
    id: 'udk-music-bachelor-route', universityName: 'Berlin University of the Arts (UdK Berlin)', universityNameAR: 'جامعة برلين للفنون (UdK Berlin)',
    city: 'Berlin', cityAR: 'برلين', programName: 'Bachelor of Music — reference artistic route', programNameDE: 'Bachelor of Music', programNameAR: 'بكالوريوس الموسيقى — مسار فني مرجعي',
    url: 'https://www.udk-berlin.de/en/courses/music/',
    title: 'UdK Berlin — Bachelor of Music', titleAR: 'UdK Berlin — بكالوريوس الموسيقى',
    language: { language: 'German', minimumLevel: 'B2', certificates: ['German B2'] },
    admission: 'aptitude_test', channel: 'university',
    entrance: 'Special artistic aptitude examination; exact discipline requirements vary.', entranceAR: 'اختبار أهلية فنية خاص؛ شروط التخصص تختلف حسب المسار.',
    note: 'The cited music route uses German B2; do not generalize this level to every music discipline.', noteAR: 'مسار الموسيقى المذكور يستخدم B2 بالألمانية؛ لا تعمّم المستوى على جميع تخصصات الموسيقى.',
  },
  theater: {
    id: 'leipzig-theater-studies-ba', universityName: 'Leipzig University', universityNameAR: 'جامعة لايبزيغ',
    city: 'Leipzig', cityAR: 'لايبزيغ', programName: 'Theatre Studies, Transdisciplinary (B.A.)', programNameDE: 'Theaterwissenschaft transdisziplinär',
    programNameAR: 'دراسات المسرح متعددة التخصصات (بكالوريوس)',
    url: 'https://www.uni-leipzig.de/studium/studienangebot/studiengang/course/show/theaterwissenschaft-transdisziplinaer-b-a',
    title: 'Leipzig University — Theaterwissenschaft transdisziplinär B.A.', titleAR: 'جامعة لايبزيغ — بكالوريوس دراسات المسرح',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS, additionalLanguage: { language: 'English', minimumLevel: 'B2', certificates: ['English B2'] } },
    admission: 'nc', channel: 'university', deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '02.05.–15.07.' },
  },
  'film-media': {
    id: 'mainz-film-studies-ba', universityName: 'Johannes Gutenberg University Mainz', universityNameAR: 'جامعة يوهانس غوتنبرغ ماينتس',
    city: 'Mainz', cityAR: 'ماينتس', programName: 'Film Studies (B.A.)', programNameDE: 'Filmwissenschaft', programNameAR: 'دراسات السينما والإعلام (بكالوريوس)',
    url: 'https://www.studium.uni-mainz.de/studienangebot/filmwissenschaft/',
    title: 'JGU Mainz — Filmwissenschaft B.A.', titleAR: 'جامعة ماينتس — بكالوريوس دراسات السينما',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS },
    admission: 'nc', channel: 'university', deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '01.04.–15.07.' },
  },

  // Education ----------------------------------------------------------------
  'elementary-education': {
    id: 'leipzig-primary-teacher-staatsexamen', universityName: 'Leipzig University', universityNameAR: 'جامعة لايبزيغ',
    city: 'Leipzig', cityAR: 'لايبزيغ', programName: 'Primary School Teaching (Staatsexamen)', programNameDE: 'Grundschullehramt', programNameAR: 'تدريس المرحلة الابتدائية (Staatsexamen)',
    url: 'https://www.uni-leipzig.de/studium/studienangebot/studiengang/course/show/grundschullehramt',
    title: 'Leipzig University — Grundschullehramt', titleAR: 'جامعة لايبزيغ — Grundschullehramt',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'university',
    deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '15.07.' },
    entrance: 'A phoniatric certificate and required practical placements are part of the route.', entranceAR: 'شهادة فونيترية وفترات تدريب عملي مطلوبة ضمن المسار.',
  },
  'special-education': {
    id: 'leipzig-special-education-staatsexamen', universityName: 'Leipzig University', universityNameAR: 'جامعة لايبزيغ',
    city: 'Leipzig', cityAR: 'لايبزيغ', programName: 'Special Education (Staatsexamen)', programNameDE: 'Sonderpädagogik', programNameAR: 'التربية الخاصة (Staatsexamen)',
    url: 'https://www.uni-leipzig.de/studium/studienangebot/studiengang/course/show/sonderpaedagogik',
    title: 'Leipzig University — Sonderpädagogik Staatsexamen', titleAR: 'جامعة لايبزيغ — Sonderpädagogik Staatsexamen',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'university',
    deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '15.07.' },
    entrance: 'Five practical placements are part of the teacher-training route.', entranceAR: 'خمس فترات تدريب عملي جزء من مسار إعداد المعلم.',
  },
  'educational-psychology': {
    id: 'potsdam-education-science-psychology-route-ba', universityName: 'University of Potsdam', universityNameAR: 'جامعة بوتسدام',
    city: 'Potsdam', cityAR: 'بوتسدام', programName: 'Education Science (B.A.) — educational psychology route', programNameDE: 'Erziehungswissenschaft',
    programNameAR: 'علوم التربية (بكالوريوس) — مسار مرتبط بعلم النفس التربوي',
    url: 'https://www.uni-potsdam.de/en/studium/studienangebot/bachelor/erziehungswissenschaft',
    title: 'University of Potsdam — Erziehungswissenschaft B.A.', titleAR: 'جامعة بوتسدام — بكالوريوس Erziehungswissenschaft',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, channel: 'university',
    note: 'Mapped route: Education Science, not a separately asserted Educational Psychology bachelor.', noteAR: 'مسار مطابق: علوم التربية وليس بكالوريوس مستقلاً نثبت أنه علم نفس تربوي.',
  },
  'curriculum-instruction': {
    id: 'potsdam-education-science-didactics-route-ba', universityName: 'University of Potsdam', universityNameAR: 'جامعة بوتسدام',
    city: 'Potsdam', cityAR: 'بوتسدام', programName: 'Education Science (B.A.) — curriculum/didactics route', programNameDE: 'Erziehungswissenschaft',
    programNameAR: 'علوم التربية (بكالوريوس) — مسار المناهج وطرق التدريس',
    url: 'https://www.uni-potsdam.de/en/studium/studienangebot/bachelor/erziehungswissenschaft',
    title: 'University of Potsdam — Erziehungswissenschaft B.A.', titleAR: 'جامعة بوتسدام — بكالوريوس Erziehungswissenschaft',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, channel: 'university',
    note: 'Mapped route: curriculum/instruction represented through Education Science and didactics.', noteAR: 'مسار مطابق: المناهج وطرق التدريس ممثلة ضمن علوم التربية والديداكتيك.',
  },
  'educational-administration': {
    id: 'potsdam-education-science-management-route-ba', universityName: 'University of Potsdam', universityNameAR: 'جامعة بوتسدام',
    city: 'Potsdam', cityAR: 'بوتسدام', programName: 'Education Science (B.A.) — education-management route', programNameDE: 'Erziehungswissenschaft',
    programNameAR: 'علوم التربية (بكالوريوس) — مسار إدارة التعليم',
    url: 'https://www.uni-potsdam.de/en/studium/studienangebot/bachelor/erziehungswissenschaft',
    title: 'University of Potsdam — Erziehungswissenschaft B.A.', titleAR: 'جامعة بوتسدام — بكالوريوس Erziehungswissenschaft',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, channel: 'university',
    note: 'Mapped route: use the current module catalogue for education-management content; no separate bachelor title is asserted.', noteAR: 'مسار مطابق: استخدم دليل الوحدات الحالي لمحتوى إدارة التعليم؛ لا نثبت وجود بكالوريوس مستقل بهذا الاسم.',
  },

  // Agriculture & environment ------------------------------------------------
  'agricultural-science': {
    id: 'hohenheim-agricultural-sciences-bsc', universityName: 'University of Hohenheim', universityNameAR: 'جامعة هوهنهايم',
    city: 'Stuttgart', cityAR: 'شتوتغارت', programName: 'Agricultural Sciences (B.Sc.)', programNameDE: 'Agrarwissenschaften', programNameAR: 'العلوم الزراعية (بكالوريوس)',
    url: 'https://www.uni-hohenheim.de/en/agricultural-sciences-bachelor',
    title: 'University of Hohenheim — Agricultural Sciences B.Sc.', titleAR: 'جامعة هوهنهايم — بكالوريوس العلوم الزراعية',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'open', channel: 'university',
    entrance: 'An eight-week professional internship is required.', entranceAR: 'يُطلب تدريب مهني لمدة 8 أسابيع.',
  },
  'environmental-management': {
    id: 'hohenheim-sustainability-change-bsc-env-management', universityName: 'University of Hohenheim', universityNameAR: 'جامعة هوهنهايم',
    city: 'Stuttgart', cityAR: 'شتوتغارت', programName: 'Sustainability & Change (B.Sc.) — environmental-management route',
    programNameDE: 'Sustainability & Change', programNameAR: 'الاستدامة والتغيير (بكالوريوس) — مسار إدارة البيئة',
    url: 'https://www.uni-hohenheim.de/en/sustainability-change-bachelor',
    title: 'University of Hohenheim — Sustainability & Change B.Sc.', titleAR: 'جامعة هوهنهايم — بكالوريوس Sustainability & Change',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'university',
    deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '15.07.' },
    note: 'Mapped route: Sustainability & Change is the public bachelor reference for the environmental-management family.', noteAR: 'مسار مطابق: Sustainability & Change هو مرجع البكالوريوس العام لعائلة إدارة البيئة.',
  },
  forestry: {
    id: 'freiburg-forest-sciences-bsc', universityName: 'University of Freiburg', universityNameAR: 'جامعة فرايبورغ',
    city: 'Freiburg', cityAR: 'فرايبورغ', programName: 'Forest Sciences (B.Sc.)', programNameDE: 'Forstwissenschaften', programNameAR: 'علوم الغابات (بكالوريوس)',
    url: 'https://uni-freiburg.de/en/studies/degree-programmes/degree-programme/forest-sciences/',
    title: 'University of Freiburg — Forest Sciences B.Sc.', titleAR: 'جامعة فرايبورغ — بكالوريوس علوم الغابات',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'hochschulstart',
    deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '01.06.–15.07.' },
  },
  'marine-science': {
    id: 'bremen-marine-geosciences-bsc', universityName: 'University of Bremen', universityNameAR: 'جامعة بريمن',
    city: 'Bremen', cityAR: 'بريمن', programName: 'Marine Geosciences (B.Sc.)', programNameDE: 'Marine Geowissenschaften', programNameAR: 'علوم البحار / Marine Geosciences (بكالوريوس)',
    url: 'https://www.uni-bremen.de/en/msm/studies/bachelor-marine-geosciences',
    title: 'University of Bremen — Marine Geosciences B.Sc.', titleAR: 'جامعة بريمن — بكالوريوس Marine Geosciences',
    language: { language: 'English', minimumLevel: 'B2', certificates: ['English B2'], additionalLanguage: { language: 'German', minimumLevel: 'A1', certificates: ['German A1'] } },
    admission: 'open', channel: 'university',
  },
  'sustainable-development': {
    id: 'hohenheim-sustainability-change-bsc', universityName: 'University of Hohenheim', universityNameAR: 'جامعة هوهنهايم',
    city: 'Stuttgart', cityAR: 'شتوتغارت', programName: 'Sustainability & Change (B.Sc.)', programNameDE: 'Sustainability & Change', programNameAR: 'الاستدامة والتغيير (بكالوريوس)',
    url: 'https://www.uni-hohenheim.de/en/sustainability-change-bachelor',
    title: 'University of Hohenheim — Sustainability & Change B.Sc.', titleAR: 'جامعة هوهنهايم — بكالوريوس Sustainability & Change',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'university',
    deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '15.07.' },
  },

  // Tourism & hospitality ----------------------------------------------------
  'tourism-management': {
    id: 'hsb-international-tourism-management-ba', universityName: 'Hochschule Bremen', universityNameAR: 'جامعة بريمن للعلوم التطبيقية',
    city: 'Bremen', cityAR: 'بريمن', programName: 'International Tourism Management (B.A.)', programNameDE: 'International Tourism Management',
    programNameAR: 'إدارة السياحة الدولية (بكالوريوس)',
    url: 'https://www.hs-bremen.de/studium/studienangebot/detail/international-tourism-management-b-a/',
    title: 'Hochschule Bremen — International Tourism Management B.A.', titleAR: 'جامعة بريمن للعلوم التطبيقية — بكالوريوس إدارة السياحة الدولية',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS, additionalLanguage: { language: 'English', minimumLevel: 'B1', certificates: ['English B1.2'] } },
    admission: 'nc', channel: 'university', deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '01.06.–15.07.' },
  },
  'hotel-management': {
    id: 'hs-harz-tourism-hotel-route-ba', universityName: 'Harz University of Applied Sciences', universityNameAR: 'جامعة هارتس للعلوم التطبيقية',
    city: 'Wernigerode', cityAR: 'فيرنيغيروده', programName: 'Tourism Management (B.A.) — Hotel Management focus',
    programNameDE: 'Tourismusmanagement / Hotelmanagement', programNameAR: 'إدارة السياحة (بكالوريوس) — تركيز إدارة الفنادق',
    url: 'https://www.hs-harz.de/studium/bachelor/tourismusmanagement/',
    title: 'Harz University — Tourism Management / Hotel Management focus', titleAR: 'جامعة هارتس — إدارة السياحة / تركيز إدارة الفنادق',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, channel: 'university',
    note: 'Mapped route: Hotel Management is a published field within the tourism-management offering, not a claim of a separate bachelor title.', noteAR: 'مسار مطابق: إدارة الفنادق مجال منشور ضمن إدارة السياحة وليست ادعاءً بوجود بكالوريوس منفصل.',
  },
  'culinary-arts': {
    id: 'hohenheim-food-science-bsc-culinary-adjacent', universityName: 'University of Hohenheim', universityNameAR: 'جامعة هوهنهايم',
    city: 'Stuttgart', cityAR: 'شتوتغارت', programName: 'Food Science and Biotechnology (B.Sc.) — adjacent route, not Culinary Arts',
    programNameDE: 'Lebensmittelwissenschaft und Biotechnologie', programNameAR: 'علوم الأغذية والتكنولوجيا الحيوية (بكالوريوس) — مسار مجاور وليس فنون طبخ',
    url: 'https://www.uni-hohenheim.de/en/food-science-and-biotechnology-bachelor',
    title: 'University of Hohenheim — Food Science and Biotechnology B.Sc.', titleAR: 'جامعة هوهنهايم — بكالوريوس علوم الأغذية والتكنولوجيا الحيوية',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'open', channel: 'university',
    note: 'This is not a Culinary Arts degree. Use it only when the student means food science rather than chef training.', noteAR: 'هذا ليس بكالوريوس فنون طبخ. استخدمه فقط عندما يقصد الطالب علوم الأغذية لا تدريب الطاهي.',
  },
  'event-management': {
    id: 'hs-harz-tourism-event-route-ba', universityName: 'Harz University of Applied Sciences', universityNameAR: 'جامعة هارتس للعلوم التطبيقية',
    city: 'Wernigerode', cityAR: 'فيرنيغيروده', programName: 'Tourism Management (B.A.) — Event Management focus',
    programNameDE: 'Tourismusmanagement / Eventmanagement', programNameAR: 'إدارة السياحة (بكالوريوس) — تركيز إدارة الفعاليات',
    url: 'https://www.hs-harz.de/studium/bachelor/tourismusmanagement/',
    title: 'Harz University — Tourism Management / Event Management focus', titleAR: 'جامعة هارتس — إدارة السياحة / تركيز إدارة الفعاليات',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, channel: 'university',
    note: 'Mapped route: Event Management is a published field within tourism management.', noteAR: 'مسار مطابق: إدارة الفعاليات مجال منشور ضمن إدارة السياحة.',
  },
  'travel-tourism': {
    id: 'worms-tourism-travel-management-ba', universityName: 'Worms University of Applied Sciences', universityNameAR: 'جامعة فورمز للعلوم التطبيقية',
    city: 'Worms', cityAR: 'فورمز', programName: 'Tourism and Travel Management (B.A.)', programNameDE: 'Tourism and Travel Management', programNameAR: 'إدارة السفر والسياحة (بكالوريوس)',
    url: 'https://www.hs-worms.de/en/academics/tourism-travel-management',
    title: 'Worms University — Tourism and Travel Management B.A.', titleAR: 'جامعة فورمز — بكالوريوس إدارة السفر والسياحة',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS, additionalLanguage: { language: 'English', minimumLevel: 'B1', certificates: ['English B1'] } },
    admission: 'open', channel: 'university',
    entrance: 'A 20-week practical phase is part of the programme.', entranceAR: 'يتضمن البرنامج مرحلة تطبيقية لمدة 20 أسبوعاً.',
  },

  bioinformatics: {
    id: 'saarland-bioinformatics-bsc', universityName: 'Saarland University', universityNameAR: 'جامعة سارلاند',
    city: 'Saarbrücken', cityAR: 'ساربروكن', programName: 'Bioinformatics (B.Sc.)', programNameDE: 'Bioinformatik', programNameAR: 'المعلوماتية الحيوية (بكالوريوس)',
    url: 'https://www.uni-saarland.de/en/study/programmes/bachelor/bioinformatics.html', title: 'Saarland University — Bioinformatics B.Sc.', titleAR: 'جامعة سارلاند — بكالوريوس Bioinformatics',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'open', channel: 'university'
  },
  pharmacy: {
    id: 'saarland-pharmacy-staatsexamen', universityName: 'Saarland University', universityNameAR: 'جامعة سارلاند',
    city: 'Saarbrücken', cityAR: 'ساربروكن', programName: 'Pharmacy (Staatsexamen)', programNameDE: 'Pharmazie', programNameAR: 'الصيدلة (امتحان الدولة)',
    url: 'https://www.uni-saarland.de/studium/bewerbung/studienplatzvergabe/hochschulstart/pharmazie-test.html', title: 'Saarland University — Pharmacy / Pharmazie', titleAR: 'جامعة سارلاند — الصيدلة / Pharmazie',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'hochschulstart'
  },
  dentistry: {
    id: 'leipzig-dentistry-staatsexamen', universityName: 'Leipzig University', universityNameAR: 'جامعة لايبزيغ',
    city: 'Leipzig', cityAR: 'لايبزيغ', programName: 'Dentistry (Staatsexamen)', programNameDE: 'Zahnmedizin', programNameAR: 'طب الأسنان (امتحان الدولة)',
    url: 'https://www.uni-leipzig.de/studium/studienangebot/studiengang/course/show/zahnmedizin-staatsexamen', title: 'Leipzig University — Zahnmedizin Staatsexamen', titleAR: 'جامعة لايبزيغ — طب الأسنان Staatsexamen',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'hochschulstart'
  },
  medicine: {
    id: 'goethe-frankfurt-medicine-staatsexamen', universityName: 'Goethe University Frankfurt', universityNameAR: 'جامعة غوته فرانكفورت',
    city: 'Frankfurt am Main', cityAR: 'فرانكفورت', programName: 'Medicine (Staatsexamen)', programNameDE: 'Medizin', programNameAR: 'الطب (امتحان الدولة)',
    url: 'https://www.uni-frankfurt.de/35791076/Medizin__Staatsexamen', title: 'Goethe University Frankfurt — Medicine Staatsexamen', titleAR: 'جامعة غوته فرانكفورت — الطب Staatsexamen',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'hochschulstart'
  },
  physiotherapy: {
    id: 'hs-fulda-physiotherapy-bsc', universityName: 'Hochschule Fulda', universityNameAR: 'جامعة فولدا للعلوم التطبيقية',
    city: 'Fulda', cityAR: 'فولدا', programName: 'Physiotherapy (B.Sc.)', programNameDE: 'Physiotherapie', programNameAR: 'العلاج الطبيعي (بكالوريوس)',
    url: 'https://www.hs-fulda.de/studiengang/physiotherapie-bsc', title: 'Hochschule Fulda — Physiotherapy B.Sc.', titleAR: 'جامعة فولدا — بكالوريوس العلاج الطبيعي',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'open', channel: 'university'
  },
  veterinary: {
    id: 'lmu-veterinary-staatsexamen', universityName: 'LMU Munich', universityNameAR: 'جامعة LMU ميونخ',
    city: 'Munich', cityAR: 'ميونخ', programName: 'Veterinary Medicine (Staatsexamen)', programNameDE: 'Tiermedizin', programNameAR: 'الطب البيطري (امتحان الدولة)',
    url: 'https://www.vetmed.lmu.de/studiendekanat/de/studium/studieninteressierte/zulassung/', title: 'LMU Munich — Veterinary Medicine admission', titleAR: 'جامعة LMU ميونخ — قبول الطب البيطري',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'hochschulstart'
  },
  nursing: {
    id: 'cologne-clinical-nursing-bsc', universityName: 'University of Cologne', universityNameAR: 'جامعة كولونيا',
    city: 'Cologne', cityAR: 'كولونيا', programName: 'Clinical Nursing (B.Sc.)', programNameDE: 'Klinische Pflege', programNameAR: 'التمريض السريري (بكالوريوس)',
    url: 'https://pflegewissenschaft.uni-koeln.de/studium-lehre/bachelorstudiengang-klinische-pflege', title: 'University of Cologne — Clinical Nursing B.Sc.', titleAR: 'جامعة كولونيا — بكالوريوس التمريض السريري',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'selection_procedure', channel: 'university'
  },
  mathematics: {
    id: 'bonn-mathematics-bsc', universityName: 'University of Bonn', universityNameAR: 'جامعة بون', city: 'Bonn', cityAR: 'بون',
    programName: 'Mathematics (B.Sc.)', programNameDE: 'Mathematik', programNameAR: 'الرياضيات (بكالوريوس)',
    url: 'https://www.uni-bonn.de/en/studying/degree-programs/mathematics-bsc', title: 'University of Bonn — Mathematics B.Sc.', titleAR: 'جامعة بون — بكالوريوس الرياضيات',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'open', channel: 'university'
  },
  physics: {
    id: 'bonn-physics-bsc', universityName: 'University of Bonn', universityNameAR: 'جامعة بون', city: 'Bonn', cityAR: 'بون',
    programName: 'Physics (B.Sc.)', programNameDE: 'Physik', programNameAR: 'الفيزياء (بكالوريوس)',
    url: 'https://www.uni-bonn.de/en/studying/degree-programs/physics-bsc', title: 'University of Bonn — Physics B.Sc.', titleAR: 'جامعة بون — بكالوريوس الفيزياء',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'open', channel: 'university'
  },
  chemistry: {
    id: 'bonn-chemistry-bsc', universityName: 'University of Bonn', universityNameAR: 'جامعة بون', city: 'Bonn', cityAR: 'بون',
    programName: 'Chemistry (B.Sc.)', programNameDE: 'Chemie', programNameAR: 'الكيمياء (بكالوريوس)',
    url: 'https://www.uni-bonn.de/en/studying/degree-programs/chemistry-bsc', title: 'University of Bonn — Chemistry B.Sc.', titleAR: 'جامعة بون — بكالوريوس الكيمياء',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'open', channel: 'university'
  },
  biology: {
    id: 'bonn-biology-bsc', universityName: 'University of Bonn', universityNameAR: 'جامعة بون', city: 'Bonn', cityAR: 'بون',
    programName: 'Biology (B.Sc.)', programNameDE: 'Biologie', programNameAR: 'الأحياء (بكالوريوس)',
    url: 'https://www.uni-bonn.de/en/studying/degree-programs/biology-bsc', title: 'University of Bonn — Biology B.Sc.', titleAR: 'جامعة بون — بكالوريوس الأحياء',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'university'
  },
  psychology: {
    id: 'freiburg-psychology-bsc', universityName: 'University of Freiburg', universityNameAR: 'جامعة فرايبورغ',
    city: 'Freiburg', cityAR: 'فرايبورغ', programName: 'Psychology (B.Sc.)', programNameDE: 'Psychologie', programNameAR: 'علم النفس (بكالوريوس)',
    url: 'https://uni-freiburg.de/en/studies/degree-programmes/degree-programme/258/', title: 'University of Freiburg — Psychology B.Sc.', titleAR: 'جامعة فرايبورغ — بكالوريوس علم النفس',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'hochschulstart',
    deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '01.06.–15.07.' }
  },
  sociology: {
    id: 'goettingen-sociology-ba', universityName: 'University of Göttingen', universityNameAR: 'جامعة غوتينغن',
    city: 'Göttingen', cityAR: 'غوتينغن', programName: 'Sociology (B.A.)', programNameDE: 'Soziologie', programNameAR: 'علم الاجتماع (بكالوريوس)',
    url: 'https://www.uni-goettingen.de/en/bachelor/soziologie/3402.html', title: 'University of Göttingen — Sociology B.A.', titleAR: 'جامعة غوتينغن — بكالوريوس علم الاجتماع',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'open', channel: 'university'
  },
  philosophy: {
    id: 'bonn-philosophy-ba', universityName: 'University of Bonn', universityNameAR: 'جامعة بون', city: 'Bonn', cityAR: 'بون',
    programName: 'Philosophy (B.A.)', programNameDE: 'Philosophie', programNameAR: 'الفلسفة (بكالوريوس)',
    url: 'https://www.uni-bonn.de/en/studying/degree-programs/philosophy-ba', title: 'University of Bonn — Philosophy B.A.', titleAR: 'جامعة بون — بكالوريوس الفلسفة',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'open', channel: 'university'
  },
  linguistics: {
    id: 'potsdam-linguistics-bsc', universityName: 'University of Potsdam', universityNameAR: 'جامعة بوتسدام', city: 'Potsdam', cityAR: 'بوتسدام',
    programName: 'Linguistics (B.Sc.)', programNameDE: 'Linguistik', programNameAR: 'علم اللغة (بكالوريوس)',
    url: 'https://www.uni-potsdam.de/en/studium/studienangebot/bachelor/linguistik', title: 'University of Potsdam — Linguistics B.Sc.', titleAR: 'جامعة بوتسدام — بكالوريوس علم اللغة',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS, additionalLanguage: { language: 'English', minimumLevel: 'B1', certificates: ['English B1'] } }, channel: 'university'
  },
  history: {
    id: 'leipzig-history-ba', universityName: 'Leipzig University', universityNameAR: 'جامعة لايبزيغ', city: 'Leipzig', cityAR: 'لايبزيغ',
    programName: 'History (B.A.)', programNameDE: 'Geschichte', programNameAR: 'التاريخ (بكالوريوس)',
    url: 'https://www.uni-leipzig.de/studium/studienangebot/studiengang/course/show/geschichte-b-a', title: 'Leipzig University — Geschichte B.A.', titleAR: 'جامعة لايبزيغ — بكالوريوس التاريخ',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS, additionalLanguage: { language: 'English', minimumLevel: 'B2', certificates: ['English B2'] } },
    admission: 'nc', channel: 'university', deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '15.07.' }
  },
  marketing: {
    id: 'hsb-business-studies-marketing-ba', universityName: 'Hochschule Bremen', universityNameAR: 'جامعة بريمن للعلوم التطبيقية',
    city: 'Bremen', cityAR: 'بريمن', programName: 'Business Studies (B.A.) — Marketing focus', programNameDE: 'Betriebswirtschaft / Marketing', programNameAR: 'إدارة الأعمال (بكالوريوس) — تركيز التسويق',
    url: 'https://www.hs-bremen.de/studium/studienangebot/detail/betriebswirtschaft-b-a/', title: 'Hochschule Bremen — Business Studies B.A.', titleAR: 'جامعة بريمن للعلوم التطبيقية — بكالوريوس إدارة الأعمال',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS, additionalLanguage: { language: 'English', minimumLevel: 'B1', certificates: ['English B1.2'] } },
    admission: 'nc', channel: 'university', deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '01.06.–15.07.' },
    note: 'Mapped route: Marketing is a published focus within Business Studies.', noteAR: 'مسار مطابق: التسويق تركيز منشور داخل برنامج إدارة الأعمال.'
  },
  entrepreneurship: {
    id: 'leuphana-management-entrepreneurship-bsc', universityName: 'Leuphana University Lüneburg', universityNameAR: 'جامعة ليوبانا لونيبورغ',
    city: 'Lüneburg', cityAR: 'لونيبورغ', programName: 'Management & Entrepreneurship (B.Sc.)', programNameDE: 'Management & Entrepreneurship', programNameAR: 'الإدارة وريادة الأعمال (بكالوريوس)',
    url: 'https://www.leuphana.de/en/college/bachelor/management-entrepreneurship.html', title: 'Leuphana University — Management & Entrepreneurship B.Sc.', titleAR: 'جامعة ليوبانا — بكالوريوس الإدارة وريادة الأعمال',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS, additionalLanguage: { language: 'English', minimumLevel: 'B2', certificates: ['English B2'] } },
    channel: 'university'
  },
  economics: {
    id: 'mannheim-economics-bsc', universityName: 'University of Mannheim', universityNameAR: 'جامعة مانهايم', city: 'Mannheim', cityAR: 'مانهايم',
    programName: 'Economics (B.Sc.)', programNameDE: 'Volkswirtschaftslehre', programNameAR: 'الاقتصاد (بكالوريوس)',
    url: 'https://www.uni-mannheim.de/en/academics/bachelors-degree-programs/economics/', title: 'University of Mannheim — Economics B.Sc.', titleAR: 'جامعة مانهايم — بكالوريوس الاقتصاد',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'university',
    deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '01.06.–15.07.' }
  },
  architecture: {
    id: 'tu-berlin-architecture-bsc', universityName: 'TU Berlin', universityNameAR: 'جامعة برلين التقنية', city: 'Berlin', cityAR: 'برلين',
    programName: 'Architecture (B.Sc.)', programNameDE: 'Architektur', programNameAR: 'العمارة (بكالوريوس)',
    url: 'https://www.tu.berlin/studieren/studienangebot/gesamtes-studienangebot/studiengang/architektur-b-sc', title: 'TU Berlin — Architecture B.Sc.', titleAR: 'جامعة برلين التقنية — بكالوريوس العمارة',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'university'
  },
  music: {
    id: 'udk-music-bachelor-route', universityName: 'Berlin University of the Arts (UdK Berlin)', universityNameAR: 'جامعة برلين للفنون (UdK Berlin)',
    city: 'Berlin', cityAR: 'برلين', programName: 'Bachelor of Music — reference artistic route', programNameDE: 'Bachelor of Music', programNameAR: 'بكالوريوس الموسيقى — مسار فني مرجعي',
    url: 'https://www.udk-berlin.de/en/courses/music/', title: 'UdK Berlin — Bachelor of Music', titleAR: 'UdK Berlin — بكالوريوس الموسيقى',
    language: { language: 'German', minimumLevel: 'B2', certificates: ['German B2'] }, admission: 'aptitude_test', channel: 'university',
    entrance: 'Special artistic aptitude examination; exact discipline requirements vary.', entranceAR: 'اختبار أهلية فنية خاص؛ شروط التخصص تختلف حسب المسار.',
    note: 'B2 applies to the cited UdK music route and is not a universal music requirement.', noteAR: 'ينطبق B2 على مسار الموسيقى المذكور وليس شرطاً عاماً لكل تخصصات الموسيقى.'
  },
  theater: {
    id: 'leipzig-theater-studies-ba', universityName: 'Leipzig University', universityNameAR: 'جامعة لايبزيغ', city: 'Leipzig', cityAR: 'لايبزيغ',
    programName: 'Theatre Studies, Transdisciplinary (B.A.)', programNameDE: 'Theaterwissenschaft transdisziplinär', programNameAR: 'دراسات المسرح متعددة التخصصات (بكالوريوس)',
    url: 'https://www.uni-leipzig.de/studium/studienangebot/studiengang/course/show/theaterwissenschaft-transdisziplinaer-b-a', title: 'Leipzig University — Theaterwissenschaft transdisziplinär B.A.', titleAR: 'جامعة لايبزيغ — بكالوريوس دراسات المسرح',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS, additionalLanguage: { language: 'English', minimumLevel: 'B2', certificates: ['English B2'] } },
    admission: 'nc', channel: 'university', deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '02.05.–15.07.' }
  },
  forestry: {
    id: 'freiburg-forest-sciences-bsc', universityName: 'University of Freiburg', universityNameAR: 'جامعة فرايبورغ', city: 'Freiburg', cityAR: 'فرايبورغ',
    programName: 'Forest Sciences (B.Sc.)', programNameDE: 'Forstwissenschaften', programNameAR: 'علوم الغابات (بكالوريوس)',
    url: 'https://uni-freiburg.de/en/studies/degree-programmes/degree-programme/forest-sciences/', title: 'University of Freiburg — Forest Sciences B.Sc.', titleAR: 'جامعة فرايبورغ — بكالوريوس علوم الغابات',
    language: { language: 'German', minimumLevel: 'C1', certificates: GERMAN_C1_CERTS }, admission: 'nc', channel: 'hochschulstart',
    deadline: { semester: 'Winter semester', semesterAR: 'الفصل الشتوي', deadline: '01.06.–15.07.' }
  },
};

export const REMAINING_MAJOR_INTEL: MajorIntel[] = Object.keys(R).map((id) => makeMajor(id, R[id]));
export const REMAINING_MAJOR_INTEL_IDS = Object.keys(R);
