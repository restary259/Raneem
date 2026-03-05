export enum CaseStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  APPT_SCHEDULED = 'appointment_scheduled',
  PROFILE_COMPLETION = 'profile_completion',
  PAYMENT_CONFIRMED = 'payment_confirmed',
  SUBMITTED = 'submitted',
  ENROLLMENT_PAID = 'enrollment_paid',
  FORGOTTEN = 'forgotten',
  CANCELLED = 'cancelled',
}

/** Ordered list for progress indicators */
export const CASE_STATUS_ORDER: CaseStatus[] = [
  CaseStatus.NEW,
  CaseStatus.CONTACTED,
  CaseStatus.APPT_SCHEDULED,
  CaseStatus.PROFILE_COMPLETION,
  CaseStatus.PAYMENT_CONFIRMED,
  CaseStatus.SUBMITTED,
  CaseStatus.ENROLLMENT_PAID,
];

/** Resolve any status string to a CaseStatus (handles unknown values) */
export function resolveStatus(raw: string): CaseStatus {
  if (Object.values(CaseStatus).includes(raw as CaseStatus)) return raw as CaseStatus;
  return CaseStatus.NEW;
}

/** Get the 0-based position of a status in the pipeline */
export function statusIndex(status: string): number {
  const resolved = resolveStatus(status);
  const idx = CASE_STATUS_ORDER.indexOf(resolved);
  return idx >= 0 ? idx : 0;
}

/** Badge colors for each status — using semantic Tailwind classes */
export const STATUS_COLORS: Record<string, string> = {
  [CaseStatus.NEW]:               'bg-slate-100 text-slate-800',
  [CaseStatus.CONTACTED]:         'bg-blue-100 text-blue-800',
  [CaseStatus.APPT_SCHEDULED]:    'bg-purple-100 text-purple-800',
  [CaseStatus.PROFILE_COMPLETION]:'bg-yellow-100 text-yellow-800',
  [CaseStatus.PAYMENT_CONFIRMED]: 'bg-amber-100 text-amber-800',
  [CaseStatus.SUBMITTED]:         'bg-cyan-100 text-cyan-800',
  [CaseStatus.ENROLLMENT_PAID]:   'bg-green-100 text-green-800',
  [CaseStatus.FORGOTTEN]:         'bg-red-100 text-red-800',
  [CaseStatus.CANCELLED]:         'bg-gray-100 text-gray-800',
};
