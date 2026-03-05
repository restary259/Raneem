import { CaseStatus, resolveStatus } from './caseStatus';

/**
 * Strict forward-only transitions.
 * Appointment outcomes are handled server-side via record-appointment-outcome edge function.
 * UI can only move along these edges.
 */
export const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  [CaseStatus.NEW]:               [CaseStatus.CONTACTED],
  [CaseStatus.CONTACTED]:         [CaseStatus.APPT_SCHEDULED],
  [CaseStatus.APPT_SCHEDULED]:    [CaseStatus.PROFILE_COMPLETION, CaseStatus.CONTACTED, CaseStatus.FORGOTTEN],
  [CaseStatus.PROFILE_COMPLETION]:[CaseStatus.PAYMENT_CONFIRMED],
  [CaseStatus.PAYMENT_CONFIRMED]: [CaseStatus.SUBMITTED],
  [CaseStatus.SUBMITTED]:         [CaseStatus.ENROLLMENT_PAID],
  [CaseStatus.ENROLLMENT_PAID]:   [],  // Terminal state — set via admin-mark-paid
  [CaseStatus.FORGOTTEN]:         [CaseStatus.CONTACTED],  // Can be re-engaged
  [CaseStatus.CANCELLED]:         [],  // Terminal state
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
