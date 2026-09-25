/**
 * DARB competitive Bagrut planning benchmarks.
 *
 * These are internal planning indicators transcribed from the DARB student-
 * requirements reference material supplied for the Team Majors update.
 * They are not official university admission cutoffs.
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

const NOTE_EN =
  'Internal DARB planning indicator transcribed from supplied DARB student-requirements reference material. It is not an official university cutoff or a guarantee of admission. Check the named programme requirements separately.';
const NOTE_AR =
  'مؤشر تخطيط داخلي من درب، منقول من مادة متطلبات الطلاب المقدمة من درب. ليس حداً رسمياً للقبول الجامعي ولا ضماناً للقبول. يجب التحقق من شروط البرنامج المحدد بشكل منفصل.';

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
    { note: NOTE_EN, noteAR: NOTE_AR },
  );
}
