import { describe, it, expect } from 'vitest';
import { majorsData, SubMajor } from './majorsData';

const AR_EN_PAIRS: Array<[keyof SubMajor, keyof SubMajor]> = [
  ['nameAR', 'nameEN'],
  ['description', 'descriptionEN'],
  ['duration', 'durationEN'],
  ['detailedDescription', 'detailedDescriptionEN'],
  ['careerProspects', 'careerProspectsEN'],
  ['requirements', 'requirementsEN'],
  ['suitableFor', 'suitableForEN'],
  ['requiredBackground', 'requiredBackgroundEN'],
  ['languageRequirements', 'languageRequirementsEN'],
  ['careerOpportunities', 'careerOpportunitiesEN'],
  ['arab48Notes', 'arab48NotesEN'],
];

// Standards and credentials that must appear identically (Latin script) in both
// the Arabic and English fields. University names are intentionally excluded:
// the Arabic copy legitimately localizes them (e.g. جامعة سارلاند for Saarland).
const SHARED_TERMS = [
  'anabin',
  'uni-assist',
  'DSH-2',
  'TestDaF',
  'IELTS',
  'C1',
  'NC',
  'Bitkom',
  'get-in-it',
];

const numbers = (s: string): string[] =>
  (s.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/,/g, '').replace(/\.$/, ''));

const sorted = (xs: string[]): string[] => [...xs].sort();

describe('majorsData Arabic/English parity', () => {
  const allMajors = majorsData.flatMap((c) =>
    c.subMajors.map((m) => ({ category: c.id, major: m })),
  );

  it('contains at least one category with majors', () => {
    expect(allMajors.length).toBeGreaterThan(0);
  });

  for (const { category, major } of allMajors) {
    describe(`${category}/${major.id}`, () => {
      for (const [arKey, enKey] of AR_EN_PAIRS) {
        it(`${arKey} / ${enKey} stay in sync`, () => {
          const ar = major[arKey];
          const en = major[enKey];
          // Both present or both absent.
          expect(Boolean(ar), `${arKey} present without ${enKey}`).toBe(Boolean(en));
          if (!ar || !en) return;
          // Identical numeric content (salaries, durations, unit counts).
          expect(sorted(numbers(en)), `numbers differ between ${arKey} and ${enKey}`).toEqual(
            sorted(numbers(ar)),
          );
          // Shared proper nouns / standards appear on both sides.
          for (const term of SHARED_TERMS) {
            expect(ar.includes(term), `term "${term}" in ${arKey} but not ${enKey}`).toBe(
              en.includes(term),
            );
          }
        });
      }
    });
  }
});
