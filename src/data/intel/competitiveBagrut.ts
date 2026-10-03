/**
 * DARB competitive Bagrut planning benchmarks.
 *
 * These are internal planning indicators for Team use. They are not official
 * university admission cutoffs and must not be presented as guarantees.
 */
import type { IntelSource, VerifiedFact } from './factTypes';
import { fact } from './factTypes';

export const COMPETITIVE_BGRUT_SOURCE: IntelSource = {
  id: 'darb-reference-pdf-competitive-bagrut',
  url: 'https://github.com/restary259/Raneem/blob/main/docs/major-intel/competitive-bagrut-benchmarks.md',
  title: 'DARB internal benchmark register — competitive Bagrut planning indicators',
  titleAR: 'درب — سجل المؤشرات الداخلية للتخطيط: معدل البجروت التنافسي',
  authority: 'darb',
  checkedAt: '2026-09-25',
};

/**
 * Group benchmarks requested for internal applicant-profile screening.
 * Special programme groups retain their more specific benchmark.
 */
export const COMPETITIVE_BGRUT_BY_MAJOR = {
  // Health / medical group
  medicine: 94,
  dentistry: 94,
  pharmacy: 94,
  'public-health': 94,
  bioinformatics: 94,

  // Special health benchmark
  veterinary: 89,

  // Hard / core engineering
  'mechanical-engineering': 80,
  'civil-engineering': 80,
  'electrical-engineering': 80,
  'electrical-it': 80,
  'chemical-engineering': 80,
  'aerospace-engineering': 80,
  'space-engineering': 80,
  'biomedical-engineering': 80,

  // Standard engineering / computing
  'renewable-energy': 75,
  'software-engineering': 75,
  'industrial-engineering': 75,
  'computer-science': 75,

  // Other existing benchmarks
  architecture: 70,
  'international-law': 90,
  'business-administration': 75,
  economics: 75,

  // Additional university-route majors — DARB category-average heuristic.
  // These are operational screening indicators, not official admission cutoffs.
  physiotherapy: 93,
  nursing: 93,

  // Engineering & Technology — average of the existing engineering benchmarks.
  'computer-engineering': 79,
  'environmental-engineering': 79,
  // Verified engineering majors whose registry ids differ from the legacy
  // engineering group ids above; same engineering-category average (79).
  'electrical-engineering-information-technology': 79,
  'environmental-protection-engineering': 79,
  'materials-science': 79,

  // Computer Science & IT — existing computing benchmark.
  'artificial-intelligence': 75,
  cybersecurity: 75,
  'data-science': 75,
  'cloud-computing': 75,
  'game-development': 75,
  'information-management': 75,

  // Categories without an existing subject-specific benchmark in the register
  // use the rounded overall DARB benchmark average (82.23 → 83).
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

  // Arts & Design — uses the existing Architecture benchmark as the
  // category proxy because no other arts benchmark exists in the register.
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

  // Culinary Arts is treated as an Ausbildung route, not a university major.
  // It intentionally has no competitive Bagrut planning benchmark.
} as const;

/** Evidence/provenance for each registered DARB planning indicator. */

