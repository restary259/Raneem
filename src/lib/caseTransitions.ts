import { CaseStatus, resolveStatus } from './caseStatus';

/** Strict forward-only transitions. UI can only move along these edges. */
export const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  [CaseStatus.NEW]: [CaseStatus.ELIGIBLE, CaseStatus.ASSIGNED],
  [CaseStatus.ELIGIBLE]: [CaseStatus.ASSIGNED],
  [CaseStatus.ASSIGNED]: [CaseStatus.CONTACTED],
  [CaseStatus.CONTACTED]: [CaseStatus.APPT_SCHEDULED, CaseStatus.APPT_WAITING],
  [CaseStatus.APPT_SCHEDULED]: [CaseStatus.APPT_COMPLETED, CaseStatus.APPT_WAITING, CaseStatus.PROFILE_FILLED],
  [CaseStatus.APPT_WAITING]: [CaseStatus.APPT_SCHEDULED, CaseStatus.APPT_COMPLETED, CaseStatus.PROFILE_FILLED],
  [CaseStatus.APPT_COMPLETED]: [CaseStatus.PROFILE_FILLED],
  [CaseStatus.PROFILE_FILLED]: [CaseStatus.SERVICES_FILLED],
  [CaseStatus.SERVICES_FILLED]: [],  // PAID is set only via admin-mark-paid edge function
  [CaseStatus.PAID]: [],             // Terminal state
  [CaseStatus.READY_TO_APPLY]: [],   // Legacy — resolved to PAID
  [CaseStatus.VISA_STAGE]: [],       // Legacy — resolved to PAID
  [CaseStatus.COMPLETED]: [],        // Legacy — resolved to PAID
};

/** Check if transitioning from `current` to `next` is allowed */
export function canTransition(current: string, next: string): boolean {
  const resolved = resolveStatus(current);
  const resolvedNext = resolveStatus(next);
  return ALLOWED_TRANSITIONS[resolved]?.includes(resolvedNext) ?? false;
}

/** Get allowed next steps from current status */
export function getNextSteps(current: string): CaseStatus[] {
  const resolved = resolveStatus(current);
  return ALLOWED_TRANSITIONS[resolved] ?? [];
}
