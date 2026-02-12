export type CVTemplate = 'academic' | 'german-standard' | 'europass';
export type CVContentLanguage = 'de' | 'en' | 'ar';

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  photo?: string;
  email: string;
  phone: string;
  address: string;
  birthDate?: string;
  birthPlace?: string;
  nationality?: string;
  linkedin?: string;
  github?: string;
}

export interface EducationEntry {
  id: string;
  degree: string;
  institution: string;
  city: string;
  country: string;
  from: string;
  to: string;
  current: boolean;
  details: string[];
}

export interface ExperienceEntry {
  id: string;
  title: string;
  company: string;
  city: string;
  from: string;
  to: string;
  current: boolean;
  bullets: string[];
}

export interface PublicationEntry {
  id: string;
  title: string;
  publisher: string;
  date: string;
  doi?: string;
}

export interface CertificateEntry {
  id: string;
  name: string;
  issuer: string;
  date: string;
}

export interface VolunteerEntry {
  id: string;
  organization: string;
  role: string;
  from: string;
  to: string;
  current: boolean;
}

export interface ReferenceEntry {
  id: string;
  name: string;
  position: string;
  contact: string;
}

export interface LanguageSkill {
  id: string;
  name: string;
  level: string;
  exam?: string;
}

export interface CVData {
  template: CVTemplate;
  contentLanguage: CVContentLanguage;
  personal: PersonalInfo;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  publications: PublicationEntry[];
  certificates: CertificateEntry[];
  skills: {
    languages: LanguageSkill[];
    technical: string[];
    other: string[];
  };
  volunteer: VolunteerEntry[];
  references: ReferenceEntry[];
  showPhoto: boolean;
  showBirthDate: boolean;
}

export const createEmptyCVData = (): CVData => ({
  template: 'german-standard',
  contentLanguage: 'de',
  personal: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    birthDate: '',
    birthPlace: '',
    nationality: '',
    linkedin: '',
    github: '',
  },
  education: [],
  experience: [],
  publications: [],
  certificates: [],
  skills: {
    languages: [],
    technical: [],
    other: [],
  },
  volunteer: [],
  references: [],
  showPhoto: true,
  showBirthDate: true,
});
