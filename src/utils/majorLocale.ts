
import { SubMajor } from '@/data/majorsData';
import { isArabicUi } from '@/lib/localeData';

/**
 * Localizes a major for the active UI language.
 *
 * The dataset is AR/EN only, so Arabic is the single language that reads the
 * Arabic side; every other language — Hebrew included — reads English. See
 * `isArabicUi`.
 */
export interface LocalizedMajor extends SubMajor {
  name: string;
  desc: string;
  detailedDesc: string;
  localizedDuration: string;
  localizedCareerProspects: string;
  localizedRequirements: string;
  localizedSuitableFor: string;
  localizedRequiredBackground: string;
  localizedLanguageRequirements: string;
  localizedCareerOpportunities: string;
  localizedArab48Notes: string;
}

export const getLocalizedMajor = (major: SubMajor, lang: string): LocalizedMajor => {
  const ar = isArabicUi(lang);
  return {
    ...major,
    name: ar ? major.nameAR : (major.nameEN || major.nameAR),
    desc: ar ? major.description : (major.descriptionEN || major.description),
    detailedDesc: ar
      ? (major.detailedDescription || major.description)
      : (major.detailedDescriptionEN || major.descriptionEN || major.detailedDescription || major.description),
    localizedDuration: ar ? (major.duration || '') : (major.durationEN || major.duration || ''),
    localizedCareerProspects: ar ? (major.careerProspects || '') : (major.careerProspectsEN || major.careerProspects || ''),
    localizedRequirements: ar ? (major.requirements || '') : (major.requirementsEN || major.requirements || ''),
    localizedSuitableFor: ar ? (major.suitableFor || '') : (major.suitableForEN || major.suitableFor || ''),
    localizedRequiredBackground: ar ? (major.requiredBackground || '') : (major.requiredBackgroundEN || major.requiredBackground || ''),
    localizedLanguageRequirements: ar ? (major.languageRequirements || '') : (major.languageRequirementsEN || major.languageRequirements || ''),
    localizedCareerOpportunities: ar ? (major.careerOpportunities || '') : (major.careerOpportunitiesEN || major.careerOpportunities || ''),
    localizedArab48Notes: ar ? (major.arab48Notes || '') : (major.arab48NotesEN || major.arab48Notes || ''),
  };
};

export const getLocalizedCategoryTitle = (title: string, titleEN: string | undefined, lang: string): string => {
  return isArabicUi(lang) ? title : (titleEN || title);
};

export interface LocalizedTiers {
  official: string[];
  universitySpecific: string[];
  darbGuidance: string[];
}

/** Picks the Arabic or English side of the tiered requirements. Returns null when absent. */
export const getLocalizedTiers = (major: SubMajor, lang: string): LocalizedTiers | null => {
  const t = major.requirementTiers;
  if (!t) return null;
  const ar = isArabicUi(lang);
  return {
    official: ar ? t.official : t.officialEN,
    universitySpecific: ar ? t.universitySpecific : t.universitySpecificEN,
    darbGuidance: ar ? t.darbGuidance : t.darbGuidanceEN,
  };
};

export interface LocalizedSource {
  title: string;
  url: string;
  verifies: string;
  checked: string;
}

/**
 * Localized source list. `title`/`verifies` are English by default, so the
 * non-Arabic side falls back to them rather than to the Arabic translation.
 */
export const getLocalizedSources = (major: SubMajor, lang: string): LocalizedSource[] =>
  (major.sources ?? []).map((s) => {
    const ar = isArabicUi(lang);
    return {
      title: ar ? (s.titleAR || s.title) : s.title,
      url: s.url,
      verifies: ar ? (s.verifiesAR || s.verifies) : s.verifies,
      checked: s.checked,
    };
  });

export interface LocalizedGlance {
  degree: string;
  admissionMode: string;
  applicationChannel: string;
}

export const getLocalizedGlance = (major: SubMajor, lang: string): LocalizedGlance | null => {
  const g = major.glance;
  if (!g) return null;
  const ar = isArabicUi(lang);
  return {
    degree: ar ? g.degree : g.degreeEN,
    admissionMode: ar ? g.admissionMode : g.admissionModeEN,
    applicationChannel: ar ? g.applicationChannel : g.applicationChannelEN,
  };
};

export interface LocalizedLanguageProfile {
  teachingLanguage: string;
  requiredLevel: string;
  acceptedCertificates: string[];
  exceptions: string[];
  englishOption: string;
}

export const getLocalizedLanguageProfile = (major: SubMajor, lang: string): LocalizedLanguageProfile | null => {
  const l = major.languageProfile;
  if (!l) return null;
  const ar = isArabicUi(lang);
  return {
    teachingLanguage: ar ? l.teachingLanguage : l.teachingLanguageEN,
    requiredLevel: ar ? l.requiredLevel : l.requiredLevelEN,
    acceptedCertificates: ar ? l.acceptedCertificates : l.acceptedCertificatesEN,
    exceptions: (ar ? l.exceptions : l.exceptionsEN) ?? [],
    englishOption: ar ? l.englishOption : l.englishOptionEN,
  };
};
