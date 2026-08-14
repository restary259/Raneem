import { TONE_BY_STATUS, toneClasses, toneForColorName, toneForStatus } from '@/lib/statusTokens';
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

/** Statuses that end the case lifecycle and are excluded from "active" counts */
export const TERMINAL_STATUSES: readonly CaseStatus[] = [
  CaseStatus.ENROLLMENT_PAID,
  CaseStatus.FORGOTTEN,
  CaseStatus.CANCELLED,
];

/** Statuses considered "active" in the pipeline (non-terminal) */
export const ACTIVE_STATUSES: readonly CaseStatus[] = [
  CaseStatus.NEW,
  CaseStatus.CONTACTED,
  CaseStatus.APPT_SCHEDULED,
  CaseStatus.PROFILE_COMPLETION,
  CaseStatus.PAYMENT_CONFIRMED,
  CaseStatus.SUBMITTED,
];

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(resolveStatus(status));
}

export function isActiveStatus(status: string): boolean {
  return !isTerminalStatus(status);
}

/** Canonical en/ar labels — the single source for status wording */
export const CASE_STATUS_LABELS: Record<CaseStatus, { en: string; ar: string }> = {
  [CaseStatus.NEW]:                { en: 'New',                ar: 'جديد' },
  [CaseStatus.CONTACTED]:          { en: 'Contacted',          ar: 'تم التواصل' },
  [CaseStatus.APPT_SCHEDULED]:     { en: 'Appointment',        ar: 'موعد محدد' },
  [CaseStatus.PROFILE_COMPLETION]: { en: 'Profile',            ar: 'استكمال الملف' },
  [CaseStatus.PAYMENT_CONFIRMED]:  { en: 'Payment',            ar: 'تأكيد الدفع' },
  [CaseStatus.SUBMITTED]:          { en: 'Submitted',          ar: 'تم التقديم' },
  [CaseStatus.ENROLLMENT_PAID]:    { en: 'Enrolled',           ar: 'مسجل' },
  [CaseStatus.FORGOTTEN]:          { en: 'Forgotten',          ar: 'منسي' },
  [CaseStatus.CANCELLED]:          { en: 'Cancelled',          ar: 'ملغي' },
};

/** Get the 0-based position of a status in the pipeline */
export function statusIndex(status: string): number {
  const resolved = resolveStatus(status);
  const idx = CASE_STATUS_ORDER.indexOf(resolved);
  return idx >= 0 ? idx : 0;
}

/** Badge classes per status — theme-aware semantic tokens (statusTokens.ts). */
export const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  Object.keys(TONE_BY_STATUS).map((key) => [key, toneClasses(toneForStatus(key)).chip]),
);

/* ------------------------------------------------------------------ *
 * Configurable pipeline stages (Phase 2)
 * The database table `pipeline_statuses` is the source of truth at
 * runtime; the constants below are the offline fallback so the app
 * behaves exactly as before if the table cannot be read.
 * ------------------------------------------------------------------ */

export interface PipelineStatus {
  id?: string;
  key: string;
  label_ar: string;
  label_en: string;
  color: string;
  sort_order: number;
  is_terminal: boolean;
  is_active: boolean;
}

export const PIPELINE_STATUS_COLORS = [
  'slate', 'blue', 'yellow', 'purple', 'orange',
  'teal', 'indigo', 'green', 'red', 'gray',
] as const;

export function statusColorClasses(color?: string | null): string {
  return toneClasses(toneForColorName(color)).chip;
}

export const PIPELINE_STATUS_FALLBACK: PipelineStatus[] = [
  { key: 'new',                   label_ar: 'جديد',        label_en: 'New',               color: 'blue',   sort_order: 1, is_terminal: false, is_active: true },
  { key: 'contacted',             label_ar: 'تم التواصل',  label_en: 'Contacted',         color: 'yellow', sort_order: 2, is_terminal: false, is_active: true },
  { key: 'appointment_scheduled', label_ar: 'موعد محدد',   label_en: 'Appointment',       color: 'purple', sort_order: 3, is_terminal: false, is_active: true },
  { key: 'profile_completion',    label_ar: 'استكمال الملف', label_en: 'Profile',         color: 'orange', sort_order: 4, is_terminal: false, is_active: true },
  { key: 'payment_confirmed',     label_ar: 'تأكيد الدفع', label_en: 'Payment Confirmed', color: 'teal',   sort_order: 5, is_terminal: false, is_active: true },
  { key: 'submitted',             label_ar: 'تم التقديم',  label_en: 'Submitted',         color: 'indigo', sort_order: 6, is_terminal: false, is_active: true },
  { key: 'enrollment_paid',       label_ar: 'مسجل',        label_en: 'Enrolled',          color: 'green',  sort_order: 7, is_terminal: true,  is_active: true },
  { key: 'forgotten',             label_ar: 'منسي',        label_en: 'Forgotten',         color: 'red',    sort_order: 8, is_terminal: true,  is_active: true },
  { key: 'cancelled',             label_ar: 'ملغي',        label_en: 'Cancelled',         color: 'gray',   sort_order: 9, is_terminal: true,  is_active: true },
];
