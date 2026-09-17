import { describe, expect, it } from 'vitest';
import { journeyAvailability } from './journey';
import { COMPUTER_SCIENCE_INTEL } from '@/data/intel/computerScience';
import type { MajorIntel } from '@/data/intel/types';

const stub: MajorIntel = {
  id: 'stub',
  canonicalEN: 'Stub',
  canonicalAR: 'وهمي',
  nameDE: '',
  degreeLevel: 'bachelor',
  aliases: { ar: [], he: [], en: [], de: [] },
  status: 'not_verified',
  programs: [],
  sources: [],
};

describe('journeyAvailability', () => {
  it('disables every step without a major', () => {
    const map = journeyAvailability(null, undefined);
    expect(Object.values(map).every((v) => v === false)).toBe(true);
  });

  it('disables programme steps for an unverified major', () => {
    const map = journeyAvailability(stub, undefined);
    expect(map.universities).toBe(false);
    expect(map.documents).toBe(false);
  });

  it('enables the steps a verified programme covers', () => {
    const map = journeyAvailability(COMPUTER_SCIENCE_INTEL, COMPUTER_SCIENCE_INTEL.programs[0], true);
    expect(map.major).toBe(true);
    expect(map.universities).toBe(true);
    expect(map.documents).toBe(true);
    expect(map.deadlines).toBe(true);
    expect(map.after).toBe(true);
  });

  it('only enables after-admission when guidance exists', () => {
    const map = journeyAvailability(COMPUTER_SCIENCE_INTEL, COMPUTER_SCIENCE_INTEL.programs[0], false);
    expect(map.after).toBe(false);
  });
});
