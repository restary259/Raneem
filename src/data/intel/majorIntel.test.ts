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
      const exactRoutes = recommendations.filter((item) => item.match === 'exact');
      for (const recommendation of exactRoutes) {
        expect(recommendation.linkKind).toBe('programme');
        expect(recommendation.linkCheckedAt).toBeTruthy();
        expect(recommendation.programUrl).toMatch(/^https:\/\//);
      }

      const bwRecommendations = recommendations.filter((item) => item.tuition.kind === 'bw_non_eu');
      for (const recommendation of bwRecommendations) {
        expect(recommendation.tuition.amount).toBe('€1,500 / semester');
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

      expect(major.bagrutAccess?.status).toBe('verified');
      expect(major.bagrutAccess?.value).toEqual({
        mathUnits: 3,
        englishUnits: 4,
        furtherUnits: 4,
      });

      for (const program of major.programs) {
        expect(program.universityName.trim()).toBeTruthy();
        expect(program.universityNameAR.trim()).toBeTruthy();
        expect(program.programName.trim()).toBeTruthy();
        expect(program.programNameAR.trim()).toBeTruthy();
        expect(program.programUrl.startsWith('https://')).toBe(true);
        expect(program.foreignQualification.status).toBe('verified');
        expect(program.subjectRequirements.status).toBe('verified');
        expect(program.subjectRequirements.value).toEqual(expect.arrayContaining([
          expect.objectContaining({ subject: 'mathematics', units: 3 }),
          expect.objectContaining({ subject: 'english', units: 4 }),
          expect.objectContaining({ subject: 'further_subject', units: 4 }),
        ]));
        expect(program.languageRequirement.status).toBe('verified');
        expect(program.languageRequirement.value).not.toBeNull();

        if (program.languageRequirement.status === 'verified' && program.languageRequirement.value) {
          expect(['German', 'English']).toContain(program.languageRequirement.value.language);
          expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).toContain(
            program.languageRequirement.value.minimumLevel,
          );
          expect(program.languageRequirement.value.certificates.length).toBeGreaterThan(0);
        }

        if (program.languageRequirement.factType === 'DARB_OPERATIONAL_GUIDANCE') {
          expect(program.languageRequirement.value?.language).toBe('German');
          expect(program.languageRequirement.value?.minimumLevel).toBe('C1');
          expect(program.languageRequirement.sourceId).toBeNull();
        }

        if (program.deadline.status === 'unverified') {
          expect(program.standardApplicationDeadline?.status).toBe('verified');
          expect(program.standardApplicationDeadline?.factType).toBe('DARB_OPERATIONAL_GUIDANCE');
          expect(program.standardApplicationDeadline?.value?.deadline).toContain('15.07.');
          expect(program.standardApplicationDeadline?.value?.deadline).toContain('15.01.');
        }
      }
    }
  });
});

describe('university website links', () => {
  it('every shown university with a listed homepage resolves to https and its own domain', async () => {
    const { getUniversityWebsite, UNIVERSITY_WEBSITES } = await import('./universityWebsites');
    const { getRecommendedUniversityMeta } = await import('./universityRecommendations');
    const { ALL_MAJOR_INTEL } = await import('./majorIntel');
    expect(Object.keys(UNIVERSITY_WEBSITES)).toHaveLength(59);
    for (const url of Object.values(UNIVERSITY_WEBSITES)) expect(url.startsWith('https://')).toBe(true);
    const missing = new Set<string>();
    for (const m of ALL_MAJOR_INTEL) {
      for (const r of m.universityRecommendations ?? []) {
        const name = getRecommendedUniversityMeta(r.universityId)?.name;
        if (name && !getUniversityWebsite(name)) missing.add(name);
      }
      for (const p of m.programs) {
        if (!getUniversityWebsite(p.universityName)) missing.add(p.universityName);
      }
    }
    expect([...missing]).toEqual([]);
    expect(getUniversityWebsite('Ansbach University of Applied Sciences')).toBe('https://www.hs-ansbach.de/en/');
    expect(getUniversityWebsite('Technische Universität Darmstadt')).toBe('https://www.tu-darmstadt.de');
    expect(getUniversityWebsite('TU Berlin')).toBe('https://www.tu.berlin/en');
  });
});