export const COMPETITIVE_BGRUT_EVIDENCE_BY_MAJOR = {
  architecture: 'DARB supplied reference — Report.pdf 2, page 1',
  'mechanical-engineering': 'DARB group planning benchmark — hard/core engineering',
  'computer-science': 'DARB supplied reference — Report.pdf 2, page 3',
  medicine: 'DARB supplied reference — Report.pdf.pdf, page 1',
  pharmacy: 'DARB group planning benchmark — health/medical group',
  dentistry: 'DARB supplied reference — Report.pdf.pdf, page 3',
  veterinary: 'DARB supplied reference — Report.pdf.pdf, page 4',
  'international-law': 'DARB supplied reference — Report.pdf 3, page 1',
  'business-administration': 'DARB supplied reference — Report.pdf 3, page 3',
  economics: 'DARB supplied reference — Report.pdf 3, page 4',
  'public-health': 'DARB group planning benchmark — health/medical group',
  bioinformatics: 'DARB group planning benchmark — health/medical group',
  'civil-engineering': 'DARB group planning benchmark — hard/core engineering',
  'electrical-engineering': 'DARB group planning benchmark — hard/core engineering',
  'electrical-it': 'DARB group planning benchmark — hard/core engineering',
  'chemical-engineering': 'DARB group planning benchmark — hard/core engineering',
  'aerospace-engineering': 'DARB group planning benchmark — hard/core engineering',
  'space-engineering': 'DARB group planning benchmark — hard/core engineering',
  'biomedical-engineering': 'DARB group planning benchmark — hard/core engineering',
  'renewable-energy': 'DARB group planning benchmark — standard engineering/computing',
  'software-engineering': 'DARB group planning benchmark — standard engineering/computing',
  'industrial-engineering': 'DARB group planning benchmark — standard engineering/computing',

  'physiotherapy': 'DARB health-category average heuristic (existing health benchmarks: 94/89)',
  'nursing': 'DARB health-category average heuristic (existing health benchmarks: 94/89)',
  'computer-engineering': 'DARB engineering-category average heuristic (existing engineering benchmarks)',
  'environmental-engineering': 'DARB engineering-category average heuristic (existing engineering benchmarks)',
  'electrical-engineering-information-technology': 'DARB engineering-category average heuristic (existing engineering benchmarks)',
  'environmental-protection-engineering': 'DARB engineering-category average heuristic (existing engineering benchmarks)',
  'materials-science': 'DARB engineering-category average heuristic (existing engineering benchmarks)',
  'artificial-intelligence': 'DARB computing-category benchmark heuristic (computer science baseline: 75)',
  'cybersecurity': 'DARB computing-category benchmark heuristic (computer science baseline: 75)',
  'data-science': 'DARB computing-category benchmark heuristic (computer science baseline: 75)',
  'cloud-computing': 'DARB computing-category benchmark heuristic (computer science baseline: 75)',
  'game-development': 'DARB computing-category benchmark heuristic (computer science baseline: 75)',
  'information-management': 'DARB computing-category benchmark heuristic (computer science baseline: 75)',
  'environmental-science': 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  mathematics: 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  physics: 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  chemistry: 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  biology: 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  psychology: 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  sociology: 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  'political-science': 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  philosophy: 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  'social-work': 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  linguistics: 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  'media-communication': 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  history: 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  'international-business': 'DARB business-category average heuristic (Business Administration/Economics: 75)',
  marketing: 'DARB business-category average heuristic (Business Administration/Economics: 75)',
  'finance-accounting': 'DARB business-category average heuristic (Business Administration/Economics: 75)',
  entrepreneurship: 'DARB business-category average heuristic (Business Administration/Economics: 75)',
  'supply-chain': 'DARB business-category average heuristic (Business Administration/Economics: 75)',
  'human-resources': 'DARB business-category average heuristic (Business Administration/Economics: 75)',
  'criminal-law': 'DARB law-category proxy heuristic (International Law: 90)',
  'business-law': 'DARB law-category proxy heuristic (International Law: 90)',
  'fine-arts': 'DARB arts-category proxy heuristic (Architecture: 70)',
  'graphic-design': 'DARB arts-category proxy heuristic (Architecture: 70)',
  music: 'DARB arts-category proxy heuristic (Architecture: 70)',
  theater: 'DARB arts-category proxy heuristic (Architecture: 70)',
  'film-media': 'DARB arts-category proxy heuristic (Architecture: 70)',
  'elementary-education': 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  'special-education': 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  'educational-psychology': 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  'curriculum-instruction': 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  'educational-administration': 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  'agricultural-science': 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  'environmental-management': 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  forestry: 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  'marine-science': 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  'sustainable-development': 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  'tourism-management': 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  'hotel-management': 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  'event-management': 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
  'travel-tourism': 'DARB overall-average fallback heuristic (22 known benchmarks average: 82.23)',
} as const;

const NOTE_EN =
  'Internal DARB planning indicator for applicant-profile screening. It is not an official university cutoff or a guarantee of admission. Check the named programme requirements separately.';
const NOTE_AR =
  'مؤشر تخطيط داخلي من درب لتقييم ملف الطالب. ليس حداً رسمياً للقبول الجامعي ولا ضماناً للقبول. يجب التحقق من شروط البرنامج المحدد بشكل منفصل.';

export function competitiveBagrutForMajor(
  majorId: string,
): VerifiedFact<number> | undefined {
  const value = COMPETITIVE_BGRUT_BY_MAJOR[majorId as keyof typeof COMPETITIVE_BGRUT_BY_MAJOR];
  if (value === undefined) return undefined;

  return fact(
    value,
    'DARB_OPERATIONAL_GUIDANCE',
    COMPETITIVE_BGRUT_SOURCE.id,
    COMPETITIVE_BGRUT_SOURCE.checkedAt,
    {
      note: NOTE_EN,
      noteAR: NOTE_AR,
      evidenceRef: COMPETITIVE_BGRUT_EVIDENCE_BY_MAJOR[
        majorId as keyof typeof COMPETITIVE_BGRUT_EVIDENCE_BY_MAJOR
      ],
    },
  );
}
