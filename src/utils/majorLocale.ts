
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
