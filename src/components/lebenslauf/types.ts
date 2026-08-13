export type CVTemplate = 'academic' | 'german-standard' | 'europass' | 'modern-sidebar';
export type CVContentLanguage = 'de' | 'en' | 'ar';

/** Body / heading / date font presets keyed by a stable id. */
export type CVFontKey = 'inter' | 'source-sans' | 'ibm-plex-sans' | 'arial' | 'georgia' | 'source-serif' | 'merriweather' | 'ibm-plex-mono';
export type CVSpacing = 'compact' | 'normal' | 'relaxed';
export type CVSignatureMode = 'none' | 'line' | 'image';

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  /** Professional title / subtitle, e.g. "Wirtschaftsingenieurwesen (B.Eng.)" */
  professionalTitle?: string;
  photo?: string;
  email: string;
  phone: string;
  address: string;
  birthDate?: string;
  birthPlace?: string;
  nationality?: string;
  linkedin?: string;
  github?: string;
  website?: string;
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
  /** Program / major, e.g. "Informatik (B.Sc.)" */
  program?: string;
  /** Focus / specialization */
  focus?: string;
  /** Final grade / GPA, e.g. "1,7" or "3.8/4.0" */
  grade?: string;
  /** Expected graduation date (when `current`) */
  expectedGraduation?: string;
  /** Relevant coursework */
  coursework?: string[];
  /** Thesis / final project title + optional note */
  thesis?: string;
  /** Academic achievements / honors */
  achievements?: string[];
  /** Free-form additional details */
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

export interface ProjectEntry {
  id: string;
  name: string;
  role?: string;
  description?: string;
  url?: string;
  date?: string;
  bullets: string[];
}

export interface AwardEntry {
  id: string;
  title: string;
  issuer?: string;
  date?: string;
  description?: string;
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

/** Optional Ort / Datum / Unterschrift block for a formal German Lebenslauf. */
export interface SignatureSettings {
  mode: CVSignatureMode;
  /** Ort (place) */
  place?: string;
  /** Datum — ISO date or free text */
  date?: string;
  /** Scanned signature image data URL (mode === 'image') */
  image?: string;
}

/**
 * Centralized design tokens — CONTENT is separate from DESIGN. Templates read
 * these via CSS custom properties; body text always stays black/dark-gray for
 * readability regardless of the accent color.
 */
export interface CVDesignSettings {
  /** Hex accent color (headings, rules, timeline). */
  accent: string;
  /** Body font key. */
  font: CVFontKey;
  /** Heading font key. */
  headingFont: CVFontKey;
  /** Date/metadata mono font key (optional). */
  dateFont: CVFontKey;
  /** Spacing density. */
  spacing: CVSpacing;
  /** Active preset id (for the Customize panel). */
  preset: string;
}

/** Ordered, toggleable sections — the student picks what to include. */
export type CVSectionKey =
  | 'summary'
  | 'education'
  | 'experience'
  | 'projects'
  | 'publications'
  | 'awards'
  | 'skills'
  | 'certificates'
  | 'volunteer'
  | 'references';

export interface CVData {
  template: CVTemplate;
  contentLanguage: CVContentLanguage;
  personal: PersonalInfo;
  /** Short professional profile / summary. */
  summary?: string;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  publications: PublicationEntry[];
  awards: AwardEntry[];
  certificates: CertificateEntry[];
  skills: {
    languages: LanguageSkill[];
    technical: string[];
    other: string[];
    /** Free-text interests / hobbies */
    interests: string[];
  };
  volunteer: VolunteerEntry[];
  references: ReferenceEntry[];
  showPhoto: boolean;
  showBirthDate: boolean;
  signature: SignatureSettings;
  design: CVDesignSettings;
  /** Visible sections, in display order. */
  sectionOrder: CVSectionKey[];
}

export const DEFAULT_DESIGN: CVDesignSettings = {
  accent: '#1B2430',
  font: 'inter',
  headingFont: 'inter',
  dateFont: 'ibm-plex-mono',
  spacing: 'normal',
  preset: 'classic-black',
};

/** Canonical section order with all keys present. */
export const ALL_SECTIONS: CVSectionKey[] = [
  'summary', 'education', 'experience', 'projects', 'publications',
  'awards', 'skills', 'certificates', 'volunteer', 'references',
];

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
    website: '',
  },
  summary: '',
  education: [],
  experience: [],
  projects: [],
  publications: [],
  awards: [],
  certificates: [],
  skills: {
    languages: [],
    technical: [],
    other: [],
    interests: [],
  },
  volunteer: [],
  references: [],
  showPhoto: true,
  showBirthDate: true,
  signature: { mode: 'none' },
  design: { ...DEFAULT_DESIGN },
  sectionOrder: [...ALL_SECTIONS],
});
