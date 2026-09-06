
import { SubMajor } from '@/data/majorsData';

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

export const getLocalizedMajor = (major: SubMajor, lang: string): LocalizedMajor => ({
  ...major,
  name: lang === 'en' ? (major.nameEN || major.nameAR) : major.nameAR,
  desc: lang === 'en' ? (major.descriptionEN || major.description) : major.description,
  detailedDesc: lang === 'en'
    ? (major.detailedDescriptionEN || major.descriptionEN || major.detailedDescription || major.description)
    : (major.detailedDescription || major.description),
  localizedDuration: lang === 'en' ? (major.durationEN || major.duration || '') : (major.duration || ''),
  localizedCareerProspects: lang === 'en' ? (major.careerProspectsEN || major.careerProspects || '') : (major.careerProspects || ''),
  localizedRequirements: lang === 'en' ? (major.requirementsEN || major.requirements || '') : (major.requirements || ''),
  localizedSuitableFor: lang === 'en' ? (major.suitableForEN || major.suitableFor || '') : (major.suitableFor || ''),
  localizedRequiredBackground: lang === 'en' ? (major.requiredBackgroundEN || major.requiredBackground || '') : (major.requiredBackground || ''),
  localizedLanguageRequirements: lang === 'en' ? (major.languageRequirementsEN || major.languageRequirements || '') : (major.languageRequirements || ''),
  localizedCareerOpportunities: lang === 'en' ? (major.careerOpportunitiesEN || major.careerOpportunities || '') : (major.careerOpportunities || ''),
  localizedArab48Notes: lang === 'en' ? (major.arab48NotesEN || major.arab48Notes || '') : (major.arab48Notes || ''),
});

export const getLocalizedCategoryTitle = (title: string, titleEN: string | undefined, lang: string): string => {
  return lang === 'en' ? (titleEN || title) : title;
};

export interface LocalizedTiers {
  official: string[];
  universitySpecific: string[];
  darbGuidance: string[];
}

/** Picks the AR or EN side of the tiered requirements. Returns null when absent. */
export const getLocalizedTiers = (major: SubMajor, lang: string): LocalizedTiers | null => {
  const t = major.requirementTiers;
  if (!t) return null;
  const en = lang === 'en';
  return {
    official: en ? t.officialEN : t.official,
    universitySpecific: en ? t.universitySpecificEN : t.universitySpecific,
    darbGuidance: en ? t.darbGuidanceEN : t.darbGuidance,
  };
};

export interface LocalizedSource {
  title: string;
  url: string;
  verifies: string;
  checked: string;
}

/** Localized source list (AR falls back to EN when no Arabic copy exists). */
export const getLocalizedSources = (major: SubMajor, lang: string): LocalizedSource[] =>
  (major.sources ?? []).map((s) => ({
    title: lang === 'en' ? s.title : (s.titleAR || s.title),
    url: s.url,
    verifies: lang === 'en' ? s.verifies : (s.verifiesAR || s.verifies),
    checked: s.checked,
  }));
