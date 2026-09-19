import { describe, expect, it } from 'vitest';
import { majorsData } from '@/data/majorsData';
import { ALL_MAJOR_INTEL } from './majorIntel';

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
});
