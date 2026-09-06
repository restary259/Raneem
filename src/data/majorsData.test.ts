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
          const ar = major[arKey] as string | undefined;
          const en = major[enKey] as string | undefined;
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

const VERIFIED_CATEGORIES = ['health-medical', 'engineering-technology', 'law'] as const;

describe.each(VERIFIED_CATEGORIES)('%s fact-check metadata', (categoryId) => {
  const health = majorsData.find((c) => c.id === categoryId)!;

  it('every major carries lastVerified, tiers and direct sources', () => {
    for (const m of health.subMajors) {
      expect(m.lastVerified, `${m.id} lastVerified`).toMatch(/^\d{4}-\d{2}$/);
      expect(m.requirementTiers, `${m.id} tiers`).toBeTruthy();
      expect(m.sources?.length ?? 0, `${m.id} sources`).toBeGreaterThanOrEqual(3);
    }
  });

  for (const m of health.subMajors) {
    it(`${m.id}: tier arrays keep AR/EN in sync and sources are direct https pages`, () => {
      const t = m.requirementTiers!;
      expect(t.official.length).toBe(t.officialEN.length);
      expect(t.universitySpecific.length).toBe(t.universitySpecificEN.length);
      expect(t.darbGuidance.length).toBe(t.darbGuidanceEN.length);
      expect(t.official.length).toBeGreaterThan(0);
      for (const s of m.sources!) {
        const u = new URL(s.url);
        expect(u.protocol).toBe('https:');
        expect(u.pathname.length, `${s.url} must not be a homepage`).toBeGreaterThan(1);
        expect(s.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(s.verifies.length).toBeGreaterThan(10);
      }
    });
  }
});

describe.each(VERIFIED_CATEGORIES)('%s glance + language profile', (categoryId) => {
  const health = majorsData.find((c) => c.id === categoryId)!;
  for (const m of health.subMajors) {
    it(`${m.id}: has glance and structured language profile with AR/EN parity`, () => {
      expect(m.glance).toBeTruthy();
      const l = m.languageProfile!;
      expect(l).toBeTruthy();
      expect(l.acceptedCertificates.length).toBe(l.acceptedCertificatesEN.length);
      expect(l.acceptedCertificates.length).toBeGreaterThan(0);
      expect((l.exceptions ?? []).length).toBe((l.exceptionsEN ?? []).length);
      for (const k of ['teachingLanguage', 'requiredLevel', 'englishOption'] as const) {
        expect(l[k].length).toBeGreaterThan(0);
        expect(l[`${k}EN`].length).toBeGreaterThan(0);
      }
    });
  }
});
