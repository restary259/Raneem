/**
 * DARB Major Intelligence — domain shapes for majors and university programmes.
 * Requirements are always structured; never a free-text paragraph.
 */
import type { IntelSource, VerifiedFact } from './factTypes';

export type DegreeLevel = 'bachelor' | 'master' | 'staatsexamen';

export type AdmissionMode =
  | 'open'
  | 'nc'
  | 'aptitude_test'
  | 'selection_procedure'
  | 'unknown';

export type ApplicationChannel =
  | 'university'
  | 'uni_assist'
  | 'hochschulstart'
  | 'other';

export type GermanLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const GERMAN_LEVEL_ORDER: GermanLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export interface SubjectRequirement {
  /** Canonical subject key used by the intake form. */
  subject: 'mathematics' | 'english' | 'further_subject' | 'physics' | 'biology' | 'chemistry';
  units?: number;
  minimumGrade?: number;
  /** Free-text label shown in the requirement column (EN / AR). */
  label: string;
  labelAR: string;
}

export interface LanguageRequirementValue {
  /** Primary language for the programme requirement. */
  language: 'German' | 'English';
  minimumLevel: GermanLevel;
  /** Certificate names exactly as the university lists them. */
  certificates: string[];
  /** Optional additional language requirement, e.g. English B1 alongside German. */
  additionalLanguage?: {
    language: 'German' | 'English';
    minimumLevel: GermanLevel;
    certificates: string[];
  };
}

export interface GradeRequirementValue {
  /** Converted German grade the applicant must reach or better (lower is better). */
  maximumGermanGrade?: number;
  /** Published NC of a past round, when the university publishes one. */
  publishedNC?: string;
  /** Alternative route when the grade is not reached (e.g. TestAS). */
  compensation?: string;
  compensationAR?: string;
}

export interface DeadlineValue {
  semester: string;
  semesterAR: string;
  deadline: string;
}

export interface ProgramIntel {
  id: string;
  universityName: string;
  universityNameAR: string;
  city: string;
  cityAR: string;
  programName: string;
  programNameDE: string;
  programNameAR: string;
  degreeLevel: DegreeLevel;

  teachingLanguage: VerifiedFact<string[]>;
  admissionMode: VerifiedFact<AdmissionMode>;
  applicationChannel: VerifiedFact<ApplicationChannel>;
  /** How the Israeli Bagrut is recognised for this programme. */
  foreignQualification: VerifiedFact<string>;
  subjectRequirements: VerifiedFact<SubjectRequirement[]>;
  languageRequirement: VerifiedFact<LanguageRequirementValue>;
  gradeRequirement: VerifiedFact<GradeRequirementValue>;
  entranceRequirement: VerifiedFact<string>;
  deadline: VerifiedFact<DeadlineValue>;
  documents: VerifiedFact<string[]>;
  /** Tuition / fee notes that are officially published. */
  fees?: VerifiedFact<string>;
  programUrl: string;
  lastVerified: string;
}

export interface MajorAliases {
  ar: string[];
  he: string[];
  en: string[];
  de: string[];
}

export type RecommendationMatch = 'exact' | 'related';

export interface UniversityRecommendation {
  universityId: string;
  rank: 1 | 2 | 3 | 4;
  primary: boolean;
  tu9: boolean;
  match: RecommendationMatch;
  focus: string;
  focusAR: string;
  source: IntelSource;
}

export interface MajorIntel {
  id: string;
  canonicalEN: string;
  canonicalAR: string;
  nameDE: string;
  degreeLevel: DegreeLevel;
  aliases: MajorAliases;
  /** `not_verified` majors render an honest empty state, never public prose. */
  status: 'verified' | 'not_verified';
  lastVerified?: string;
  /** DARB-ranked university recommendations shown to the team. */
  universityRecommendations?: UniversityRecommendation[];
  /** Nationwide Bagrut access rule (anabin). */
  bagrutAccess?: VerifiedFact<{ mathUnits: number; englishUnits: number; furtherUnits: number }>;
  /** The conversion formula itself — a procedure, not an admission decision. */
  gradeConversion?: VerifiedFact<string>;
  /** Field-level language picture; each programme still carries its own. */
  language?: VerifiedFact<LanguageRequirementValue>;
  programs: ProgramIntel[];
  sources: IntelSource[];
}
