export type CVLanguage = 'de' | 'en' | 'ar';

export interface CVLabels {
  education: string;
  experience: string;
  skills: string;
  languages: string;
  technical: string;
  other: string;
  certificates: string;
  volunteer: string;
  references: string;
  publications: string;
  present: string;
  address: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  nationality: string;
  linkedin: string;
  educationTraining: string;
  workExperience: string;
  languageSkills: string;
  digitalSkills: string;
  volunteering: string;
  technicalSkills: string;
}

const labels: Record<CVLanguage, CVLabels> = {
  de: {
    education: 'Bildung',
    experience: 'Berufserfahrung',
    skills: 'Fähigkeiten',
    languages: 'Sprachen',
    technical: 'Technisch',
    other: 'Sonstiges',
    certificates: 'Zertifikate',
    volunteer: 'Ehrenamtliche Arbeit',
    references: 'Referenzen',
    publications: 'Veröffentlichungen',
    present: 'Gegenwart',
    address: 'Adresse',
    phone: 'Telefon',
    email: 'E-Mail',
    dateOfBirth: 'Geburtsdatum',
    nationality: 'Staatsangehörigkeit',
    linkedin: 'LinkedIn',
    educationTraining: 'Bildung & Ausbildung',
    workExperience: 'Berufserfahrung',
    languageSkills: 'Sprachkenntnisse',
    digitalSkills: 'Digitale & sonstige Fähigkeiten',
    volunteering: 'Ehrenamt',
    technicalSkills: 'Technische Fähigkeiten',
  },
  en: {
    education: 'Education',
    experience: 'Experience',
    skills: 'Skills',
    languages: 'Languages',
    technical: 'Technical',
    other: 'Other',
    certificates: 'Certificates',
    volunteer: 'Volunteer Work',
    references: 'References',
    publications: 'Publications',
    present: 'Present',
    address: 'Address',
    phone: 'Phone',
    email: 'Email',
    dateOfBirth: 'Date of Birth',
    nationality: 'Nationality',
    linkedin: 'LinkedIn',
    educationTraining: 'Education & Training',
    workExperience: 'Work Experience',
    languageSkills: 'Language Skills',
    digitalSkills: 'Digital & Other Skills',
    volunteering: 'Volunteering',
    technicalSkills: 'Technical Skills',
  },
  ar: {
    education: 'التعليم',
    experience: 'الخبرة العملية',
    skills: 'المهارات',
    languages: 'اللغات',
    technical: 'تقني',
    other: 'أخرى',
    certificates: 'الشهادات',
    volunteer: 'العمل التطوعي',
    references: 'المراجع',
    publications: 'المنشورات',
    present: 'الحالي',
    address: 'العنوان',
    phone: 'الهاتف',
    email: 'البريد الإلكتروني',
    dateOfBirth: 'تاريخ الميلاد',
    nationality: 'الجنسية',
    linkedin: 'لينكدإن',
    educationTraining: 'التعليم والتدريب',
    workExperience: 'الخبرة المهنية',
    languageSkills: 'المهارات اللغوية',
    digitalSkills: 'المهارات الرقمية والأخرى',
    volunteering: 'التطوع',
    technicalSkills: 'المهارات التقنية',
  },
};

export function getCVLabels(lang: string): CVLabels {
  if (lang in labels) return labels[lang as CVLanguage];
  return labels.en;
}
