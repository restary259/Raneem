import { describe, expect, it } from 'vitest';
import { ALL_MAJOR_INTEL } from './majorIntel';
import {
  COMPETITIVE_BGRUT_BY_MAJOR,
  COMPETITIVE_BGRUT_EVIDENCE_BY_MAJOR,
  COMPETITIVE_BGRUT_SOURCE,
  competitiveBagrutForMajor,
} from './competitiveBagrut';

const EXPECTED = {
  medicine: 94,
  dentistry: 94,
  pharmacy: 94,
  'public-health': 94,
  bioinformatics: 94,
  veterinary: 89,
  'mechanical-engineering': 80,
  'civil-engineering': 80,
  'electrical-engineering': 80,
  'electrical-it': 80,
  'chemical-engineering': 80,
  'aerospace-engineering': 80,
  'space-engineering': 80,
  'biomedical-engineering': 80,
  'renewable-energy': 75,
  'software-engineering': 75,
  'industrial-engineering': 75,
  'computer-science': 75,
  architecture: 70,
  'international-law': 90,
  'business-administration': 75,
  economics: 75,
  physiotherapy: 93,
  nursing: 93,
  'computer-engineering': 79,
  'environmental-engineering': 79,
  'electrical-engineering-information-technology': 79,
  'environmental-protection-engineering': 79,
  'materials-science': 79,
  'artificial-intelligence': 75,
  cybersecurity: 75,
  'data-science': 75,
  'cloud-computing': 75,
  'game-development': 75,
  'information-management': 75,
  'environmental-science': 83,
  mathematics: 83,
  physics: 83,
  chemistry: 83,
  biology: 83,
  psychology: 83,
  sociology: 83,
  'political-science': 83,
  philosophy: 83,
  'social-work': 83,
  linguistics: 83,
  'media-communication': 83,
  history: 83,
  'international-business': 75,
  marketing: 75,
  'finance-accounting': 75,
  entrepreneurship: 75,
  'supply-chain': 75,
  'human-resources': 75,
  'criminal-law': 90,
  'business-law': 90,
  'fine-arts': 70,
  'graphic-design': 70,
  music: 70,
  theater: 70,
  'film-media': 70,
  'elementary-education': 83,
  'special-education': 83,
  'educational-psychology': 83,
  'curriculum-instruction': 83,
  'educational-administration': 83,
  'agricultural-science': 83,
  'environmental-management': 83,
  forestry: 83,
  'marine-science': 83,
  'sustainable-development': 83,
  'tourism-management': 83,
  'hotel-management': 83,
  'event-management': 83,
  'travel-tourism': 83,
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
      expect(fact?.evidenceRef).toBe(
        COMPETITIVE_BGRUT_EVIDENCE_BY_MAJOR[
          majorId as keyof typeof COMPETITIVE_BGRUT_EVIDENCE_BY_MAJOR
        ],
      );
    }
  });

  it('does not invent benchmarks for unregistered majors', () => {
    expect(competitiveBagrutForMajor('unknown-major')).toBeUndefined();
  });

  it('covers every verified university-route major and excludes Culinary Arts', () => {
    const missing = ALL_MAJOR_INTEL
      .filter((major) => major.status === 'verified')
      .filter((major) => !major.competitiveBagrutThreshold)
      .map((major) => major.id);

    expect(missing).toEqual(['culinary-arts']);
    expect(competitiveBagrutForMajor('culinary-arts')).toBeUndefined();
  });
});
