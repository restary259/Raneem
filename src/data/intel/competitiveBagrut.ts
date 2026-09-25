/**
 * DARB competitive Bagrut planning benchmarks.
 *
 * These are internal planning indicators. Some values below are transcribed
 * from supplied DARB reference material; the extended category values are
 * DARB operational planning rules and are not official university cutoffs.
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

export const COMPETITIVE_BGRUT_BY_MAJOR = {
  architecture: 70,
  'mechanical-engineering': 80,
  'computer-science': 75,
  medicine: 94,
  dentistry: 94,
  veterinary: 89,
  pharmacy: 94,
  'public-health': 94,
  bioinformatics: 94,
  'biomedical-engineering': 80,
  physiotherapy: 94,
  nursing: 94,
  'international-law': 90,
  'business-administration': 75,
  economics: 75,
  'computer-engineering': 80,
  'aerospace-engineering': 80,
  'renewable-energy': 75,
  'software-engineering': 75,
  'industrial-engineering': 75,
  'space-engineering': 80,
  'chemical-engineering': 80,
  'civil-engineering': 80,
  'electrical-it': 80,
} as const;

export const COMPETITIVE_BGRUT_EVIDENCE_BY_MAJOR = {
  architecture: 'DARB supplied reference — Report.pdf 2, page 1',
  'mechanical-engineering': 'DARB operational category rule — hard engineering, 2026-09-25',
  'computer-science': 'DARB supplied reference — Report.pdf 2, page 3',
  medicine: 'DARB supplied reference — Report.pdf.pdf, page 1',
  pharmacy: 'DARB operational category rule — health/medical, 2026-09-25',
  dentistry: 'DARB supplied reference — Report.pdf.pdf, page 3',
  veterinary: 'DARB supplied reference — Report.pdf.pdf, page 4',
  'public-health': 'DARB operational category rule — health/medical, 2026-09-25',
  bioinformatics: 'DARB operational category rule — health/medical, 2026-09-25',
  'biomedical-engineering': 'DARB operational category rule — hard engineering, 2026-09-25',
  physiotherapy: 'DARB operational category rule — health/medical, 2026-09-25',
  nursing: 'DARB operational category rule — health/medical, 2026-09-25',
  'international-law': 'DARB supplied reference — Report.pdf 3, page 1',
  'business-administration': 'DARB supplied reference — Report.pdf 3, page 3',
  economics: 'DARB supplied reference — Report.pdf 3, page 4',
  'computer-engineering': 'DARB operational category rule — hard engineering, 2026-09-25',
  'aerospace-engineering': 'DARB operational category rule — hard engineering, 2026-09-25',
  'renewable-energy': 'DARB operational category rule — engineering, 2026-09-25',
  'software-engineering': 'DARB operational category rule — engineering, 2026-09-25',
  'industrial-engineering': 'DARB operational category rule — engineering, 2026-09-25',
  'space-engineering': 'DARB operational category rule — hard engineering, 2026-09-25',
  'chemical-engineering': 'DARB operational category rule — hard engineering, 2026-09-25',
  'civil-engineering': 'DARB operational category rule — hard engineering, 2026-09-25',
  'electrical-it': 'DARB operational category rule — hard engineering, 2026-09-25',
} as const;

const NOTE_EN =
  'Internal DARB planning indicator. It is not an official university cutoff or a guarantee of admission. Check the named programme requirements separately.';
const NOTE_AR =
  'مؤشر تخطيط داخلي من درب. ليس حداً رسمياً للقبول الجامعي ولا ضماناً للقبول. يجب التحقق من شروط البرنامج المحدد بشكل منفصل.';

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
