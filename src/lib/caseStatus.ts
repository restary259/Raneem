export enum CaseStatus {
  NEW = 'new',
  ELIGIBLE = 'eligible',
  ASSIGNED = 'assigned',
  CONTACTED = 'contacted',
  APPT_SCHEDULED = 'appointment_scheduled',
  APPT_WAITING = 'appointment_waiting',
  APPT_COMPLETED = 'appointment_completed',
  PROFILE_FILLED = 'profile_filled',
  SERVICES_FILLED = 'services_filled',
  PAID = 'paid',
  READY_TO_APPLY = 'ready_to_apply',
  VISA_STAGE = 'visa_stage',
  COMPLETED = 'completed',
}

/** Ordered list for progress indicators (simplified 6-stage pipeline) */
export const CASE_STATUS_ORDER: CaseStatus[] = [
  CaseStatus.NEW,
  CaseStatus.ELIGIBLE,
  CaseStatus.ASSIGNED,
  CaseStatus.CONTACTED,
  CaseStatus.APPT_SCHEDULED,
  CaseStatus.APPT_WAITING,
  CaseStatus.APPT_COMPLETED,
  CaseStatus.PROFILE_FILLED,
  CaseStatus.SERVICES_FILLED,
  CaseStatus.PAID,
];

/** Map legacy DB strings to the nearest canonical status */
export const LEGACY_STATUS_MAP: Record<string, CaseStatus> = {
  appointment: CaseStatus.APPT_SCHEDULED,
  closed: CaseStatus.PAID,
  registration_submitted: CaseStatus.PAID,
  settled: CaseStatus.PAID,
  ready_to_apply: CaseStatus.PAID,
  visa_stage: CaseStatus.PAID,
  completed: CaseStatus.PAID,
};

/** Resolve any status string to a CaseStatus (handles legacy values) */
export function resolveStatus(raw: string): CaseStatus {
  if (Object.values(CaseStatus).includes(raw as CaseStatus)) return raw as CaseStatus;
  return LEGACY_STATUS_MAP[raw] ?? CaseStatus.ASSIGNED;
}

/** Get the 0-based position of a status in the pipeline */
export function statusIndex(status: string): number {
  const resolved = resolveStatus(status);
  const idx = CASE_STATUS_ORDER.indexOf(resolved);
  return idx >= 0 ? idx : 0;
}

/** Badge colors for each status */
export const STATUS_COLORS: Record<string, string> = {
  [CaseStatus.NEW]: 'bg-slate-100 text-slate-800',
  [CaseStatus.ELIGIBLE]: 'bg-cyan-100 text-cyan-800',
  [CaseStatus.ASSIGNED]: 'bg-blue-100 text-blue-800',
  [CaseStatus.CONTACTED]: 'bg-yellow-100 text-yellow-800',
  [CaseStatus.APPT_SCHEDULED]: 'bg-purple-100 text-purple-800',
  [CaseStatus.APPT_WAITING]: 'bg-orange-100 text-orange-800',
  [CaseStatus.APPT_COMPLETED]: 'bg-violet-100 text-violet-800',
  [CaseStatus.PROFILE_FILLED]: 'bg-indigo-100 text-indigo-800',
  [CaseStatus.SERVICES_FILLED]: 'bg-sky-100 text-sky-800',
  [CaseStatus.PAID]: 'bg-green-100 text-green-800',
  [CaseStatus.READY_TO_APPLY]: 'bg-emerald-100 text-emerald-800',
  [CaseStatus.VISA_STAGE]: 'bg-amber-100 text-amber-800',
  [CaseStatus.COMPLETED]: 'bg-teal-100 text-teal-800',
  // Legacy fallbacks
  appointment: 'bg-purple-100 text-purple-800',
  closed: 'bg-gray-100 text-gray-800',
  registration_submitted: 'bg-emerald-100 text-emerald-800',
  settled: 'bg-teal-100 text-teal-800',
};
