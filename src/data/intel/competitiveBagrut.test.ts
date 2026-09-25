import { describe, expect, it } from 'vitest';
import {
  COMPETITIVE_BGRUT_BY_MAJOR,
  COMPETITIVE_BGRUT_EVIDENCE_BY_MAJOR,
  COMPETITIVE_BGRUT_SOURCE,
  competitiveBagrutForMajor,
} from './competitiveBagrut';

const EXPECTED = {
  architecture: 70,
  'mechanical-engineering': 70,
  'computer-science': 75,
  medicine: 94,
  dentistry: 94,
  veterinary: 89,
  pharmacy: 75,
  'international-law': 90,
  'business-administration': 75,
  economics: 75,
} as const;

describe('competitive Bagrut planning benchmarks', () => {
  it('keeps the registered benchmark set stable', () => {
    expect(COMPETITIVE_BGRUT_BY_MAJOR).toEqual(EXPECTED);
  });

  it('marks the benchmark as DARB operational guidance, not an official requirement', () => {
    expect(COMPETITIVE_BGRUT_SOURCE.authority).toBe('darb');
    expect(COMPETITIVE_BGRUT_SOURCE.id).toBe('darb-reference-pdf-competitive-bagrut');
    expect(COMPETITIVE_BGRUT_SOURCE.url).toMatch(/competitive-bagrut-benchmarks\.md$/);

    for (const [majorId, value] of Object.entries(EXPECTED)) {
      const fact = competitiveBagrutForMajor(majorId);
      expect(fact).toMatchObject({
        value,
        factType: 'DARB_OPERATIONAL_GUIDANCE',
        sourceId: COMPETITIVE_BGRUT_SOURCE.id,
        checkedAt: COMPETITIVE_BGRUT_SOURCE.checkedAt,
        status: 'verified',
      });
      expect(fact?.note).toContain('not an official university cutoff');
      expect(fact?.evidenceRef).toBe(COMPETITIVE_BGRUT_EVIDENCE_BY_MAJOR[majorId as keyof typeof COMPETITIVE_BGRUT_EVIDENCE_BY_MAJOR]);
    }
  });

  it('does not invent benchmarks for unregistered majors', () => {
    expect(competitiveBagrutForMajor('unknown-major')).toBeUndefined();
  });
});
