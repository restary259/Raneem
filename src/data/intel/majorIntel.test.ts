import { describe, expect, it } from 'vitest';
import { majorsData } from '@/data/majorsData';
import { ALL_MAJOR_INTEL } from './majorIntel';
import { getUniversityRecommendations } from './universityRecommendations';

describe('Major Intelligence coverage', () => {
  const publicMajors = majorsData.flatMap((category) => category.subMajors);
  const publicIds = publicMajors.map((major) => major.id);

  it('covers every public major with a verified intelligence record', () => {
    const records = new Map(ALL_MAJOR_INTEL.map((major) => [major.id, major]));
    const missing = publicIds.filter((id) => {
      const record = records.get(id);
      return !record || record.status !== 'verified' || record.programs.length < 1;
    });

    expect(missing, 'Every public major must have at least one university/programme route.').toEqual([]);
  });

  it('provides at least four ranked university recommendations for every public major', () => {
    for (const id of publicIds) {
      const recommendations = getUniversityRecommendations(id);
      expect(recommendations).toHaveLength(4);
      expect(recommendations.map((item) => item.rank)).toEqual([1, 2, 3, 4]);
      expect(recommendations[0].primary).toBe(true);
      expect(new Set(recommendations.map((item) => item.universityId)).size).toBe(4);
      for (const recommendation of recommendations) {
        expect(recommendation.source.url.startsWith('https://')).toBe(true);
        expect(recommendation.source.authority).toBe('university');
      }

      const exactTU9 = recommendations.filter((item) => item.tu9 && item.match === 'exact');
      expect(exactTU9.length).toBeLessThanOrEqual(1);
      if (exactTU9.length === 1) expect(recommendations[0].tu9).toBe(true);
    }
  });

  it('keeps public major IDs unique', () => {
    expect(new Set(publicIds).size).toBe(publicIds.length);
  });

  it('keeps verified programme records bilingual and directly linkable', () => {
    for (const major of ALL_MAJOR_INTEL.filter((item) => item.status === 'verified')) {
      expect(major.canonicalEN.trim()).toBeTruthy();
      expect(major.canonicalAR.trim()).toBeTruthy();
      expect(major.nameDE.trim()).toBeTruthy();
      expect(major.aliases.en.length).toBeGreaterThan(0);
      expect(major.aliases.ar.length).toBeGreaterThan(0);
      expect(major.sources.length).toBeGreaterThanOrEqual(3);

      for (const program of major.programs) {
        expect(program.universityName.trim()).toBeTruthy();
        expect(program.universityNameAR.trim()).toBeTruthy();
        expect(program.programName.trim()).toBeTruthy();
        expect(program.programNameAR.trim()).toBeTruthy();
        expect(program.programUrl.startsWith('https://')).toBe(true);

        if (program.languageRequirement.status === 'verified' && program.languageRequirement.value) {
          expect(['German', 'English']).toContain(program.languageRequirement.value.language);
          expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).toContain(
            program.languageRequirement.value.minimumLevel,
          );
          expect(program.languageRequirement.value.certificates.length).toBeGreaterThan(0);
        }
      }
    }
  });
  it('never exposes a non-TU9 primary when an exact TU9 route is explicitly ranked', () => {
    for (const major of ALL_MAJOR_INTEL) {
      const recommendations = getUniversityRecommendations(major.id);
      if (recommendations.length === 0) continue;
      const exactTU9 = recommendations.filter((item) => item.tu9 && item.match === 'exact');
      if (exactTU9.length > 0) {
        expect(recommendations[0].tu9).toBe(true);
      }
    }
  });

});
