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

const COLOR_CLASSES: Record<string, string> = {
  slate:  'bg-slate-100 text-slate-800 border-slate-200',
  blue:   'bg-blue-100 text-blue-800 border-blue-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  teal:   'bg-teal-100 text-teal-800 border-teal-200',
  indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  green:  'bg-green-100 text-green-800 border-green-200',
  red:    'bg-red-100 text-red-800 border-red-200',
  gray:   'bg-gray-100 text-gray-800 border-gray-200',
};

export function statusColorClasses(color?: string | null): string {
  return COLOR_CLASSES[color ?? 'slate'] ?? COLOR_CLASSES.slate;
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
