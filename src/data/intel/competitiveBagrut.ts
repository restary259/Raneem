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
} as const;

/** Exact source-page references exist only for the original supplied figures. */
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
